import { describe, expect, it } from "vitest";
import { authFailurePath, authOrigin, safeNext } from "./auth";

describe("OAuth destinations", () => {
  it.each(["//evil.example", "/\\evil.example", "https://evil.example", "/\nevil", "javascript:alert(1)"])("rejects an external or malformed next path: %s", value => {
    expect(safeNext(value)).toBe("/onboarding");
  });
  it("retains valid app paths and query parameters", () => {
    expect(safeNext("/onboarding?resume=account")).toBe("/onboarding?resume=account");
    expect(safeNext("/teams/abc")).toBe("/teams/abc");
  });
  it("preserves the actual localhost origin rather than Next's normalized origin", () => {
    expect(authOrigin({ url: "http://localhost:3016/auth/signin", headers: new Headers({ host: "127.0.0.1:3016" }) })).toBe("http://127.0.0.1:3016");
    expect(authOrigin({ url: "http://localhost:3016/auth/signin", headers: new Headers({ host: "localhost:3016" }) })).toBe("http://localhost:3016");
  });
  it("uses production HTTPS and ignores arbitrary forwarded hosts", () => {
    expect(authOrigin({ url: "https://boilerhub.work/auth/signin", headers: new Headers({ host: "boilerhub.work", "x-forwarded-host": "evil.example" }) })).toBe("https://boilerhub.work");
    expect(authOrigin({ url: "https://boilerhub.work/auth/signin", headers: new Headers({ host: "evil.example" }) })).toBe("https://boilerhub.work");
  });
  it("returns failed onboarding sign-ins to the same journey", () => {
    expect(authFailurePath("/onboarding?resume=account", "auth")).toBe("/onboarding?error=auth");
    expect(authFailurePath("/settings/sources", "signin")).toBe("/?error=signin");
  });
});
