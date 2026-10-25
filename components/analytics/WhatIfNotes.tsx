import type { WhatIfResult } from "@/lib/analytics";

export function WhatIfNotes({ result }: { result: WhatIfResult }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section aria-labelledby="whatif-assumptions" className="rounded-xl border border-line p-4">
        <h2 id="whatif-assumptions" className="m-0 font-display text-[22px] leading-none font-normal tracking-[0.04em]">
          Forecast assumptions
        </h2>
        <ul className="mt-3 mb-0 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-body">
          {result.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="whatif-coverage" className="rounded-xl border border-line p-4">
        <h2 id="whatif-coverage" className="m-0 font-display text-[22px] leading-none font-normal tracking-[0.04em]">
          Missing coverage
        </h2>
        <ul className="mt-3 mb-0 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-body">
          {result.coverageNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
