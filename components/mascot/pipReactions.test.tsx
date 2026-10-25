import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ZONE_MIN } from "@/lib/pressure";
import { CUE_MS, IDLE_DANCE_MIN_MS, IDLE_DANCE_SPREAD_MS, PIP_CUE_EVENT, crossedIntoRedline, cuePip, idleDanceDelay } from "./pipReactions";
import { Mascot } from "./Mascot";

vi.mock("./mascot.css", () => ({}));

describe("crossedIntoRedline", () => {
  it("fires only when a score moves from below Redline to Redline", () => {
    expect(crossedIntoRedline(ZONE_MIN.redline - 1, ZONE_MIN.redline)).toBe(true);
    expect(crossedIntoRedline(60, 95)).toBe(true);
    expect(crossedIntoRedline(92, 95)).toBe(false);
    expect(crossedIntoRedline(95, 80)).toBe(false);
    expect(crossedIntoRedline(60, 85)).toBe(false);
  });

  it("ignores the first reading", () => {
    expect(crossedIntoRedline(null, 99)).toBe(false);
    expect(crossedIntoRedline(undefined, 99)).toBe(false);
  });
});

describe("idleDanceDelay", () => {
  it("stays between one and two and a half minutes", () => {
    expect(idleDanceDelay(() => 0)).toBe(IDLE_DANCE_MIN_MS);
    expect(idleDanceDelay(() => 0.999)).toBeLessThan(IDLE_DANCE_MIN_MS + IDLE_DANCE_SPREAD_MS);
  });
});

describe("cuePip", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("dispatches the cue as a window event", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    vi.stubGlobal("CustomEvent", class { constructor(readonly type: string, readonly init: { detail: unknown }) {} });
    cuePip("dance");
    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(dispatchEvent.mock.calls[0]![0]).toMatchObject({ type: PIP_CUE_EVENT, init: { detail: "dance" } });
  });

  it("is a no-op during server rendering", () => {
    expect(() => cuePip("boil")).not.toThrow();
  });

  it("holds each cue about as long as its CSS animation", () => {
    expect(CUE_MS.dance).toBe(3000); // mp-dance: 1s × 3
    expect(CUE_MS.boil).toBe(2000); // mp-boil: 0.4s × 5
  });
});

describe("Mascot reactions", () => {
  const render = (reaction: Parameters<typeof Mascot>[0]["reaction"], score = 50) => renderToStaticMarkup(<Mascot score={score} size={120} reaction={reaction} />);

  it("dances with both arms up and a happy face", () => {
    const html = render("dance");
    expect(html).toContain('class="mp-dance"');
    expect(html).toContain('class="mp-arm-l"');
    expect(html).toContain('class="mp-arm-r"');
    expect(html).toContain("mp-burst");
  });

  it("thinks with thought puffs and a sweeping needle", () => {
    const html = render("think");
    expect(html.match(/mp-thought/g)).toHaveLength(3);
    expect(html).toContain("mp-ponder");
  });

  it("boils over with a shake and extra steam", () => {
    const html = render("boil");
    expect(html).toContain('class="mp-boil"');
    expect(html).toContain("mp-burst");
  });

  it("keeps the resting pose unchanged without a reaction", () => {
    const html = render("idle");
    expect(html).not.toMatch(/mp-dance|mp-boil|mp-thought|mp-ponder/);
  });

  it("does not dance while carried", () => {
    expect(renderToStaticMarkup(<Mascot score={50} size={120} reaction="dance" carried />)).not.toContain("mp-dance");
  });

  it("greets with a hop and a wave, even at Redline", () => {
    for (const score of [50, 95]) {
      const html = render("greet", score);
      expect(html).toContain('class="mp-hop"');
      expect(html).toContain('class="mp-wave"');
    }
    expect(renderToStaticMarkup(<Mascot score={50} size={120} reaction="greet" carried />)).not.toContain("mp-hop");
  });

  it("moves its mouth while talking, and only then", () => {
    expect(render("talk")).toContain('class="mp-talk"');
    expect(render("idle")).not.toContain("mp-talk");
  });
});
