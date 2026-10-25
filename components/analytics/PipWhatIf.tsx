"use client";

import { PipHero } from "@/components/mascot/PipHero";
import { MASCOT_NAME } from "@/components/mascot/voice";
import { fireFromForecast } from "@/components/boiler/geometry";
import { pipWhatIfMessage, type WhatIfResult } from "@/lib/analytics";

/** Pip shows the what-if boiler and a deterministic explanation. No model call, no network. */
export function PipWhatIf({ result }: { result: WhatIfResult }) {
  const message = pipWhatIfMessage(result);
  return (
    <section aria-labelledby="whatif-pip" className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <div className="w-[170px] shrink-0">
        <PipHero score={result.simulated.score} zone={result.simulated.zone} width="fluid" fire={fireFromForecast(result.simulated.forecast.map((d) => d.score))} />
      </div>
      <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 p-4">
        <h2 id="whatif-pip" className="m-0 font-display text-[22px] leading-none font-normal tracking-[0.04em]">
          {MASCOT_NAME} says
        </h2>
        <p className="mt-2 mb-0 text-[15px] leading-relaxed text-fg" aria-live="polite" data-testid="pip-message">
          {message}
        </p>
        <p className="mt-2 mb-0 text-xs text-muted">Pip is showing the what-if boiler. Written from the numbers on this page, not by an AI model.</p>
      </div>
    </section>
  );
}
