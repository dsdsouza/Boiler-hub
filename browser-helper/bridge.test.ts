import { runInNewContext } from "node:vm";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

for (const [folder, extension] of [
  ["browser-helper", "calendar"],
  ["focus-extension", "focus"],
]) {
  describe(`${extension} extension installation handshake`, () => {
    function setup() {
      const listeners: ((event: unknown) => void)[] = [];
      const win = {
        addEventListener: (_: string, cb: (event: unknown) => void) =>
          listeners.push(cb),
        postMessage: vi.fn(),
      };
      runInNewContext(readFileSync(`${folder}/bridge.js`, "utf8"), {
        window: win,
        location: { origin: "https://boilerhub.work" },
        chrome: {
          runtime: {
            id: "installed",
            getManifest: () => ({ version: "1.1.0" }),
          },
        },
      });
      return {
        win,
        emit: (event: object) =>
          listeners.forEach((listener) => listener(event)),
      };
    }
    it("returns the request nonce and actual installed version", () => {
      const { win, emit } = setup();
      emit({
        source: win,
        origin: "https://boilerhub.work",
        data: { type: "bp-extension:ping", extension, nonce: "request-id" },
      });
      expect(win.postMessage).toHaveBeenCalledWith(
        {
          type: "bp-extension:pong",
          extension,
          nonce: "request-id",
          version: "1.1.0",
        },
        "https://boilerhub.work",
      );
    });
    it("ignores frames, other origins, other extensions and malformed requests", () => {
      const { win, emit } = setup();
      const base = {
        source: win,
        origin: "https://boilerhub.work",
        data: { type: "bp-extension:ping", extension, nonce: "request-id" },
      };
      for (const event of [
        { ...base, source: {} },
        { ...base, origin: "https://evil.example" },
        { ...base, data: { ...base.data, extension: "other" } },
        { ...base, data: { ...base.data, nonce: "x".repeat(81) } },
      ])
        emit(event);
      expect(win.postMessage).not.toHaveBeenCalled();
    });
  });
}
