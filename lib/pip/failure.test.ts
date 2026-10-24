import { APICallError } from "ai";
import { expect, it } from "vitest";
import { pipFailure } from "./failure";

it("records the failing stage and provider status without error contents or credentials", () => {
  const failure = new APICallError({
    message: "private assignments", url: "https://example.com/?key=secret",
    requestBodyValues: { prompt: "private assignments" }, statusCode: 403,
    responseBody: "secret provider details", data: { key: "secret" },
  });
  expect(pipFailure("gemini", failure)).toEqual({ stage: "gemini", kind: "provider", status: 403 });
  expect(pipFailure("assignments", new Error("private assignments"))).toEqual({ stage: "assignments", kind: "unexpected" });
  expect(pipFailure("gemini", new DOMException("private assignments", "TimeoutError"))).toEqual({ stage: "gemini", kind: "timeout" });
});
