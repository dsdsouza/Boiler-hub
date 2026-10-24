import type { Zone } from "@/lib/types";
import { C, ZONE_COLOR } from "./_theme";

// TODO(merge): swap for <Boiler score zone size="sm" status animate /> from components/boiler
// once the ui track lands it. Simple semicircle gauge until then.
export function PlaceholderGauge({ score, zone, width = 150 }: { score: number; zone: Zone; width?: number }) {
  const angle = -90 + (Math.min(Math.max(score, 0), 100) / 100) * 180;
  const arc = (from: number, to: number) => {
    const p = (v: number) => {
      const a = Math.PI * (1 - v / 100);
      return `${60 + 48 * Math.cos(a)} ${60 - 48 * Math.sin(a)}`;
    };
    return `M ${p(from)} A 48 48 0 0 1 ${p(to)}`;
  };
  return (
    <svg width={width} height={width * 0.6} viewBox="0 0 120 72" role="img" aria-label={`Pressure ${score} of 100`}>
      <path d={arc(0, 40)} stroke={ZONE_COLOR.cool} strokeWidth="8" fill="none" opacity="0.55" />
      <path d={arc(40, 70)} stroke={ZONE_COLOR.working} strokeWidth="8" fill="none" opacity="0.55" />
      <path d={arc(70, 90)} stroke={ZONE_COLOR.hot} strokeWidth="8" fill="none" opacity="0.55" />
      <path d={arc(90, 100)} stroke={ZONE_COLOR.redline} strokeWidth="8" fill="none" opacity="0.55" />
      <g transform={`rotate(${angle} 60 60)`} style={{ transition: "transform 600ms cubic-bezier(.3,1.4,.5,1)" }}>
        <line x1="60" y1="60" x2="60" y2="18" stroke={ZONE_COLOR[zone]} strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx="60" cy="60" r="5" fill={C.brass} />
    </svg>
  );
}
