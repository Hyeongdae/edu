import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { isSubmitResultRequest } from "../../shared/companyRecords";
import type { AuthenticatedActor } from "../../shared/companyRecords";
import { RecordServiceError } from "./errors";
import type { PlayerRepository } from "./playerRepository";
import { readAuthenticatedActor } from "./principal";

const MAX_BODY_BYTES = 8 * 1024;

async function readResultBody(req: HttpRequest): Promise<unknown> {
  if (req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json" ||
    req.headers.get("x-game-request") !== "1") throw new RecordServiceError("invalid-request");
  if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) {
    throw new RecordServiceError("invalid-request", 413);
  }
  if (!req.body) throw new RecordServiceError("invalid-request");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RecordServiceError("invalid-request", 413);
      }
      chunks.push(chunk.value);
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, length))) as unknown;
  } catch (error) {
    if (error instanceof RecordServiceError) throw error;
    throw new RecordServiceError("invalid-request");
  } finally {
    reader.releaseLock();
  }
}

type RecordHandler = (req: HttpRequest, ctx: InvocationContext) => Promise<HttpResponseInit>;

export function createRecordHandlers(deps: { repository: PlayerRepository }): {
  profile: RecordHandler;
  leaderboard: RecordHandler;
  results: RecordHandler;
} {
  async function authenticated(
    req: HttpRequest,
    action: (actor: AuthenticatedActor) => Promise<unknown>,
  ): Promise<HttpResponseInit> {
    const headers = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" };
    const actor = readAuthenticatedActor(req.headers.get("x-ms-client-principal"));
    if (!actor) {
      const error = new RecordServiceError("unauthenticated");
      return { status: error.status, headers, jsonBody: { error: { code: error.code, message: error.message } } };
    }
    try {
      return { status: 200, headers, jsonBody: await action(actor) };
    } catch (failure) {
      const error = failure instanceof RecordServiceError ? failure : new RecordServiceError("storage-unavailable");
      return { status: error.status, headers, jsonBody: { error: { code: error.code, message: error.message } } };
    }
  }

  return {
    profile: (req) => authenticated(req, (actor) => deps.repository.getProfile(actor)),
    leaderboard: (req) => authenticated(req, async () => ({ entries: await deps.repository.listTopScores() })),
    results: (req) => authenticated(req, async (actor) => {
      const payload = await readResultBody(req);
      if (!isSubmitResultRequest(payload)) throw new RecordServiceError("invalid-request");
      const profile = await deps.repository.submit(actor, payload);
      return { submissionId: payload.submissionId, profile, entries: await deps.repository.listTopScores() };
    }),
  };
}
