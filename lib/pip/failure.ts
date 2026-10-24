import { APICallError } from "ai";

export type PipStage = "setup" | "assignments" | "gemini";

/** Only fixed categories and HTTP status codes may reach logs. Never log the error object. */
export function pipFailure(stage: PipStage, failure: unknown) {
  const api = APICallError.isInstance(failure);
  const status = api && Number.isInteger(failure.statusCode) && failure.statusCode! >= 400 && failure.statusCode! <= 599
    ? failure.statusCode : undefined;
  const kind = api ? "provider" : failure instanceof Error && failure.name === "TimeoutError" ? "timeout" : "unexpected";
  return { stage, kind, ...(status === undefined ? {} : { status }) };
}
