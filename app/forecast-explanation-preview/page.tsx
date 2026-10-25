import type { Metadata } from "next";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { ForecastExplanationPreview } from "./_components/ForecastExplanationPreview";

export const metadata: Metadata = {
  title: "Forecast explanation preview · Boilerplate",
  description: "Why a forecast day has its score, shown with synthetic inputs only.",
  robots: { index: false, follow: false },
};

export default function ForecastExplanationPreviewPage() {
  return (
    <div className="min-h-screen">
      <div role="note" className="bg-brass text-sm font-semibold text-soot">
        <div className="mx-auto max-w-[1320px] px-4 py-2.5 sm:px-8">
          Preview with synthetic inputs. Nothing here is read from an account, saved, synced or sent.
        </div>
      </div>

      <SiteHeader variant="marketing" />

      <main className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 pt-7 pb-16 sm:px-8">
        <div className="flex flex-col gap-2">
          <div className="font-mono text-[13px] tracking-[0.16em] text-brass-ink">DESIGN PREVIEW · FORECAST</div>
          <h1 className="m-0 font-display text-[44px] leading-none font-normal tracking-[0.02em] sm:text-[56px]">Why a day reads what it reads</h1>
          <p className="m-0 max-w-[68ch] text-[15px] leading-relaxed text-body">
            Pick a scenario and a forecast day. The explanation is recomputed with the real pressure engine at the moment the forecast scores that day, so
            every number below matches the bar above it.
          </p>
        </div>
        <ForecastExplanationPreview />
      </main>
    </div>
  );
}
