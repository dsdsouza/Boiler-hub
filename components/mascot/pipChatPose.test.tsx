import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BOUNCE_MS, DOZE_AFTER_MS, LISTEN_MS, NOD_MS, chatReaction } from "./pipChatPose";
import { Mascot } from "./Mascot";

vi.mock("./mascot.css", () => ({}));

const base = { thinking: false, talking: false, pose: null, cue: null, greeting: false, base: "idle" } as const;

describe("chatReaction", () => {
  it("nods on send before thinking, then thinks and talks ahead of everything else", () => {
    expect(chatReaction({ ...base, thinking: true, pose: "nod" })).toBe("nod");
    expect(chatReaction({ ...base, thinking: true, pose: "listen", cue: "dance" })).toBe("think");
    expect(chatReaction({ ...base, talking: true, pose: "bounce", greeting: true })).toBe("talk");
  });

  it("shows chat body language ahead of cues and the greeting", () => {
    for (const pose of ["listen", "nod", "bounce"] as const) {
      expect(chatReaction({ ...base, pose, cue: "dance", greeting: true })).toBe(pose);
    }
  });

  it("lets a cue or the greeting wake a dozing Pip", () => {
    expect(chatReaction({ ...base, pose: "doze", cue: "boil" })).toBe("boil");
    expect(chatReaction({ ...base, pose: "doze", greeting: true })).toBe("greet");
    expect(chatReaction({ ...base, pose: "doze" })).toBe("doze");
  });

  it("falls back to the dock's own expression", () => {
    expect(chatReaction({ ...base, base: "attentive" })).toBe("attentive");
  });

  it("keeps brief poses brief and dozing patient", () => {
    expect(NOD_MS).toBe(700); // mp-nod: 0.35 s × 2
    expect(BOUNCE_MS).toBe(600); // mp-bop: 0.6 s × 1
    expect(LISTEN_MS).toBeGreaterThanOrEqual(1000);
    expect(DOZE_AFTER_MS).toBeGreaterThanOrEqual(30_000);
  });
});

describe("Mascot chat poses", () => {
  const render = (reaction: Parameters<typeof Mascot>[0]["reaction"], score = 50) => renderToStaticMarkup(<Mascot score={score} size={120} reaction={reaction} />);

  it("leans in to listen", () => {
    expect(render("listen")).toContain('class="mp-lean"');
  });

  it("nods and bounces", () => {
    expect(render("nod")).toContain('class="mp-nod"');
    const bounce = render("bounce");
    expect(bounce).toContain('class="mp-bop"');
    expect(bounce).toContain('d="M44.5 71 q3.5 -4 7 0"'); // happy eye
  });

  it("dozes with closed eyes, slow steam and drifting Zs", () => {
    const html = render("doze");
    expect(html).toContain('class="mp-doze"');
    expect(html).toContain('d="M44.5 70 q3.5 3 7 0"'); // closed eye
    expect(html).not.toContain("mp-blink");
    expect(html.match(/d="M-3 -3 H3 L-3 3 H3"/g)).toHaveLength(3);
    expect(html).toContain("--dur:6s");
  });

  it("holds still while carried", () => {
    for (const reaction of ["listen", "nod", "bounce", "doze"] as const) {
      expect(renderToStaticMarkup(<Mascot score={50} size={120} reaction={reaction} carried />)).not.toMatch(/mp-lean|mp-nod|mp-bop|mp-doze/);
    }
  });
});
