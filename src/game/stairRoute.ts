import type { Direction, StairRoute, StairRouteRun, StairRouteStep, StairRunKind, StairRunLength } from "./types";

const RUN_LENGTHS: Record<StairRunKind, readonly StairRunLength[]> = {
  long: [5, 6, 7, 8, 9],
  short: [1, 2, 3],
};
const HISTORY_STEPS = 4;
const FUTURE_STEPS = 18;
const UINT32_RANGE = 4_294_967_296;

function validateIndex(index: number): void {
  if (!Number.isSafeInteger(index)) {
    throw new RangeError("Route index must be a safe integer.");
  }
}

function isRunKind(kind: unknown): kind is StairRunKind {
  return kind === "long" || kind === "short";
}

function validateRoute(route: StairRoute): void {
  if (
    !Array.isArray(route.steps) || route.steps.length === 0 ||
    !Array.isArray(route.runs) || route.runs.length === 0 ||
    !Number.isInteger(route.rngState) || route.rngState < 0 || route.rngState >= UINT32_RANGE ||
    !isRunKind(route.tailRunKind) || !RUN_LENGTHS[route.tailRunKind].includes(route.tailRunLength) ||
    !Number.isInteger(route.tailStepsRemaining) || route.tailStepsRemaining < 0 ||
    route.tailStepsRemaining >= route.tailRunLength ||
    (route.tailShortRunsRemaining !== 0 && route.tailShortRunsRemaining !== 1) ||
    (route.tailRunKind === "long" && route.tailShortRunsRemaining !== 0)
  ) {
    throw new RangeError("Invalid stair route generation state.");
  }

  for (let index = 0; index < route.runs.length; index += 1) {
    const run: StairRouteRun = route.runs[index];
    if (
      !run || !Number.isSafeInteger(run.startIndex) || run.startIndex < 1 ||
      !Number.isSafeInteger(run.startIndex + run.length - 1) ||
      !isRunKind(run.kind) || !RUN_LENGTHS[run.kind].includes(run.length) ||
      (run.direction !== "left" && run.direction !== "right")
    ) {
      throw new RangeError("Invalid stair run metadata.");
    }
    if (index > 0) {
      const previous = route.runs[index - 1];
      if (
        run.startIndex !== previous.startIndex + previous.length ||
        run.direction === previous.direction || run.length === previous.length ||
        (run.kind === "long" && previous.kind === "long") ||
        (run.kind === "short" && previous.kind === "short" && route.runs[index - 2]?.kind === "short")
      ) {
        throw new RangeError("Stair runs must follow the alternating mixed pattern.");
      }
    }
  }

  const firstStep: StairRouteStep = route.steps[0];
  const firstRun: StairRouteRun = route.runs[0];
  if (
    !firstStep || firstStep.index < -HISTORY_STEPS ||
    firstRun.startIndex > Math.max(1, firstStep.index) ||
    firstRun.startIndex + firstRun.length - 1 < Math.max(1, firstStep.index) ||
    (firstStep.index <= 0 && (firstRun.startIndex !== 1 || firstRun.kind !== "long" || firstRun.direction !== "right"))
  ) {
    throw new RangeError("Stair run metadata must cover the retained route.");
  }

  let runIndex = 0;
  for (let index = 0; index < route.steps.length; index += 1) {
    const step: StairRouteStep = route.steps[index];
    if (!step) throw new RangeError("Invalid stair route step.");
    validateIndex(step.index);
    if (!Number.isSafeInteger(step.column) || (step.direction !== "left" && step.direction !== "right")) {
      throw new RangeError("Invalid stair route step.");
    }
    if (index > 0) {
      const previous = route.steps[index - 1];
      const columnDelta = step.direction === "right" ? 1 : -1;
      if (step.index !== previous.index + 1 || step.column !== previous.column + columnDelta) {
        throw new RangeError("Stair route steps must be continuous.");
      }
    }
    if (step.index <= 0) {
      if (step.direction !== "right" || step.column !== step.index) {
        throw new RangeError("Initial historical stairs must stay on their original path.");
      }
      continue;
    }
    while (runIndex < route.runs.length && step.index >= route.runs[runIndex].startIndex + route.runs[runIndex].length) {
      runIndex += 1;
    }
    const run = route.runs[runIndex];
    if (!run || step.index < run.startIndex || step.direction !== run.direction) {
      throw new RangeError("Each stair must match its original run.");
    }
  }

  const lastStep: StairRouteStep = route.steps[route.steps.length - 1];
  const tail: StairRouteRun = route.runs[route.runs.length - 1];
  if (
    lastStep.index < tail.startIndex || lastStep.direction !== route.tailDirection ||
    tail.direction !== route.tailDirection || tail.kind !== route.tailRunKind || tail.length !== route.tailRunLength ||
    tail.startIndex + tail.length - 1 - lastStep.index !== route.tailStepsRemaining ||
    (tail.kind === "short" && route.runs[route.runs.length - 2]?.kind === "short" && route.tailShortRunsRemaining !== 0)
  ) {
    throw new RangeError("Stair route tail does not match its run metadata.");
  }
}

export function chooseRunLength(
  unit: number,
  kind: StairRunKind,
  previousLength: StairRunLength | null,
): StairRunLength {
  if (
    !Number.isFinite(unit) || unit < 0 || unit >= 1 || !isRunKind(kind) ||
    (previousLength !== null && !RUN_LENGTHS.long.includes(previousLength) && !RUN_LENGTHS.short.includes(previousLength))
  ) {
    throw new RangeError("Run selection requires a unit value, kind and valid previous length.");
  }
  const candidates = RUN_LENGTHS[kind].filter((length) => length !== previousLength);
  return candidates[Math.floor(unit * candidates.length)];
}

function extendRoute(route: StairRoute, throughIndex: number): StairRoute {
  const steps = [...route.steps];
  const runs = [...route.runs];
  let { rngState, tailDirection, tailRunLength, tailRunKind, tailStepsRemaining, tailShortRunsRemaining } = route;
  const nextUnit = () => {
    rngState = (Math.imul(rngState, 1_664_525) + 1_013_904_223) >>> 0;
    return rngState / UINT32_RANGE;
  };

  while (steps[steps.length - 1].index < throughIndex) {
    if (tailStepsRemaining === 0) {
      if (tailRunKind === "long") {
        tailShortRunsRemaining = nextUnit() < 0.5 ? 0 : 1;
        tailRunKind = "short";
      } else if (tailShortRunsRemaining === 1) {
        tailShortRunsRemaining = 0;
      } else {
        tailRunKind = "long";
      }
      tailRunLength = chooseRunLength(nextUnit(), tailRunKind, tailRunLength);
      tailDirection = tailDirection === "right" ? "left" : "right";
      tailStepsRemaining = tailRunLength;
      runs.push({ startIndex: steps[steps.length - 1].index + 1, length: tailRunLength, kind: tailRunKind, direction: tailDirection });
    }
    const previous = steps[steps.length - 1];
    steps.push({
      index: previous.index + 1,
      column: previous.column + (tailDirection === "right" ? 1 : -1),
      direction: tailDirection,
    });
    tailStepsRemaining -= 1;
  }
  return { steps, runs, rngState, tailDirection, tailRunLength, tailRunKind, tailStepsRemaining, tailShortRunsRemaining };
}

export function createStairRoute(random: () => number = Math.random): StairRoute {
  const unit = random();
  const length = chooseRunLength(unit, "long", null);
  const steps: StairRouteStep[] = Array.from({ length: HISTORY_STEPS + 1 }, (_, offset) => ({
    index: offset - HISTORY_STEPS, column: offset - HISTORY_STEPS, direction: "right",
  }));
  return extendRoute({
    steps, runs: [{ startIndex: 1, length, kind: "long", direction: "right" }],
    rngState: Math.floor(unit * UINT32_RANGE) >>> 0,
    tailDirection: "right", tailRunLength: length, tailRunKind: "long",
    tailStepsRemaining: length, tailShortRunsRemaining: 0,
  }, FUTURE_STEPS);
}

export function getRouteStep(route: StairRoute, index: number): StairRouteStep {
  validateIndex(index);
  validateRoute(route);
  const step = route.steps.find((entry) => entry.index === index);
  if (!step) throw new RangeError(`Stair route does not contain step ${index}.`);
  return step;
}

export function getRouteRun(route: StairRoute, index: number): StairRouteRun | null {
  getRouteStep(route, index);
  if (index <= 0) return null;
  const run = route.runs.find((entry) => index >= entry.startIndex && index < entry.startIndex + entry.length);
  if (!run) throw new RangeError(`Stair route does not contain run metadata for step ${index}.`);
  return run;
}

export function advanceStairRoute(
  route: StairRoute,
  playerIndex: number,
  oldestRequiredIndex: number = playerIndex - HISTORY_STEPS,
): StairRoute {
  getRouteStep(route, playerIndex);
  validateIndex(oldestRequiredIndex);
  validateIndex(playerIndex + FUTURE_STEPS);
  if (playerIndex < 0 || oldestRequiredIndex > playerIndex - HISTORY_STEPS || oldestRequiredIndex < route.steps[0].index) {
    throw new RangeError("Player position requires retained history without backwards refill.");
  }
  const extended = extendRoute(route, playerIndex + FUTURE_STEPS);
  return {
    ...extended,
    steps: extended.steps.filter((step) => step.index >= oldestRequiredIndex),
    runs: extended.runs.filter((run) => run.startIndex + run.length - 1 >= oldestRequiredIndex),
  };
}

export function countStraightSteps(route: StairRoute, playerIndex: number, direction: Direction): number {
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
