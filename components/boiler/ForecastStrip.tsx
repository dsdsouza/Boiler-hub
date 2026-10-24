import type { ForecastDay, LoadItem } from "@/lib/types";
import { ZONE_FILL, ZONE_INK, ZONE_LABEL } from "@/components/ui/zones";
import { weekday } from "./format";
import { dayLabel, openDueCount } from "./taskView";

export { forecastCaption } from "./format";

export const FORECAST_PANEL_ID = "forecast-day-panel";

/**
 * Seven bars, today first. `compact` is the phone version (60px bars). Every bar carries its score as
 * text, and the full strip its zone name, so zone is never shown by color alone. Each day is a button
 * that opens its drill-down (ForecastDayPanel); `openDate` is the day whose panel is showing.
 */
export function ForecastStrip({
  days,
  compact,
  items = [],
  timeZone,
  openDate = null,
  onOpen,
}: {
  days: ForecastDay[];
  compact?: boolean;
  /** Load items for the "N items due" in each day's label. */
  items?: LoadItem[];
  /** Zone the forecast days are split in. */
  timeZone: string;
  openDate?: string | null;
  onOpen?: (date: string) => void;
}) {
  return (
    <ol className={`m-0 grid list-none grid-cols-7 items-end p-0 ${compact ? "gap-1.5" : "gap-2"}`}>
      {days.map((d, i) => {
        const open = openDate === d.date;
        return (
          <li key={d.date} className="flex justify-center">
            <button
              type="button"
              data-forecast-day={d.date}
              aria-label={dayLabel(d, i === 0, openDueCount(items, d.date, timeZone))}
              aria-expanded={open}
              aria-controls={open ? FORECAST_PANEL_ID : undefined}
              onClick={() => onOpen?.(d.date)}
              className={`flex w-full cursor-pointer flex-col items-center rounded-md border border-transparent pt-1 hover:border-line aria-expanded:border-rivet aria-expanded:bg-surface-2 ${
                compact ? "gap-1 px-0.5 pb-1" : "gap-1.5 px-1 pb-1.5"
              }`}
            >
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
                  className="bp-progress-fill h-full w-full"
                  style={{ transform: `scaleY(${Math.max(4, d.score) / 100})`, backgroundColor: ZONE_FILL[d.zone] }}
                />
              </div>
              {/* The open day is also underlined, so it does not rely on the background alone. */}
              <span
                aria-hidden="true"
                className={`border-b-2 text-xs ${open ? "border-brass" : "border-transparent"} ${i === 0 || open ? "font-bold text-fg" : "font-medium text-muted"} ${compact ? "text-[11px]" : ""}`}
              >
                {i === 0 ? (compact ? weekday(d.date) : "Today") : weekday(d.date)}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
