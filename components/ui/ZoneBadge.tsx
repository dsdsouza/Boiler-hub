import type { Zone } from "@/lib/types";
import { ZONE_FILL, ZONE_LABEL } from "./zones";

const sizes = {
  sm: "text-[18px] px-2 py-px rounded-[4px]",
  md: "text-[22px] px-[10px] py-px rounded-[5px]",
  lg: "text-[26px] px-3 py-[2px] rounded-md",
};

export function ZoneBadge({ zone, size = "md", className = "" }: { zone: Zone; size?: keyof typeof sizes; className?: string }) {
  return (
    <span
      className={`inline-block text-center font-display leading-tight tracking-[0.08em] text-soot uppercase ${sizes[size]} ${className}`}
      style={{ backgroundColor: ZONE_FILL[zone] }}
    >
      {ZONE_LABEL[zone]}
    </span>
  );
}
