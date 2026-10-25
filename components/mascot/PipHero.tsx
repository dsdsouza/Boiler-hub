"use client";

import { useEffect, useState } from "react";
import type { Status, Zone } from "@/lib/types";
import { Boiler } from "@/components/boiler/Boiler";
import { boilerVisuals, clampScore } from "@/components/boiler/geometry";
import { zoneOf } from "@/components/ui/zones";
import { Accessory } from "./Accessory";
import { heroExpression, type Expression, type HeroFace } from "./heroExpression";
import { MASCOT_NAME } from "./voice";
import type { AccessoryId } from "./wardrobe";
import "./mascot.css";

// The detailed Pip for My Boiler: the real boiler (gauge, steam, shake, whistle,
// vent, firebox, off-screen pause) wearing Pip's face, arms, feet and outfit.
// Coordinates are the boiler's viewBox (components/boiler/geometry.ts).

const COPPER = "#C8643B";
const BRASS = "#D1A85A";
const INK = "#15120E";
const PARCHMENT = "#F1E7D3";

/** The boiler's gauge, moved from the shoulder to Pip's right eye (his monocle). */
const GAUGE_EYE = "translate(152 163) scale(0.85) translate(-180 -66)";

/**
 * Accessories are drawn in Mascot.tsx's viewBox. Hats perch tilted on the boiler's free right
 * shoulder (the gauge moved to the face), clear of the smokestack and the safety valve, which
 * whistles at 90. Each is fitted so its brim never reaches the valve (x 110–132).
 */
const PLACEMENT: Record<Exclude<AccessoryId, "none">, string> = {
  "top-hat": "translate(165 71) rotate(12) scale(1.45) translate(-60 -34)",
  // Mirrored so the bill points outward, away from the valve.
  "engineer-cap": "translate(165 71) rotate(12) scale(-1.45 1.45) translate(-60 -34)",
  "hard-hat": "translate(166 71) rotate(12) scale(1.35) translate(-60 -34)",
  "grad-cap": "translate(176 71) rotate(12) scale(1.15) translate(-60 -34)",
  goggles: "translate(120 70) scale(2) translate(-60 -32)",
  "bow-tie": "translate(120 70) scale(2) translate(-60 -32)",
};
/** The hero's dance after a completed task; matches .mp-hero-dance (1 s × 3). */
const CELEBRATE_MS = 3000;

export interface PipHeroProps {
  score: number;
  zone?: Zone;
  status?: Status;
  width?: number | "fluid";
  /** Firebox intensity 0–1, from the forecast. */
  fire?: number;
  /** Increment when a task is completed: steam vents and Pip celebrates. */
  vent?: number;
  accessory?: AccessoryId;
  face?: HeroFace;
  animate?: boolean;
  whistle?: boolean;
  className?: string;
}

export function PipHero({
  score,
  zone: zoneProp,
  status,
  width = "fluid",
  fire,
  vent = 0,
  accessory = "none",
  face = "expressive",
  animate = true,
  whistle,
  className = "",
}: PipHeroProps) {
  const s = Math.round(clampScore(score));
  const zone = zoneProp ?? zoneOf(s);
  const { level } = boilerVisuals(s, zone);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (!vent) return;
    setCelebrating(true);
    const t = setTimeout(() => setCelebrating(false), CELEBRATE_MS);
    return () => clearTimeout(t);
  }, [vent]);

  const e = heroExpression(zone, { celebrating, face });
  // Features above the waterline sit on dark glass, so they switch to parchment.
  const ink = (y: number) => (y < level ? PARCHMENT : INK);

  return (
    // A class toggle, not a key, so the boiler (gauge spring, steam canvas) never remounts.
    <div className={`${celebrating && animate ? "mp-hero-dance" : ""} ${className}`}>
      <Boiler
        score={s}
        zone={zone}
        status={status}
        width={width}
        fire={fire}
        vent={vent}
        animate={animate}
        whistle={whistle}
        name={MASCOT_NAME}
        gaugeTransform={GAUGE_EYE}
        overlay={<PipOverlay e={e} ink={ink} accessory={accessory} />}
      />
    </div>
  );
}

function PipOverlay({ e, ink, accessory }: { e: Expression; ink: (y: number) => string; accessory: AccessoryId }) {
  const limb = { fill: "none", stroke: COPPER, strokeWidth: 9, strokeLinecap: "round" } as const;
  const line = (y: number, w = 6) => ({ fill: "none", stroke: ink(y), strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round" }) as const;
  return (
    <g>
      {/* Arms */}
      {e.arm === "cheer" ? (
        <g className="mp-hero-arm-l">
          <path d="M45 188 q-23 -2 -29 -19" {...limb} />
          <circle cx="16" cy="169" r="7.5" fill={COPPER} />
        </g>
      ) : (
        <>
          <path d="M45 188 q-25 8 -29 34" {...limb} />
          <circle cx="15.5" cy="222" r="7.5" fill={COPPER} />
        </>
      )}
      {e.arm === "cheer" ? (
        <g className="mp-hero-arm-r">
          <path d="M195 188 q23 -2 29 -19" {...limb} />
          <circle cx="224" cy="169" r="7.5" fill={COPPER} />
        </g>
      ) : e.arm === "wave" ? (
        <g className="mp-wave" style={{ transformBox: "view-box", transformOrigin: "195px 188px" }}>
          <path d="M195 188 q25 -6 31 -36" {...limb} />
          <circle cx="226" cy="152" r="7.5" fill={COPPER} />
        </g>
      ) : e.arm === "raised" ? (
        <>
          <path d="M195 188 q23 -2 29 -19" {...limb} />
          <circle cx="224" cy="169" r="7.5" fill={COPPER} />
        </>
      ) : (
        <>
          <path d="M195 188 q25 8 29 34" {...limb} />
          <circle cx="224" cy="222" r="7.5" fill={COPPER} />
        </>
      )}

      {/* Feet on the boiler's legs */}
      <ellipse cx="73" cy="296" rx="13" ry="6.5" fill={COPPER} />
      <ellipse cx="167" cy="296" rx="13" ry="6.5" fill={COPPER} />

      {/* Brows: worried lifts the inner ends; raised is flat and high */}
      {e.brows === "worried" && <path d="M74 149 L99 141 M134 131 L163 137" {...line(138, 5.5)} />}
      {e.brows === "raised" && <path d="M74 144 L100 142 M131 128 L165 128" {...line(135, 5.5)} />}

      {/* Left eye (the right one is the gauge) */}
      <g className="mp-blink">
        {e.eye === "happy" ? <path d="M78 169 q10 -12 20 0" {...line(165)} /> : <circle cx="88" cy="165" r="10" fill={ink(165)} />}
      </g>

      {/* Monocle chain from the gauge eye */}
      <path d="M170 182 c7 12 7 26 0 36" fill="none" stroke={BRASS} strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="68" cy="190" rx="13" ry="7.5" fill="#E8857A" opacity="0.55" />

      <Mouth kind={e.mouth} ink={ink(205)} />

      {e.sweat && <path className="mp-drip" d="M184 104 q8 13 0 19 q-8 -6 0 -19z" fill="#7FB3D5" />}

      {accessory !== "none" && (
        <g transform={PLACEMENT[accessory]}>
          <Accessory id={accessory} detail stack="none" />
        </g>
      )}
    </g>
  );
}

function Mouth({ kind, ink }: { kind: Expression["mouth"]; ink: string }) {
  const stroke = { fill: "none", stroke: ink, strokeWidth: 6, strokeLinecap: "round" } as const;
  switch (kind) {
    case "open":
      return <path d="M100 199 q20 24 40 0 z" fill={ink} stroke={ink} strokeWidth="3.5" strokeLinejoin="round" />;
    case "o":
      return <ellipse cx="120" cy="207" rx="8" ry="9.5" fill={ink} />;
    case "wavy":
      return <path d="M103 207 q8.5 -7 17 0 t17 0" {...stroke} />;
    case "grin":
      return <path d="M102 200 q18 18 36 0" {...stroke} />;
    case "smile":
      return <path d="M106 203 q14 11 28 0" {...stroke} />;
  }
}
