import type { Metadata } from "next";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { WhatIfSimulator } from "@/components/analytics/WhatIfSimulator";
import { SYNTHETIC_NOW, SYNTHETIC_TIME_ZONE, syntheticItems } from "@/lib/analytics";

export const metadata: Metadata = {
  title: "What-if preview · Boilerplate",
  description: "Standalone preview of a personal what-if simulator. Synthetic sample data only.",
  robots: { index: false, follow: false },
};

export default function WhatIfPreviewPage() {
  return (
    <div className="min-h-screen">
      <div role="note" className="bg-brass text-sm font-semibold text-soot">
        <div className="mx-auto max-w-[1320px] px-4 py-2.5 sm:px-8">
          Synthetic sample data, not your tasks or calendar. Nothing here is saved, synced, sent or applied.
        </div>
      </div>

      <SiteHeader variant="marketing" />

      <main className="mx-auto flex max-w-[1320px] flex-col gap-6 px-4 pt-7 pb-16 sm:px-8">
        <div className="flex flex-col gap-2">
          <div className="font-mono text-[13px] tracking-[0.16em] text-brass-ink">PREVIEW · PERSONAL WHAT-IF</div>
          <h1 className="m-0 font-display text-[44px] leading-none font-normal tracking-[0.02em] sm:text-[60px]">What if I changed one task?</h1>
          <p className="m-0 max-w-[68ch] text-[15px] leading-relaxed text-body">
            Pick a sample task and try one change: its size, its deadline, or finishing it. The same pressure engine scores both versions, so you can see what moves today and across the next seven days. Evaluated at{" "}
            <time dateTime={SYNTHETIC_NOW.toISOString()}>Mon Oct 26, 2026, 10:00 AM</time> ({SYNTHETIC_TIME_ZONE}).
          </p>
        </div>
        <WhatIfSimulator items={syntheticItems()} now={SYNTHETIC_NOW} timeZone={SYNTHETIC_TIME_ZONE} />
      </main>
    </div>
  );
}
