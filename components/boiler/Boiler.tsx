"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { Status, Zone } from "@/lib/types";
import { STATUS_META, ZONE_LABEL, zoneOf } from "@/components/ui/zones";
import { Gauge } from "./Gauge";
import { BODY_PATH, TANK_PATH, VIEW, boilerVisuals, clampScore, wavePath } from "./geometry";
import { Steam } from "./Steam";

export interface BoilerProps {
  score: number;
  /** Defaults to the zone implied by the score. */
  zone?: Zone;
  /** sm = Engine Room tile (150px), lg = My Boiler (290px). */
  size?: "sm" | "lg";
  /** Overrides the size's width in px; "fluid" fills the parent (size it with CSS). */
  width?: number | "fluid";
  status?: Status;
  /** false renders a still boiler (no particles, shake or waves). */
  animate?: boolean;
  /** Firebox intensity 0–1, from the 7-day forecast. Defaults from the score. */
  fire?: number;
  /** Increment to fire a vent burst (a task was completed). */
  vent?: number;
  /** Visual whistle burst when the score crosses 90. Default: lg only. */
  whistle?: boolean;
  className?: string;
}

const WIDTH = { sm: 150, lg: 290 } as const;
const BODY_RIVETS = [112, 134, 156, 178, 200, 222];

export function Boiler({
  score,
  zone: zoneProp,
  size = "lg",
  width,
  status,
  animate = true,
  fire,
  vent = 0,
  whistle = size === "lg",
  className = "",
}: BoilerProps) {
  const s = Math.round(clampScore(score));
  const zone = zoneProp ?? zoneOf(s);
  const v = boilerVisuals(s, zone);
  const reduced = useReducedMotion();
  const still = !animate || !!reduced;
  // Off-screen (reported by Steam's IntersectionObserver): CSS loops pause in place and the shake stops.
  const [onScreen, setOnScreen] = useState(true);
  const paused = !still && !onScreen;
  const w = width ?? WIDTH[size];
  // Shake amplitude in CSS px per viewBox unit; fluid boilers assume ~240px.
  const px = w === "fluid" ? 1 : w / VIEW.w;
  const clipId = "bt" + useId().replace(/[^a-zA-Z0-9]/g, "");

  // Whistle when the score crosses 90 on the way up.
  const prev = useRef(s);
  const [whistleKey, setWhistleKey] = useState(0);
  const [whistling, setWhistling] = useState(false);
  useEffect(() => {
    const was = prev.current;
    prev.current = s;
    if (!whistle || !(was < 90 && s >= 90)) return;
    setWhistleKey((k) => k + 1);
    setWhistling(true);
    const t = setTimeout(() => setWhistling(false), 1500);
    return () => clearTimeout(t);
  }, [s, whistle]);

  const fireLevel = Math.max(0, Math.min(1, fire ?? v.fire));
  const label = `Pressure ${s} of 100, ${ZONE_LABEL[zone]}${status ? `, ${STATUS_META[status].label}` : ""}`;
  const lift = v.lift + (whistling ? 6 : 0);

  const shake = !still && onScreen && v.shake;
  const dur = (sec: number) => ({ "--dur": `${sec.toFixed(2)}s` }) as CSSProperties;

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: w === "fluid" ? "100%" : w }} data-still={still ? "" : undefined} data-paused={paused ? "" : undefined}>
      <motion.div
        className="relative"
        animate={shake ? { x: v.shake!.x.map((n) => n * px), y: v.shake!.y.map((n) => n * px) } : { x: 0, y: 0 }}
        transition={shake ? { duration: v.shake!.dur, repeat: Infinity, ease: "linear" } : { duration: 0.2 }}
      >
        <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} width="100%" role="img" aria-label={label} className="block overflow-visible">
          <defs>
            <clipPath id={clipId}>
              <path d={TANK_PATH} />
            </clipPath>
            <radialGradient id={`${clipId}-fire`}>
              <stop offset="0" stopColor="#FFB45E" stopOpacity="0.95" />
              <stop offset="0.45" stopColor="#F0913A" stopOpacity="0.55" />
              <stop offset="1" stopColor="#F0913A" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${clipId}-red`}>
              <stop offset="0.35" stopColor="#F24E3A" stopOpacity="0.55" />
              <stop offset="1" stopColor="#F24E3A" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${clipId}-steel`} x1="0" x2="1">
              <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.06" />
              <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="1" stopColor="#000000" stopOpacity="0.12" />
            </linearGradient>
          </defs>

          {/* Redline: a pulsing red halo behind the whole machine. */}
          {v.crack && (
            <ellipse
              cx="120"
              cy="170"
              rx="125"
              ry="140"
              fill={`url(#${clipId}-red)`}
              className="bp-glow"
              style={{ "--glow-lo": 0.35, "--glow-hi": 0.9 } as CSSProperties}
            />
          )}

          {/* Firebox glow, driven by the forecast. */}
          <ellipse
            cx="120"
            cy="284"
            rx="78"
            ry="22"
            fill={`url(#${clipId}-fire)`}
            className="bp-fire"
            style={{ "--fire-lo": (fireLevel * 0.55).toFixed(2), "--fire-hi": (fireLevel * 0.95).toFixed(2) } as CSSProperties}
          />

          <path
            d={BODY_PATH}
            fill="none"
            stroke={v.color}
            strokeWidth="12"
            className="bp-glow"
            style={{ "--glow-lo": v.glow.lo, "--glow-hi": v.glow.hi } as CSSProperties}
          />

          <path d={TANK_PATH} fill={v.color} opacity="0.07" />
          <path d={TANK_PATH} fill={`url(#${clipId}-steel)`} />

          <g clipPath={`url(#${clipId})`}>
            <g className="bp-level" style={{ transform: `translateY(${v.level}px)` }}>
              <g className="bp-bob" style={{ ...dur(v.bobDur), "--bob": `${v.bob.toFixed(1)}px` } as CSSProperties}>
                <g transform="translate(0 -5)">
                  <g className="bp-wave-l" style={dur(v.waveDur2)}>
                    <path d={wavePath(v.waveAmp * 0.7)} fill={v.color} opacity="0.3" />
                  </g>
                </g>
                <g className="bp-wave-r" style={dur(v.waveDur)}>
                  <path d={wavePath(v.waveAmp)} fill={v.color} opacity="0.6" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="1.5" />
                </g>
              </g>
            </g>
          </g>

          <path d={BODY_PATH} fill="none" stroke={v.color} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M58 98 V214" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="4" strokeLinecap="round" />
          <path d="M66 100 V128" stroke="#FFFFFF" strokeOpacity="0.12" strokeWidth="2" strokeLinecap="round" />

          {/* Riveted seams */}
          <g fill="#8C6A35">
            {BODY_RIVETS.map((y) => (
              <g key={y}>
                <circle cx="44" cy={y} r="1.7" />
                <circle cx="196" cy={y} r="1.7" />
              </g>
            ))}
          </g>

          {v.crack && (
            <g opacity="0.9" fill="none" stroke="#FFE7E0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M150 90 L158 104 L151 116 L162 134 L156 146" />
              <path d="M158 104 L168 108" />
              <path d="M62 236 L74 224 L70 212 L80 202" />
            </g>
          )}

          {/* Copper vent pipe on the flank */}
          <rect x="195" y="147" width="10" height="20" rx="2" fill="#B87333" />
          <rect x="203" y="144" width="4" height="26" rx="1.5" fill="#D1A85A" />

          {/* Smokestack */}
          <rect x="70" y="40" width="16" height="32" rx="2" fill="#1F1A14" stroke="#D1A85A" strokeWidth="2.5" />
          <rect x="64" y="34" width="28" height="8" rx="2" fill="#D1A85A" />

          {/* Safety valve / whistle */}
          <g className="bp-flutter" style={{ ...dur(whistling ? 0.08 : v.flutterDur), "--flutter": `${whistling ? -4 : v.flutter}px` } as CSSProperties}>
            <g className="bp-lift" style={{ transform: `translateY(${-lift}px)` }}>
              <rect x="118" y="52" width="6" height="20" fill="#D1A85A" />
              <rect x="110" y="46" width="22" height="7" rx="3" fill="#D1A85A" />
            </g>
          </g>

          <rect x="38" y="70" width="164" height="12" rx="6" fill="#1F1A14" stroke="#D1A85A" strokeWidth="2.5" />
          <g fill="#8C6A35">
            {[96, 104, 140].map((x) => (
              <circle key={x} cx={x} cy="76" r="1.6" />
            ))}
          </g>
          {status && <circle cx="50" cy="76" r="3.4" fill={STATUS_META[status].color} stroke="#15120E" strokeWidth="1" />}

          <Gauge score={s} color={v.color} still={still} />

          {/* Firebox */}
          <rect x="56" y="270" width="128" height="7" rx="3.5" fill="#D1A85A" />
          <g fill="#F0913A" opacity={fireLevel.toFixed(2)}>
            <path className="bp-flame" d="M92 290 q-6 -6 0 -14 q6 8 0 14 z" />
            <path className="bp-flame" style={{ animationDelay: "-0.3s" }} d="M120 290 q-7 -7 0 -16 q7 9 0 16 z" />
            <path className="bp-flame" style={{ animationDelay: "-0.6s" }} d="M148 290 q-6 -6 0 -14 q6 8 0 14 z" />
          </g>
          <rect x="70" y="277" width="6" height="16" fill="#6B5A44" />
          <rect x="164" y="277" width="6" height="16" fill="#6B5A44" />
        </svg>
        <Steam score={s} zone={zone} level={v.level} active={!still} vent={vent} whistle={whistleKey} onVisibility={setOnScreen} />
      </motion.div>
    </div>
  );
}
