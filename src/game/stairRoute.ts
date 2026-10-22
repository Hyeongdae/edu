import type { Direction, StairRoute, StairRouteStep, StairRunLength } from "./types";

const RUN_LENGTHS: readonly StairRunLength[] = [4, 5, 6];
const HISTORY_STEPS = 4;
const FUTURE_STEPS = 18;
const UINT32_RANGE = 4_294_967_296;

function validateIndex(index: number): void {
  if (!Number.isSafeInteger(index)) {
    throw new RangeError("Route index must be a safe integer.");
  }
}

function validateRoute(route: StairRoute): void {
  if (
    route.steps.length === 0 ||
    !Number.isInteger(route.rngState) ||
    route.rngState < 0 ||
    route.rngState >= UINT32_RANGE ||
    !RUN_LENGTHS.includes(route.tailRunLength) ||
    !Number.isInteger(route.tailStepsRemaining) ||
    route.tailStepsRemaining < 0 ||
    route.tailStepsRemaining >= route.tailRunLength
  ) {
    throw new RangeError("Invalid stair route generation state.");
  }

  for (let index = 0; index < route.steps.length; index += 1) {
    const step = route.steps[index];
    validateIndex(step.index);
    if (
      !Number.isSafeInteger(step.column) ||
      (step.direction !== "left" && step.direction !== "right")
    ) {
      throw new RangeError("Invalid stair route step.");
    }

    if (index > 0) {
      const previous = route.steps[index - 1];
      const columnDelta = step.direction === "right" ? 1 : -1;
      if (step.index !== previous.index + 1 || step.column !== previous.column + columnDelta) {
        throw new RangeError("Stair route steps must be continuous.");
      }
    }
  }

  if (route.steps[route.steps.length - 1].direction !== route.tailDirection) {
    throw new RangeError("Stair route direction does not match its tail.");
  }
}

export function chooseRunLength(
  unit: number,
  previousLength: StairRunLength | null,
): StairRunLength {
  if (
    !Number.isFinite(unit) || unit < 0 || unit >= 1 ||
    (previousLength !== null && !RUN_LENGTHS.includes(previousLength))
  ) {
    throw new RangeError("Run selection requires a unit value and a valid previous length.");
  }

  const candidates = RUN_LENGTHS.filter((length) => length !== previousLength);
  return candidates[Math.floor(unit * candidates.length)];
}

function extendRoute(route: StairRoute, throughIndex: number): StairRoute {
  const steps = [...route.steps];
  let { rngState, tailDirection, tailRunLength, tailStepsRemaining } = route;

  while (steps[steps.length - 1].index < throughIndex) {
    if (tailStepsRemaining === 0) {
      rngState = (Math.imul(rngState, 1_664_525) + 1_013_904_223) >>> 0;
      tailRunLength = chooseRunLength(rngState / UINT32_RANGE, tailRunLength);
      tailDirection = tailDirection === "right" ? "left" : "right";
      tailStepsRemaining = tailRunLength;
    }

    const previous = steps[steps.length - 1];
    steps.push({
      index: previous.index + 1,
      column: previous.column + (tailDirection === "right" ? 1 : -1),
      direction: tailDirection,
    });
    tailStepsRemaining -= 1;
  }

  return { steps, rngState, tailDirection, tailRunLength, tailStepsRemaining };
}

export function createStairRoute(random: () => number = Math.random): StairRoute {
  const unit = random();
  const length = chooseRunLength(unit, null);
  const steps: StairRouteStep[] = Array.from({ length: HISTORY_STEPS + 1 }, (_, offset) => ({
    index: offset - HISTORY_STEPS,
    column: offset - HISTORY_STEPS,
    direction: "right",
  }));

  return extendRoute({
    steps,
    rngState: Math.floor(unit * UINT32_RANGE) >>> 0,
    tailDirection: "right",
    tailRunLength: length,
    tailStepsRemaining: length,
  }, FUTURE_STEPS);
}

export function getRouteStep(route: StairRoute, index: number): StairRouteStep {
  validateIndex(index);
  validateRoute(route);
  const step = route.steps.find((entry) => entry.index === index);
  if (!step) {
    throw new RangeError(`Stair route does not contain step ${index}.`);
  }
  return step;
}

export function advanceStairRoute(route: StairRoute, playerIndex: number): StairRoute {
  getRouteStep(route, playerIndex);
  if (playerIndex < 0 || playerIndex - HISTORY_STEPS < route.steps[0].index) {
    throw new RangeError("Player position requires four retained stairs behind it.");
  }

  const extended = extendRoute(route, playerIndex + FUTURE_STEPS);
  return {
    ...extended,
    steps: extended.steps.filter((step) => step.index >= playerIndex - HISTORY_STEPS),
  };
}

export function countStraightSteps(
  route: StairRoute,
  playerIndex: number,
  direction: Direction,
): number {
  getRouteStep(route, playerIndex);
  if (
    (direction !== "left" && direction !== "right") ||
    route.steps[route.steps.length - 1].index < playerIndex + FUTURE_STEPS
  ) {
    throw new RangeError("Direction counting requires a valid direction and full route preview.");
  }

  let remaining = 0;
  for (const step of route.steps) {
    if (step.index <= playerIndex) continue;
    if (step.direction !== direction) return remaining;
    remaining += 1;
  }
  throw new RangeError("Stair route preview does not contain the next corner.");
}
