import { describe, expect, it } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "./middleware";

describe("session middleware routing", () => {
  it.each(["/api", "/api/me/boiler", "/api/teams", "/api/tasks", "/api/pip/chat"])(
    "leaves %s authentication to its API handler", (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    },
  );

  it.each(["/", "/boiler", "/teams", "/teams/example", "/settings/sources", "/onboarding", "/apiary"])(
    "still refreshes sessions and guards page route %s", (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    },
  );
});
