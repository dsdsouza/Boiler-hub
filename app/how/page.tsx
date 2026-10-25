import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/ui/PageLoading";
import { AccountControls, getViewer } from "@/components/ui/Account";
import { GoogleSignInButton } from "@/components/ui/GoogleSignInButton";
import { Card, CardTitle } from "@/components/ui/Card";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { VisibilityList } from "@/components/ui/VisibilityList";
import { ZoneBadge } from "@/components/ui/ZoneBadge";
import { ZONES, ZONE_DESCRIPTION, ZONE_RANGE } from "@/components/ui/zones";
import type { Size, Weight } from "@/lib/types";
import {
  ATTENDEE_CAP,
  ATTENDEE_STEP,
  DEFAULT_RECURRING_WEIGHT,
  DEFAULT_WEIGHT,
  K,
  NO_DUE_DAYS,
  ORGANIZER_FACTOR,
  OVERDUE_BACKLOG_URGENCY,
  OVERDUE_STALE_DAYS,
  TASK_K, URGENCY_EXPONENT, EXAM_LOOKAHEAD_DAYS, EXAM_PREPARATION_WEIGHT, EXAM_PREPARATION_DAYS, EXAM_DECAY_DAYS, OVERDUE_GRACE_DAYS, OVERDUE_DECAY_DAYS, TASK_TAPER_DAYS, EXAM_TAPER_DAYS, EVENT_TAPER_DAYS,
  PROXIMITY_RATE,
  SIZE_POINTS,
  TASK_LOOKAHEAD_DAYS,
  URGENCY_CAP,
  URGENCY_MIN_DAYS,
  WEIGHTS,
  WINDOW_DAYS,
} from "@/lib/pressure/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Help · Boilerplate",
  description: "The pressure formula, its weights, and what teams can and cannot see.",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const num = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

// Every number here comes from lib/pressure/config.ts, so this page always matches the engine.
const WEIGHT_ROWS: [string, string][] = [
  [
    "Event weight tag",
    `${(Object.keys(WEIGHTS) as Weight[]).map((w) => `${cap(w)} ${num(WEIGHTS[w])}`).join(", ")} (your tag, else the default)`,
  ],
  ["Default for one-off events", cap(DEFAULT_WEIGHT)],
  ["Default for recurring events", cap(DEFAULT_RECURRING_WEIGHT)],
  ["Attendees", `× (1 + ${ATTENDEE_STEP} × min(attendees, ${ATTENDEE_CAP}))`],
  ["You organize it", `× ${ORGANIZER_FACTOR}`],
  ["Task size points", (Object.keys(SIZE_POINTS) as Size[]).map((s) => `${s} ${SIZE_POINTS[s]}`).join(", ")],
  ["Proximity (d days from now)", `1 / (1 + ${PROXIMITY_RATE} × d)`],
  ["Task window", `Assignments: ${TASK_LOOKAHEAD_DAYS} days; major exams: ${EXAM_LOOKAHEAD_DAYS} days; unfinished overdue work stays counted`],
  ["Task urgency", `(1 / max(days until due, ${URGENCY_MIN_DAYS}))^${URGENCY_EXPONENT}, capped at ${URGENCY_CAP}`],
  ["Major exam preparation", `${EXAM_PREPARATION_WEIGHT} through the next ${EXAM_PREPARATION_DAYS} days; exp(−max(days − ${EXAM_PREPARATION_DAYS}, 0) / ${EXAM_DECAY_DAYS}) decay beyond that, within ${EXAM_LOOKAHEAD_DAYS} days`],
  ["Window taper", `Events: final ${EVENT_TAPER_DAYS} day; assignments: final ${TASK_TAPER_DAYS} days; exams: final ${EXAM_TAPER_DAYS} days`],
  ["Overdue work", `At-deadline weight for ${OVERDUE_GRACE_DAYS} days, then gradual decay with a ${OVERDUE_DECAY_DAYS}-day time constant toward urgency ${OVERDUE_BACKLOG_URGENCY}. Review label after ${OVERDUE_STALE_DAYS} days; counted until complete`],
  ["Task with no due date", `Counted as due in ${NO_DUE_DAYS} days`],
  [
    "Completed or cleared tasks",
    "Removed from the score. No credit is subtracted from unfinished work.",
  ],
  ["Focus time or out of office", "Excluded. Calendar blocks do not complete assignments."],
  ["Calendar / assignment scales", `${K} / ${TASK_K}`],
];

const SKIPPED = [
  "Events you declined",
  "Events marked Free",
  "All-day events",
  "Events that already ended",
  "Working-location entries",
];

const h2 = "m-0 font-display text-[40px] font-normal leading-none tracking-[0.02em] sm:text-[48px]";

export default async function HelpPage() {
  const viewer = await getViewer();

  return (
    <div className="min-h-screen">
      <SiteHeader
        variant={viewer ? "app" : "marketing"}
        current="how"
        mobileNavigation="header"
        account={viewer ? <AccountControls viewer={viewer} /> : (
          <span className="hidden sm:inline-flex"><GoogleSignInButton href="/auth/signin?next=%2Fhow" size="md" /></span>
        )}
      />
      {/* Match the landing page's streamed-content hydration boundary. */}
      <Suspense fallback={<PageLoading title="Help" shell={false} />}>
      <main className="mx-auto flex max-w-[1000px] flex-col gap-14 px-4 pt-10 pb-20 sm:px-8">
        <header className="flex flex-col gap-4">
          <h1 className="m-0 font-display text-[clamp(48px,7vw,80px)] leading-[0.95] font-normal">Pressure tracks the work still ahead.</h1>
          <p className="m-0 max-w-[680px] text-[17px] leading-relaxed text-body">
            Meetings over {WINDOW_DAYS} days, assignments over {TASK_LOOKAHEAD_DAYS} days and major exams over {EXAM_LOOKAHEAD_DAYS} days add pressure. Unfinished overdue work stays counted.
            Completing a task removes its own load, while the rest of your work keeps its weight.
          </p>
        </header>

        <section aria-labelledby="formula" className="flex flex-col gap-5">
          <h2 id="formula" className={h2}>
            The formula
          </h2>
          <Card plate role="region" aria-label="Pressure formula" tabIndex={0} className="overflow-x-auto px-6 py-7 sm:px-8">
            <pre className="m-0 font-mono text-[13px] leading-loose text-fg sm:text-[15px]">
              <code>
                {"E = Σ events (hours × weight × attendees × organizer × proximity × taper)\n"}
                {"T = Σ unfinished tasks (size × max(deadline urgency, exam preparation))\n\n"}
                <span className="text-brass-ink">{`score = round(100 × (1 − e^(−(E/${K} + T/${TASK_K}))))`}</span>
              </code>
            </pre>
          </Card>
          <p className="m-0 leading-relaxed text-body">
            The score stays between 0 and 100. Major exams include preparation before their due week. The weights are planning estimates,
            calibrated against example schedules and owner feedback; they do not measure personal stress.
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
                {WEIGHT_ROWS.map(([factor, value]) => (
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
                  <span className="block text-sm text-muted">{ZONE_DESCRIPTION[z]}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="privacy" className="flex flex-col gap-5">
          <h2 id="privacy" className={h2}>
            Choose who sees your boiler
          </h2>
          <VisibilityList />
        </section>
      </main>
      </Suspense>
    </div>
  );
}
