import { useId } from "react";
import type { Zone } from "@/lib/types";
import { ZONE_FILL, zoneOf } from "@/components/ui/zones";
import { Accessory } from "./Accessory";
import type { Reaction } from "./voice";
import type { AccessoryId } from "./wardrobe";
import "./mascot.css";

// Pip, the Boilerplate companion: a glass boiler with a gauge eye, brass rim,
// chimney, little arms and feet (from .local/references/selected-mascot-four-states.png),
// rebuilt as plain vector shapes so it stays crisp from 24px to hero size.

const BRASS = "#D1A85A";
const BRASS_LIGHT = "#E3BE74";
const BRASS_DARK = "#8C6A35";
const COPPER = "#C8643B";
const INK = "#15120E";
const PARCHMENT = "#F1E7D3";
const GLASS = "#1C1E22";

const VIEW = { x: -8, y: -18, w: 136, h: 156 };
/** Glass interior bounds in viewBox units. */
const GLASS_TOP = 42;
const GLASS_BOTTOM = 112;

/** Steam puffs above the chimney per zone: [x, y, r, delay, drift]. */
const PUFFS: Record<Zone, [number, number, number, number, number][]> = {
  cool: [[60, 2, 4.5, 0, 2]],
  working: [
    [58, 2, 5, 0, -3],
    [64, -6, 4, 1.2, 4],
  ],
  hot: [
    [57, 2, 5.5, 0, -4],
    [64, -5, 5, 0.8, 5],
    [70, -11, 3.5, 1.6, 8],
  ],
  redline: [
    [56, 2, 6, 0, -6],
    [64, -5, 6, 0.6, 5],
    [50, -10, 4.5, 1.2, -9],
    [72, -12, 4.5, 1.8, 10],
  ],
};

const BUBBLES = [
  [40, 104, 1.8, 0],
  [62, 108, 1.4, 0.7],
  [78, 102, 2, 1.3],
  [52, 106, 1.2, 1.9],
] as const;

export interface MascotProps {
  /** 0–100. Drives zone, water level and the gauge-eye needle. */
  score: number;
  /** Rendered width in px. Below 56 the small-size drawing drops fine detail. */
  size?: number;
  reaction?: Reaction;
  /** Nearly empty glass, for the empty state. */
  empty?: boolean;
  /** Accessible name. Omit to keep Pip decorative (aria-hidden). */
  label?: string;
  /** Cosmetic from the wardrobe. Purely visual. */
  accessory?: AccessoryId;
  className?: string;
  /** Arms reach up to the grab point while the floating companion is carried. */
  carried?: boolean;
}

export function Mascot({ score, size = 120, reaction = "idle", empty, label, accessory = "none", className = "", carried = false }: MascotProps) {
  const zone = zoneOf(score);
  const color = ZONE_FILL[zone];
  const detail = size >= 56;
  const clip = useId();

  const fill = empty ? 0.08 : 0.16 + (0.76 * Math.max(0, Math.min(score, 100))) / 100;
  const level = GLASS_BOTTOM - fill * (GLASS_BOTTOM - GLASS_TOP);
  // Gauge-eye needle sweeps −120° (0) to +120° (100), like the dial.
  const angle = -120 + 2.4 * Math.max(0, Math.min(score, 100));
  // Features above the waterline sit on dark glass, so they switch to parchment.
  const ink = (y: number) => (y < level ? PARCHMENT : INK);

  const dancing = reaction === "dance" && !carried;
  const thinking = reaction === "think";
  const boiling = reaction === "boil";
  const celebrating = reaction === "celebrate" || dancing;
  const attentive = reaction === "attentive" || boiling || zone === "redline";
  const greeting = reaction === "greet" && !carried;
  const waving = reaction === "wave" || greeting || (reaction === "idle" && zone === "cool" && !empty);
  const dozing = reaction === "doze";
  const CHAT_MOTION: Partial<Record<Reaction, string>> = { listen: "mp-lean", nod: "mp-nod", bounce: "mp-bop", doze: "mp-doze" };
  const motion = dancing ? "mp-dance" : boiling ? "mp-boil" : celebrating || greeting ? "mp-hop" : carried ? undefined : CHAT_MOTION[reaction];
  const puffs = empty ? [] : detail ? PUFFS[zone] : PUFFS[zone].slice(0, 2);
  const stroke = detail ? 3.5 : 5;

  return (
    <svg
      width={size}
      height={(size * VIEW.h) / VIEW.w}
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={`flex-none overflow-visible ${className}`}
      data-zone={zone}
    >
      <ellipse cx="60" cy="130" rx="30" ry="4" fill="#000" opacity={carried ? 0 : 0.28} />

      <g key={motion ?? "rest"} className={motion}>
        {/* Steam */}
        {puffs.map(([x, y, r, delay, dx], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={r}
            fill={zone === "cool" ? "var(--rivet)" : "var(--steam)"}
            className="mp-steam"
            style={{ "--delay": `${delay}s`, "--dx": `${dx}px`, "--dur": dozing ? "6s" : zone === "redline" ? "2s" : "3.2s", "--o": zone === "cool" ? 0.7 : 0.85 } as React.CSSProperties}
          />
        ))}
        {(celebrating || boiling) &&
          [
            [52, 4, 6, -10, -16, 0],
            [68, 2, 6, 10, -18, 0.08],
            [60, -4, 5, 0, -24, 0.16],
          ].map(([x, y, r, dx, dy, delay], i) => (
            <circle
              key={`b${i}`}
              cx={x}
              cy={y}
              r={r}
              fill="var(--steam)"
              className="mp-burst"
              style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, "--delay": `${delay}s` } as React.CSSProperties}
            />
          ))}
        {thinking && detail &&
          [
            [88, 34, 2.4, 0],
            [97, 24, 3.4, 0.3],
            [108, 10, 5, 0.6],
          ].map(([x, y, r, delay], i) => (
            <circle key={`t${i}`} cx={x} cy={y} r={r} fill="var(--steam)" className="mp-thought" style={{ "--delay": `${delay}s` } as React.CSSProperties} />
          ))}
        {dozing && detail &&
          [
            [86, 30, 0.7, 0],
            [95, 18, 0.95, 0.9],
            [105, 4, 1.2, 1.8],
          ].map(([x, y, s, delay], i) => (
            // The CSS animation owns the path's transform, so placement lives on the group.
            <g key={`z${i}`} transform={`translate(${x} ${y}) scale(${s})`}>
              <path
                d="M-3 -3 H3 L-3 3 H3"
                fill="none"
                stroke="var(--steam)"
                strokeWidth={1.6 / s}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mp-thought"
                style={{ "--delay": `${delay}s`, animationDuration: "2.7s" } as React.CSSProperties}
              />
            </g>
          ))}
        {(zone === "redline" || boiling) && detail && !empty && (
          <>
            <circle cx="8" cy="118" r="5" fill="var(--steam)" className="mp-steam" style={{ "--delay": "0.4s", "--dx": "-8px", "--o": 0.7 } as React.CSSProperties} />
            <circle cx="112" cy="114" r="5" fill="var(--steam)" className="mp-steam" style={{ "--delay": "1.4s", "--dx": "8px", "--o": 0.7 } as React.CSSProperties} />
          </>
        )}

        {/* Chimney and brass rim */}
        <rect x="54" y="14" width="12" height="20" rx="1.5" fill={COPPER} />
        <rect x="50" y="9" width="20" height="6" rx="2" fill={BRASS} />
        <rect x="20" y="32" width="80" height="11" rx="5.5" fill={BRASS} />
        <rect x="23" y="39.5" width="74" height="3.5" rx="1.75" fill={BRASS_DARK} opacity="0.55" />

        {/* Arms (behind the glass) */}
        {carried ? <g data-pip-grip fill="none" stroke={COPPER} strokeWidth="5" strokeLinecap="round">
          <path d="M28 80 C8 47 28 7 57 4" />
          <path d="M92 80 C112 47 92 7 63 4" />
          <circle cx="57" cy="4" r="3.6" fill={COPPER} stroke="none" />
          <circle cx="63" cy="4" r="3.6" fill={COPPER} stroke="none" />
        </g> : dancing ? <>
        <g className="mp-arm-l">
          <path d="M28 80 q-11 -1 -14 -9" fill="none" stroke={COPPER} strokeWidth="5" strokeLinecap="round" />
          <circle cx="14" cy="71" r="3.6" fill={COPPER} />
        </g>
        <g className="mp-arm-r">
          <path d="M92 80 q11 -1 14 -9" fill="none" stroke={COPPER} strokeWidth="5" strokeLinecap="round" />
          <circle cx="106" cy="71" r="3.6" fill={COPPER} />
        </g>
        </> : <>
        <path d="M28 80 q-12 4 -14 16" fill="none" stroke={COPPER} strokeWidth="5" strokeLinecap="round" />
        <circle cx="14" cy="96" r="3.6" fill={COPPER} />
        {waving ? (
          <g className="mp-wave">
            <path d="M92 80 q12 -3 15 -17" fill="none" stroke={COPPER} strokeWidth="5" strokeLinecap="round" />
            <circle cx="107" cy="62" r="3.6" fill={COPPER} />
          </g>
        ) : (
          <>
            <path d={attentive ? "M92 80 q11 -1 14 -9" : "M92 80 q12 4 14 16"} fill="none" stroke={COPPER} strokeWidth="5" strokeLinecap="round" />
            <circle cx="106" cy={attentive ? 71 : 96} r="3.6" fill={COPPER} />
          </>
        )}

        </>}

        {/* Legs and feet */}
        <g className={carried ? "mp-dangle" : undefined}>
        <rect x="45" y="110" width="7" height="12" rx="2" fill={BRASS_LIGHT} />
        <rect x="68" y="110" width="7" height="12" rx="2" fill={BRASS_LIGHT} />
        <ellipse cx="48" cy="124" rx="6.5" ry="3.6" fill={COPPER} />
        <ellipse cx="72" cy="124" rx="6.5" ry="3.6" fill={COPPER} />
        </g>

        {/* Glass body */}
        <clipPath id={clip}>
          <rect x="26" y="42" width="68" height="70" rx="16" />
        </clipPath>
        <g clipPath={`url(#${clip})`}>
          <rect x="26" y="42" width="68" height="70" fill={GLASS} />
          <rect x="26" y="42" width="68" height="70" fill={color} opacity="0.16" />
          <g className="mp-level" style={{ transform: `translateY(${level}px)` }}>
            <path
              className="mp-water-l"
              style={{ "--dur": "7s" } as React.CSSProperties}
              d="M-80 1 q20 -4 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V90 H-80 Z"
              fill={color}
              opacity="0.5"
            />
            <path
              className="mp-water-r"
              style={{ "--dur": zone === "redline" ? "2.2s" : zone === "hot" ? "3s" : "4.5s" } as React.CSSProperties}
              d="M-80 3 q20 -5 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V90 H-80 Z"
              fill={color}
              opacity="0.92"
            />
          </g>
          {detail &&
            (zone === "hot" || zone === "redline") &&
            !empty &&
            BUBBLES.slice(0, zone === "redline" ? 4 : 3).map(([x, y, r, delay], i) => (
              <circle key={i} cx={x} cy={y} r={r} fill="#fff" className="mp-bubble" style={{ "--delay": `${delay}s`, "--dur": zone === "redline" ? "1.6s" : "2.4s" } as React.CSSProperties} />
            ))}
          {detail && <rect x="32" y="50" width="4" height="30" rx="2" fill="#fff" opacity="0.26" />}
          {detail && zone === "redline" && !empty && (
            <path d="M88 44 l-4 8 l5 4 l-4 9 M30 96 l5 -4 l-1 -6" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
          )}
        </g>
        <rect x="26" y="42" width="68" height="70" rx="16" fill="none" stroke={color} strokeWidth={stroke} />

        {/* Face */}
        {detail && zone === "hot" && !attentive && (
          <path d="M43 62 L51 59.5 M65 57.5 L74 60" stroke={ink(60)} strokeWidth="2" strokeLinecap="round" />
        )}
        {detail && attentive && <path d="M43 60.5 L51 59.5 M64 55.5 L75 55.5" stroke={ink(58)} strokeWidth="2" strokeLinecap="round" />}

        <g className={dozing ? undefined : "mp-blink"} transform={thinking ? "translate(1 -2.5)" : reaction === "listen" ? "translate(-1.5 -0.5)" : undefined}>
          {celebrating || reaction === "bounce" ? (
            <path d="M44.5 71 q3.5 -4 7 0" fill="none" stroke={ink(70)} strokeWidth="2.4" strokeLinecap="round" />
          ) : dozing ? (
            <path d="M44.5 70 q3.5 3 7 0" fill="none" stroke={ink(70)} strokeWidth="2.4" strokeLinecap="round" />
          ) : (
            <circle cx="48" cy="70" r={detail ? 3.6 : 4.4} fill={ink(70)} />
          )}
        </g>

        {/* Gauge eye (the monocle) */}
        <circle cx="70" cy="69" r="8.5" fill={PARCHMENT} stroke={BRASS} strokeWidth={detail ? 2.6 : 3.2} />
        {detail && (
          <path d="M64.5 73.5 l1.2 -1 M70 61.8 v1.6 M75.5 73.5 l-1.2 -1" stroke={INK} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
        )}
        <line
          x1="70"
          y1="69"
          x2="70"
          y2="63.4"
          stroke={zone === "cool" ? INK : "#B3301C"}
          strokeWidth={detail ? 1.8 : 2.4}
          strokeLinecap="round"
          className={thinking ? "mp-level mp-ponder" : "mp-level"}
          style={{ transformBox: "view-box", transformOrigin: "70px 69px", transform: `rotate(${angle}deg)`, "--a": `${angle}deg` } as React.CSSProperties}
        />
        <circle cx="70" cy="69" r={detail ? 1.7 : 2.2} fill={INK} />
        {detail && <path d="M77 74 c3 5 3 11 0 15" fill="none" stroke={BRASS} strokeWidth="1.2" strokeLinecap="round" />}

        {detail && !empty && <ellipse cx="41" cy="79" rx="4.5" ry="2.6" fill="#E8857A" opacity="0.55" />}

        <Mouth zone={zone} reaction={reaction} attentive={attentive} empty={empty} detail={detail} ink={ink(85)} />

        {detail && zone === "hot" && !attentive && (
          <path className="mp-drip" d="M88 50 q3.2 5 0 7.4 q-3.2 -2.4 0 -7.4z" fill="#7FB3D5" />
        )}

        <Accessory id={accessory} detail={detail} />
      </g>
    </svg>
  );
}

function Mouth({ zone, reaction, attentive, empty, detail, ink }: { zone: Zone; reaction: Reaction; attentive: boolean; empty?: boolean; detail: boolean; ink: string }) {
  const w = detail ? 2.2 : 2.8;
  if (reaction === "doze") return <path d="M55.5 85 h6" fill="none" stroke={ink} strokeWidth={w} strokeLinecap="round" />;
  if (reaction === "bounce") return <path d="M52 82 q6.5 8 13 0 z" fill={ink} stroke={ink} strokeWidth="1.4" strokeLinejoin="round" />;
  if (reaction === "talk") return <ellipse className="mp-talk" cx="58.5" cy="84.5" rx="3.6" ry="2.6" fill={ink} />;
  if (reaction === "greet") return <path d="M53 83 q5.5 5.5 11 0" fill="none" stroke={ink} strokeWidth={w} strokeLinecap="round" />;
  if (reaction === "think") return <path d="M55 85 q2 -1.2 4 -0.4 t4 0.4" fill="none" stroke={ink} strokeWidth={w} strokeLinecap="round" />;
  if (reaction === "celebrate" || reaction === "dance") return <path d="M52 82 q6.5 8 13 0 z" fill={ink} stroke={ink} strokeWidth="1.4" strokeLinejoin="round" />;
  if (attentive) return <ellipse cx="58.5" cy="85" rx="2.6" ry="3.1" fill={ink} />;
  if (zone === "hot") return <path d="M52.5 85 q2.6 -2.2 5.2 0 t5.2 0" fill="none" stroke={ink} strokeWidth={w} strokeLinecap="round" />;
  if (zone === "working" || empty) return <path d="M54 84 q4.5 3.6 9 0" fill="none" stroke={ink} strokeWidth={w} strokeLinecap="round" />;
  return <path d="M53 83 q5.5 5.5 11 0" fill="none" stroke={ink} strokeWidth={w} strokeLinecap="round" />;
}
