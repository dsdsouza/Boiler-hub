import { describe, expect, it } from "vitest";
import { clampPip, fromPipRatio, pipPanel, pipRatio, readPipRatio, type PipFrame } from "./pip-position";

const desktop: PipFrame = { width: 1280, height: 800, pipWidth: 136, pipHeight: 156, bottom: 16 };
const phone: PipFrame = { width: 320, height: 740, pipWidth: 112, pipHeight: 128, bottom: 80 };
describe("Pip placement", () => {
  it("keeps the entire character on screen and above phone navigation", () => {
    expect(clampPip({ x: -500, y: -500 }, phone)).toEqual({ x: 12, y: 12 });
    expect(clampPip({ x: 5000, y: 5000 }, phone)).toEqual({ x: 196, y: 532 });
  });
  it("restores a relative position when a laptop becomes a phone", () => {
    const ratio = pipRatio({ x: 566, y: 320 }, desktop);
    const position = fromPipRatio(ratio, phone);
    expect(pipRatio(position, phone).x).toBeCloseTo(ratio.x);
    expect(pipRatio(position, phone).y).toBeCloseTo(ratio.y);
  });
  it("rejects corrupt or out-of-range browser preferences", () => {
    for (const value of [null, "oops", "[]", '{"x":4,"y":0}', '{"x":"0","y":0}', '{"x":0,"y":1e999}']) expect(readPipRatio(value)).toBeNull();
    expect(readPipRatio('{"x":0.4,"y":1}')).toEqual({ x: 0.4, y: 1 });
  });
  it("keeps chat reachable from every corner and the center", () => {
    for (const frame of [phone, desktop, { ...phone, height: 480 }]) {
      for (const p of [{ x: 0, y: 0 }, { x: 9999, y: 9999 }, { x: 100, y: 200 }]) {
        const panel = pipPanel(clampPip(p, frame), frame);
        expect(panel.left).toBeGreaterThanOrEqual(12);
        expect(panel.top).toBeGreaterThanOrEqual(12);
        expect(panel.left + panel.width).toBeLessThanOrEqual(frame.width - 12);
        expect(panel.top + panel.maxHeight).toBeLessThanOrEqual(frame.height - frame.bottom);
        const pip = clampPip(p, frame);
        expect(panel.left + panel.width <= pip.x || panel.left >= pip.x + frame.pipWidth || panel.top + panel.maxHeight <= pip.y || panel.top >= pip.y + frame.pipHeight).toBe(true);
      }
    }
  });
});
