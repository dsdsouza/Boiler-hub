"use client";

import { useSpring } from "framer-motion";
import { useEffect, useRef } from "react";
import { ARC_CIRC, ARC_LEN, clampScore, needleAngle } from "./geometry";

/**
 * Brass pressure gauge on the boiler's shoulder. The needle swings on a
 * Framer Motion spring with a slight overshoot and settle; under reduced
 * motion it jumps. The spring writes SVG attributes directly, so a swing
 * never re-renders React.
 */
export function Gauge({ score, color, still }: { score: number; color: string; still: boolean }) {
  const s = clampScore(score);
  const spring = useSpring(s, { stiffness: 110, damping: 11, mass: 1 });
  const needle = useRef<SVGGElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  // Render the first value only; afterwards the spring owns these attributes,
  // so a re-render never snaps the needle to its target.
  const initial = useRef(s).current;

  useEffect(() => {
    const paint = (v: number) => {
      // Let the needle overshoot a hair past the stops, like a real gauge.
      needle.current?.setAttribute("transform", `rotate(${(-120 + 2.4 * Math.max(-3, Math.min(103, v))).toFixed(2)} 180 66)`);
      arc.current?.setAttribute("stroke-dasharray", `${((ARC_LEN * clampScore(v)) / 100).toFixed(2)} ${ARC_CIRC}`);
    };
    paint(spring.get());
    return spring.on("change", paint);
  }, [spring]);

  useEffect(() => {
    if (still) spring.jump(s);
    else spring.set(s);
  }, [s, still, spring]);

  return (
    <g>
      <circle cx="180" cy="66" r="27" fill="#15120E" stroke="#D1A85A" strokeWidth="3" />
      {[45, 135, 225, 315].map((a) => (
        <circle key={a} cx={180 + 23.6 * Math.cos((a * Math.PI) / 180)} cy={66 + 23.6 * Math.sin((a * Math.PI) / 180)} r="1.1" fill="#8C6A35" />
      ))}
      <circle cx="180" cy="66" r="20" fill="none" stroke="#3A3027" strokeWidth="4" strokeDasharray={`${ARC_LEN} ${ARC_CIRC}`} transform="rotate(150 180 66)" />
      <circle
        ref={arc}
        cx="180"
        cy="66"
        r="20"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={`${((ARC_LEN * initial) / 100).toFixed(2)} ${ARC_CIRC}`}
        transform="rotate(150 180 66)"
      />
      <g ref={needle} transform={`rotate(${needleAngle(initial)} 180 66)`}>
        <line x1="180" y1="68" x2="180" y2="51" stroke="#F1E7D3" strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <circle cx="180" cy="66" r="3" fill="#D1A85A" />
      <text x="180" y="86" textAnchor="middle" fontSize="9" fontWeight="700" fill={color} style={{ fontFamily: "var(--font-mono)" }}>
        {Math.round(s)}
      </text>
    </g>
  );
}
