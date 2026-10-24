import type { Zone } from "@/lib/types";

// Geometry and motion parameters for the boiler, ported from docs/design/Boiler.dc.html.
// SVG coordinates use viewBox "0 -40 240 340".

export const VIEW = { x: 0, y: -40, w: 240, h: 340 } as const;

/** Inner tank outline; liquid and bubbles are clipped to it. */
export const TANK_PATH = "M47 82 V228 Q47 263 82 263 H158 Q193 263 193 228 V82 Z";
export const BODY_PATH = "M44 80 V228 Q44 266 82 266 H158 Q196 266 196 228 V80";

/** Liquid and outline color per zone (brighter than the UI zone fills, as designed). */
export const BOILER_COLOR: Record<Zone, string> = {
  cool: "#5EAEE8",
  working: "#EBC44E",
  hot: "#F2913D",
  redline: "#F24E3A",
};

/** Gauge arc: 240° of a r=20 circle. */
export const ARC_LEN = 83.78;
export const ARC_CIRC = 125.66;

export function clampScore(score: number) {
  return Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
}

export function needleAngle(score: number) {
  return -120 + 2.4 * clampScore(score);
}

export function wavePath(amplitude: number) {
  let d = `M-160 0 q20 ${(-amplitude).toFixed(1)} 40 0`;
  for (let i = 0; i < 13; i++) d += " t40 0";
  return `${d} V340 H-160 Z`;
}

export interface BoilerVisuals {
  color: string;
  /** Liquid surface y. */
  level: number;
  waveAmp: number;
  waveDur: number;
  waveDur2: number;
  bob: number;
  bobDur: number;
  /** Safety valve lift. */
  lift: number;
  flutter: number;
  flutterDur: number;
  /** Shake keyframes in viewBox units, and period in seconds. */
  shake: { x: number[]; y: number[]; dur: number } | null;
  glow: { lo: number; hi: number };
  crack: boolean;
  /** Default firebox intensity when no forecast is known. */
  fire: number;
}

export function boilerVisuals(score: number, zone: Zone): BoilerVisuals {
  const s = clampScore(score);
  const red = zone === "redline";
  const hot = zone === "hot";
  return {
    color: BOILER_COLOR[zone],
    level: Math.round(248 - s * 1.5),
    waveAmp: 1.5 + s * 0.1,
    waveDur: Math.max(0.8, 4.2 - s * 0.034),
    waveDur2: Math.max(1.1, 5.2 - s * 0.04),
    bob: s * 0.045,
    bobDur: Math.max(0.45, 2.4 - s * 0.019),
    lift: s * 0.07,
    flutter: red ? -5 : hot ? -2 : 0,
    flutterDur: red ? 0.12 : 0.3,
    shake: red
      ? { x: [0, 2.4, -2.4, 1.2, 0], y: [0, -0.6, 0.6, 0, 0], dur: 0.14 }
      : hot
        ? { x: [0, 0.7, -0.7, 0], y: [0, 0, 0.3, 0], dur: 0.26 }
        : null,
    glow: red ? { lo: 0.15, hi: 0.5 } : { lo: 0, hi: 0 },
    crack: red,
    fire: Math.min(1, 0.2 + s / 130),
  };
}

export interface SteamParams {
  /** Stack puffs spawned per second. */
  puffRate: number;
  puffLife: number;
  puffRadius: number;
  puffAlpha: number;
  /** Sight-glass bubbles spawned per second. */
  bubbleRate: number;
  bubbleLife: number;
  bubbleMax: number;
  /** Redline: valve and side-vent bursts. */
  burst: boolean;
}

/**
 * Particle density for the canvas layer. Rises continuously with the score so
 * small changes are visible; at Redline the sight glass rolls to a full boil.
 */
export function steamParams(score: number, zone: Zone): SteamParams {
  const s = clampScore(score);
  const t = s / 100;
  const puffLife = Math.max(1.1, 3.6 - s * 0.024);
  const bubbleLife = Math.max(0.6, 2.6 - s * 0.02);
  const inFlight = s < 20 ? 0 : zone === "redline" ? 22 : ((s - 20) / 70) * 10;
  return {
    puffRate: (0.5 + 5.5 * t * t) / puffLife * 1.6,
    puffLife,
    puffRadius: { cool: 9, working: 13, hot: 17, redline: 22 }[zone],
    puffAlpha: { cool: 0.18, working: 0.35, hot: 0.5, redline: 0.7 }[zone],
    bubbleRate: inFlight / bubbleLife,
    bubbleLife,
    bubbleMax: 2 + t * 2.5,
    burst: zone === "redline",
  };
}

/** Firebox intensity from the 7-day forecast: near days weigh most ("the fire is already lit"). */
export function fireFromForecast(scores: number[]): number {
  if (!scores.length) return 0.4;
  let sum = 0;
  let wsum = 0;
  scores.forEach((s, i) => {
    const w = 1 / (1 + 0.35 * i);
    sum += clampScore(s) * w;
    wsum += w;
  });
  return Math.min(1, Math.max(0.1, (sum / wsum / 100) * 1.15));
}
