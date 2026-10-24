import type { Zone } from "@/lib/types";

// Pip's face on the big hero. "expressive" is for your own boiler. "calm" is for
// showing someone else's Pip (team views): load reads through water, steam and
// color, never through a worried face, because the gauge measures load, not feelings.

export type HeroFace = "expressive" | "calm";

export interface Expression {
  eye: "open" | "happy";
  brows: "none" | "worried" | "raised";
  /** grin: cool, smile: working or calm, wavy: hot, o: redline, open: celebrating. */
  mouth: "grin" | "smile" | "wavy" | "o" | "open";
  arm: "down" | "wave" | "raised";
  sweat: boolean;
}

export function heroExpression(zone: Zone, { celebrating = false, face = "expressive" }: { celebrating?: boolean; face?: HeroFace } = {}): Expression {
  if (celebrating) return { eye: "happy", brows: "none", mouth: "open", arm: "raised", sweat: false };
  if (face === "calm") return { eye: "open", brows: "none", mouth: "smile", arm: "down", sweat: false };
  switch (zone) {
    case "cool":
      return { eye: "open", brows: "none", mouth: "grin", arm: "wave", sweat: false };
    case "working":
      return { eye: "open", brows: "none", mouth: "smile", arm: "down", sweat: false };
    case "hot":
      return { eye: "open", brows: "worried", mouth: "wavy", arm: "down", sweat: true };
    case "redline":
      return { eye: "open", brows: "raised", mouth: "o", arm: "raised", sweat: false };
  }
}
