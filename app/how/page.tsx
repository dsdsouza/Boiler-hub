import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { MobileTabBar, SiteHeader } from "@/components/ui/SiteHeader";
import { VisibilityList } from "@/components/ui/VisibilityList";
import { ZoneBadge } from "@/components/ui/ZoneBadge";
import { ZONES, ZONE_BEHAVIOR, ZONE_RANGE } from "@/components/ui/zones";

export const metadata: Metadata = {
  title: "How it works · Boilerplate",
  description: "The pressure formula, its weights, and what teams can and cannot see.",
};

const WEIGHTS: [string, string][] = [
  ["Event weight tag", "Light 0.5, Normal 1.0, Heavy 1.6 (your tag, else the default)"],
  ["Default for recurring events", "Light"],
  ["Attendees", "× (1 + 0.03 × min(attendees, 10))"],
  ["You organize it", "× 1.2"],
  ["Task size points", "S 2, M 4, L 8"],
  ["Proximity (d days from now)", "1 / (1 + 0.35 × d)"],
  ["Task urgency", "1 / max(days until due, 0.25), capped at 3; overdue = 3"],
  ["Completed task (last 48 h)", "Release of 0.5 × size points, fading to 0 over 48 h"],
  ["Focus time or out of office", "Release of 0.5 × hours × proximity"],
  ["Scale constant K", "25"],
];

const SKIPPED = [
  "Events you declined",
  "Events marked Free",
  "All-day events",
  "Events that already ended",
  "Working-location entries",
];

const h2 = "m-0 font-display text-[40px] font-normal leading-none tracking-[0.02em] sm:text-[48px]";

export default function HowPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader variant="app" current="how" />
      <main className="mx-auto flex max-w-[1000px] flex-col gap-14 px-4 pt-10 pb-28 sm:px-8 sm:pb-20">
        <header className="flex flex-col gap-4">
          <div className="font-mono text-[13px] tracking-[0.18em] text-brass-ink">HOW IT WORKS</div>
          <h1 className="m-0 font-display text-[clamp(48px,7vw,80px)] leading-[0.95] font-normal">Pressure is load over the next 7 days.</h1>
          <p className="m-0 max-w-[680px] text-[17px] leading-relaxed text-body">
            Every meeting and task in the coming week adds pressure. Finished tasks, focus time and days off vent it. The same inputs always give the
            same score, and you can see exactly why your needle sits where it does.
          </p>
        </header>

        <section aria-labelledby="formula" className="flex flex-col gap-5">
          <h2 id="formula" className={h2}>
            The formula
          </h2>
          <Card plate className="overflow-x-auto px-6 py-7 sm:px-8">
            <pre className="m-0 font-mono text-[13px] leading-loose text-fg sm:text-[15px]">
              <code>
                {"R = Σ events (hours × weight × attendees × organizer × proximity)\n"}
                {"  + Σ tasks  (size points × urgency)\n"}
                {"  − Σ releases\n\n"}
                <span className="text-brass-ink">{"score = round(100 × (1 − e^(−max(R, 0) / 25)))"}</span>
              </code>
            </pre>
          </Card>
          <p className="m-0 leading-relaxed text-body">
            The curve means early load moves the needle fast, and it can never pass 100. A typical student week with five classes and three
            assignments lands around 50; a manager with 25 meeting hours lands around 80.
          </p>
        </section>

        <section aria-labelledby="weights" className="flex flex-col gap-5">
          <h2 id="weights" className={h2}>
            Weights
          </h2>
          <Card className="overflow-hidden">
            <table className="w-full border-collapse text-left text-[15px]">
              <caption className="sr-only">Pressure weights</caption>
              <thead>
                <tr className="bg-surface-2">
                  <th scope="col" className="px-5 py-3 text-[13px] font-semibold tracking-[0.1em] text-muted uppercase">
                    Factor
                  </th>
                  <th scope="col" className="px-5 py-3 text-[13px] font-semibold tracking-[0.1em] text-muted uppercase">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {WEIGHTS.map(([factor, value]) => (
                  <tr key={factor} className="border-t border-line align-top">
                    <th scope="row" className="px-5 py-3 font-semibold">
                      {factor}
                    </th>
                    <td className="px-5 py-3 font-mono text-[13px] text-body sm:text-sm">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <Card className="px-6 py-5">
              <CardTitle className="text-[24px]">Never counted</CardTitle>
              <ul className="mt-3 mb-0 flex list-disc flex-col gap-1 pl-5 text-body">
                {SKIPPED.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </Card>
            <Card className="px-6 py-5">
              <CardTitle className="text-[24px]">Tune it yourself</CardTitle>
              <p className="mt-3 mb-0 leading-relaxed text-body">
                On My Boiler, tag any event Light, Normal or Heavy, for one meeting or the whole series. Your status never changes your score.
              </p>
            </Card>
          </div>
        </section>

        <section aria-labelledby="zones" className="flex flex-col gap-5">
          <h2 id="zones" className={h2}>
            Zones
          </h2>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {ZONES.map((z) => (
              <li key={z} className="flex items-center gap-4 rounded-[10px] border border-line bg-surface px-5 py-4 shadow-(--shadow)">
                <ZoneBadge zone={z} size="md" className="min-w-[110px]" />
                <span>
                  <span className="font-mono font-bold">{ZONE_RANGE[z]}</span>
                  <span className="block text-sm text-muted">{ZONE_BEHAVIOR[z]}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="m-0 text-body">The gauge measures load, not wellbeing.</p>
        </section>

        <section aria-labelledby="privacy" className="flex flex-col gap-5">
          <h2 id="privacy" className={h2}>
            Our privacy promise
          </h2>
          <Card plate emphasis className="px-6 py-7 sm:px-8">
            <p className="m-0 font-display text-[28px] leading-tight tracking-[0.02em] sm:text-[34px]">
              We never store what is on your calendar. Teams see a number, a zone and your status, only if you choose. You can hide from any team at any
              time.
            </p>
          </Card>
          <p className="m-0 leading-relaxed text-body">
            Events are read live from Google each time you sync and are never saved. Only your score, zone, category counts (such as “9 meetings, 3
            deadlines”) and forecast are stored. The breakdown of which events add pressure is visible to you alone. Choose who sees your boiler, per
            team:
          </p>
          <VisibilityList />
        </section>

        <div className="flex flex-wrap gap-3.5">
          <LinkButton href="/demo" variant="primary" size="lg">
            Try the demo
          </LinkButton>
          <Link href="/" className="inline-flex min-h-14 items-center px-2 font-semibold">
            Back to the start
          </Link>
        </div>
      </main>
      <MobileTabBar current="how" />
    </div>
  );
}
