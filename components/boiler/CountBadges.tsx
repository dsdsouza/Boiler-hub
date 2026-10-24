import type { Counts } from "@/lib/types";
import { countParts } from "./format";

/** Team-safe workload totals, with one rounded badge per category. */
export function CountBadges({ counts, teamType = "work" }: { counts: Counts; teamType?: "class" | "work" }) {
  return (
    <ul aria-label="Workload summary" className="m-0 flex list-none flex-wrap gap-2 p-0">
      {countParts(counts, teamType).map((part) => (
        <li key={part} className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[13px] leading-5 text-body tabular-nums">
          {part}
        </li>
      ))}
    </ul>
  );
}
