import { APICallError, RetryError } from "ai";

export type PipStage = "setup" | "assignments" | "gemini";

/** Only fixed categories and HTTP status codes may reach logs. Never log the error object. */
export function pipFailure(stage: PipStage, failure: unknown) {
  const cause = RetryError.isInstance(failure) ? failure.lastError : failure;
  const api = APICallError.isInstance(cause);
  const status = api && Number.isInteger(cause.statusCode) && cause.statusCode! >= 400 && cause.statusCode! <= 599
    ? cause.statusCode : undefined;
  const kind = api ? "provider" : cause instanceof Error && cause.name === "TimeoutError" ? "timeout" : "unexpected";
  return { stage, kind, ...(status === undefined ? {} : { status }) };
}
