import type { ForecastDay } from "@/lib/types";
import { ZONE_FILL, ZONE_INK, ZONE_LABEL } from "@/components/ui/zones";
import { weekday } from "./format";

export { forecastCaption } from "./format";

/**
 * Seven bars, today first. `compact` is the phone version (60px bars). Every bar carries its score as
 * text, and the full strip its zone name, so zone is never shown by color alone.
 */
export function ForecastStrip({ days, compact }: { days: ForecastDay[]; compact?: boolean }) {
  return (
    <ol className={`m-0 grid list-none grid-cols-7 items-end p-0 ${compact ? "gap-1.5" : "gap-2"}`}>
      {days.map((d, i) => (
        <li key={d.date} className={`flex flex-col items-center ${compact ? "gap-1" : "gap-1.5"}`}>
          <span className="sr-only">
            {i === 0 ? "Today" : weekday(d.date, true)}: {d.score}, {ZONE_LABEL[d.zone]}
          </span>
          <span aria-hidden="true" className={`font-mono font-bold ${compact ? "text-[11px]" : "text-[13px]"} ${ZONE_INK[d.zone]}`}>
            {d.score}
          </span>
          {!compact && (
            <span aria-hidden="true" className="font-mono text-[9px] font-bold tracking-[0.04em] text-muted uppercase">
              {ZONE_LABEL[d.zone]}
            </span>
          )}
          <div
            aria-hidden="true"
            className={`flex w-full items-end overflow-hidden bg-surface-2 ${compact ? "h-[60px] rounded" : "h-[100px] max-w-11 rounded-md"}`}
          >
            <div
              className="w-full transition-[height] duration-500 ease-out motion-reduce:transition-none"
              style={{ height: `${Math.max(4, d.score)}%`, backgroundColor: ZONE_FILL[d.zone] }}
            />
          </div>
          <span aria-hidden="true" className={`text-xs ${i === 0 ? "font-bold text-fg" : "font-medium text-muted"} ${compact ? "text-[11px]" : ""}`}>
            {i === 0 ? (compact ? weekday(d.date) : "Today") : weekday(d.date)}
          </span>
        </li>
      ))}
    </ol>
  );
}
