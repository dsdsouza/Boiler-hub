import type { WhatIfResult } from "@/lib/analytics";
import { weekdayOfDate } from "@/lib/analytics";
import { ZONE_FILL, ZONE_INK, ZONE_LABEL } from "@/components/ui/zones";

/**
 * Seven days, baseline bar beside the what-if bar. Scores and deltas are text, and the table below
 * repeats them, so nothing depends on color or bar height alone.
 */
export function ForecastComparison({ result }: { result: WhatIfResult }) {
  const compared = result.status === "applied";
  return (
    <section aria-labelledby="whatif-forecast" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="whatif-forecast" className="m-0 font-display text-[26px] leading-none font-normal tracking-[0.03em]">
          Seven-day forecast
        </h2>
        <p className="m-0 text-sm text-body">Solid bars are baseline; outlined bars are the what-if. Both use the same engine and the same sample data.</p>
      </div>

      <ol className="m-0 grid list-none grid-cols-7 gap-1.5 p-0 sm:gap-3" aria-label="Forecast bars, baseline and what-if">
        {result.forecast.map((d, i) => (
          <li key={d.date} className="flex min-w-0 flex-col items-center gap-1">
            <span className={`font-mono text-[11px] font-bold sm:text-[13px] ${ZONE_INK[d.simulated.zone]}`} aria-hidden="true">
              {d.simulated.score}
            </span>
            <div aria-hidden="true" className="flex h-[110px] w-full items-end justify-center gap-0.5 sm:gap-1">
              <Bar score={d.baseline.score} color={ZONE_FILL[d.baseline.zone]} />
              <Bar score={d.simulated.score} color={ZONE_FILL[d.simulated.zone]} outlined />
            </div>
            <span className={`text-[11px] sm:text-xs ${i === 0 ? "font-bold text-fg" : "font-medium text-muted"}`} aria-hidden="true">
              {i === 0 ? "Today" : weekdayOfDate(d.date)}
            </span>
            {d.eventCoverage === "partial" && (
              <span className="font-mono text-[9px] tracking-[0.04em] text-muted uppercase" aria-hidden="true" title="Some events are missing from this day's look-ahead">
                partial
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] border-collapse text-left text-sm">
          <caption className="sr-only">Forecast score by day</caption>
          <thead>
            <tr className="text-xs text-muted">
              <th scope="col" className="py-1 pr-2 font-semibold">Day</th>
              <th scope="col" className="py-1 pr-2 font-semibold">Baseline</th>
              <th scope="col" className="py-1 pr-2 font-semibold">What if</th>
              <th scope="col" className="py-1 pr-2 font-semibold">Change</th>
              <th scope="col" className="py-1 font-semibold">Event coverage</th>
            </tr>
          </thead>
          <tbody>
            {result.forecast.map((d) => (
              <tr key={d.date} className="border-t border-line">
                <th scope="row" className="py-1 pr-2 font-medium text-fg">{weekdayOfDate(d.date)} {d.date.slice(5)}</th>
                <td className="py-1 pr-2 font-mono">{d.baseline.score} · {ZONE_LABEL[d.baseline.zone]}</td>
                <td className="py-1 pr-2 font-mono">{d.simulated.score} · {ZONE_LABEL[d.simulated.zone]}</td>
                <td className="py-1 pr-2 font-mono font-bold" data-testid={`delta-${d.date}`}>
                  {compared ? (d.delta > 0 ? `+${d.delta}` : d.delta < 0 ? `−${Math.abs(d.delta)}` : "0") : "–"}
                </td>
                <td className="py-1 text-body">{d.eventCoverage === "full" ? "Full" : "Partial"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Bar({ score, color, outlined }: { score: number; color: string; outlined?: boolean }) {
  return (
    <div className="flex h-full w-1/2 max-w-5 items-end overflow-hidden rounded bg-surface-2">
      <div
        className="w-full"
        style={{
          height: `${Math.max(4, score)}%`,
          backgroundColor: outlined ? "transparent" : color,
          boxShadow: outlined ? `inset 0 0 0 2px ${color}` : undefined,
        }}
      />
    </div>
  );
}
