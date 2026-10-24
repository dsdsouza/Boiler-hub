import type { Metadata } from "next";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { MascotPreview } from "./_components/MascotPreview";

export const metadata: Metadata = {
  title: "Mascot preview · Boilerplate",
  description: "Concept preview of Pip, the BoilerHub companion. Demo data only.",
};

export default function MascotPreviewPage() {
  return (
    <div className="min-h-screen">
      <div role="note" className="bg-brass text-sm font-semibold text-soot">
        <div className="mx-auto max-w-[1320px] px-4 py-2.5 sm:px-8">
          Concept preview with demo data. Nothing here is saved, synced or sent.
        </div>
      </div>

      <SiteHeader variant="marketing" maxWidth="max-w-[1320px]" />

      <main className="mx-auto flex max-w-[1320px] flex-col gap-6 px-4 pt-7 pb-16 sm:px-8">
        <div className="flex flex-col gap-2">
          <div className="font-mono text-[13px] tracking-[0.16em] text-brass-ink">DESIGN PREVIEW · COMPANION</div>
          <h1 className="m-0 font-display text-[48px] leading-none font-normal tracking-[0.02em] sm:text-[60px]">Meet Pip</h1>
          <p className="m-0 max-w-[68ch] text-[15px] leading-relaxed text-body">
            A small glass boiler that sits beside your gauge, explains what it sees and offers one useful next step. Switch scenarios and pressure below to walk through the
            product. Pip stays secondary: the score, zone and actions are always in plain text.
          </p>
        </div>
        <MascotPreview />
      </main>
    </div>
  );
}
