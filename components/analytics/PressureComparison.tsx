import type { PressureResult } from "@/lib/types";
import type { WhatIfResult } from "@/lib/analytics";
import { ZoneBadge } from "@/components/ui/ZoneBadge";
import { ZONE_INK } from "@/components/ui/zones";

function Column({ label, result, tone }: { label: string; result: PressureResult; tone: "baseline" | "simulated" }) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-2 rounded-xl border p-4 ${tone === "simulated" ? "border-rivet bg-surface-2" : "border-line"}`}>
      <div className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">{label}</div>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`font-display text-[64px] leading-none ${ZONE_INK[result.zone]}`}>{result.score}</span>
        <ZoneBadge zone={result.zone} />
      </div>
      <dl className="m-0 grid grid-cols-3 gap-2 text-sm text-body">
        <Stat label="Raw" value={result.raw.toFixed(1)} />
        <Stat label="Tasks due" value={String(result.counts.tasksDue)} />
        <Stat label="Overdue" value={String(result.counts.overdue)} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="m-0 font-mono font-bold text-fg">{value}</dd>
    </div>
  );
}

export function PressureComparison({ result }: { result: WhatIfResult }) {
  const d = result.delta.score;
  const summary =
    result.status === "applied"
      ? d === 0
        ? "No change to today's score"
        : `${d > 0 ? "Up" : "Down"} ${Math.abs(d)} point${Math.abs(d) === 1 ? "" : "s"}${result.delta.zoneChanged ? `, now ${result.simulated.zone}` : ""}`
      : "No hypothetical change yet";
  return (
    <section aria-labelledby="whatif-compare" className="flex flex-col gap-3">
      <h2 id="whatif-compare" className="m-0 font-display text-[26px] leading-none font-normal tracking-[0.03em]">
        Today’s pressure
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Column label="Baseline" result={result.baseline} tone="baseline" />
        <Column label="What if" result={result.simulated} tone="simulated" />
      </div>
      <p className="m-0 font-mono text-sm font-bold text-fg" data-testid="score-delta">
        {summary}
      </p>
    </section>
  );
}
