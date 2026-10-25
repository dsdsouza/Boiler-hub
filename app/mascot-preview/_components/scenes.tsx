"use client";

import { useEffect, useRef, useState } from "react";
import type { Size, Status, Visibility } from "@/lib/types";
import { SIZE_POINTS, taskPoints, ZONE_MIN } from "@/lib/pressure";
import { demoTeams } from "@/components/boiler/fixture";
import { Button } from "@/components/ui/Button";
import { Card, Eyebrow } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { ZoneBadge } from "@/components/ui/ZoneBadge";
import { ZONE_FILL, ZONE_INK_VAR, ZONE_LABEL, ZONE_RANGE, ZONES, zoneOf } from "@/components/ui/zones";
import { Mascot } from "@/components/mascot/Mascot";
import {
  DEMO_TASKS,
  DUE_CHOICES,
  MASCOT_NAME,
  ZONE_PRESET,
  demoWeek,
  gentlestDue,
  notificationsFor,
  previewAssignment,
  type DemoTask,
  type Reaction,
} from "./companion";

// Interior of the /mascot-preview stage. Layout uses container queries (@container)
// so the same scene reflows inside the phone frame and on a real phone.

/** taskPoints is relative to `now` only through dueIn, so a fixed clock keeps SSR and client in step. */
const EPOCH = new Date(0);

export function chip(on: boolean) {
  return `min-h-11 cursor-pointer rounded-lg border px-3.5 text-sm font-semibold ${
    on ? "border-brass bg-brass text-soot" : "border-line bg-surface text-body hover:border-rivet hover:text-fg"
  }`;
}

/* ---------- Companion strip: Pip beside one message and its actions ---------- */

export function Companion({
  score,
  reaction = "idle",
  empty,
  headline,
  body,
  children,
  simulated,
}: {
  score: number;
  reaction?: Reaction;
  empty?: boolean;
  headline: string;
  body: React.ReactNode;
  children?: React.ReactNode;
  simulated?: boolean;
}) {
  const zone = zoneOf(score);
  return (
    <Card as="section" aria-label={`${MASCOT_NAME}, your pressure companion`} className="flex items-start gap-3 p-3.5 @lg:gap-4 @lg:p-4">
      <div className="flex-none pt-1">
        <Mascot score={score} size={60} reaction={reaction} empty={empty} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] tracking-[0.14em] text-brass-ink uppercase">
          <span>{MASCOT_NAME}</span>
          {!empty && (
            <span className="text-muted">
              · {ZONE_LABEL[zone]} {score}
            </span>
          )}
          {simulated && <span className="rounded border border-dashed border-rivet px-1.5 py-px text-[10px] text-muted">Simulated</span>}
        </div>
        <div aria-live="polite" aria-atomic="true">
          <p className="m-0 text-[17px] leading-snug font-semibold text-fg">{headline}</p>
          <div className="mt-0.5 text-sm leading-normal text-body">{body}</div>
        </div>
        {children}
      </div>
    </Card>
  );
}

/* ---------- Dashboard pieces ---------- */

export function GaugeCard({ score, status }: { score: number; status: Status }) {
  const zone = zoneOf(score);
  return (
    <Card plate className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>Pressure · next 7 days</Eyebrow>
        <StatusPill status={status} />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <span className="font-mono text-[56px] leading-none font-bold" style={{ color: ZONE_INK_VAR[zone] }}>
          {score}
        </span>
        <span className="pb-1.5 font-mono text-sm text-muted">/ 100</span>
        <ZoneBadge zone={zone} className="mb-1.5" />
      </div>
      <Meter score={score} />
      <p className="m-0 text-sm text-body">
        <span className="font-semibold" style={{ color: ZONE_INK_VAR[zone] }}>
          {ZONE_LABEL[zone]} ({ZONE_RANGE[zone]}).
        </span>
      </p>
    </Card>
  );
}

export function Meter({ score, after }: { score: number; after?: number }) {
  return (
    <div className="relative h-3" aria-hidden="true">
      <div className="flex h-full overflow-hidden rounded-full">
        {ZONES.map((z, i) => {
          const next = ZONES[i + 1];
          const span = (next ? ZONE_MIN[next] : 100) - ZONE_MIN[z];
          return <div key={z} style={{ width: `${span}%`, backgroundColor: ZONE_FILL[z], opacity: 0.35 }} />;
        })}
      </div>
      {after !== undefined && <div className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded bg-fg/40" style={{ left: `calc(${after}% - 2px)` }} />}
      <div className="mp-level absolute top-1/2 h-5 w-1.5 -translate-y-1/2 rounded bg-fg" style={{ left: `calc(${score}% - 3px)` }} />
    </div>
  );
}

export function WeekCard({
  score,
  selected,
  onSelect,
  focusKey,
}: {
  score: number;
  selected: number | null;
  onSelect: (i: number | null) => void;
  /** Bump to move focus to the day detail (after “Review your week”). */
  focusKey: number;
}) {
  const week = demoWeek(score);
  const detailRef = useRef<HTMLDivElement>(null);
  const day = selected === null ? null : week[selected]!;

  useEffect(() => {
    if (focusKey) detailRef.current?.focus();
  }, [focusKey]);

  return (
    <Card className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-baseline justify-between gap-2">
        <Eyebrow>Your week</Eyebrow>
        <span className="text-xs text-muted">Demo calendar</span>
      </div>
      <div role="group" aria-label="Pick a day" className="grid grid-cols-7 gap-1.5">
        {week.map((d, i) => (
          <button
            key={d.day}
            type="button"
            aria-pressed={selected === i}
            aria-label={`${d.long}: ${d.score}, ${ZONE_LABEL[d.zone]}`}
            onClick={() => onSelect(selected === i ? null : i)}
            className={`flex min-h-11 cursor-pointer flex-col items-center gap-1 rounded-lg border bg-transparent px-0.5 pt-1.5 pb-1 ${
              selected === i ? "border-brass" : "border-transparent hover:border-line"
            }`}
          >
            <span className="flex h-16 w-full items-end justify-center">
              <span className="mp-level w-[min(22px,70%)] rounded-t-[4px]" style={{ height: `${Math.max(d.score, 6)}%`, backgroundColor: ZONE_FILL[d.zone] }} />
            </span>
            <span className="font-mono text-[11px] font-bold text-fg">{d.score}</span>
            <span className="text-[11px] text-muted">{d.day}</span>
          </button>
        ))}
      </div>
      {day && (
        <div ref={detailRef} tabIndex={-1} className="mp-pop rounded-[10px] border border-line bg-bg p-3 text-sm">
          <div className="font-semibold text-fg">
            {day.long} · {day.score} <span style={{ color: ZONE_INK_VAR[day.zone] }}>{ZONE_LABEL[day.zone]}</span>
          </div>
          <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0 text-body">
            <li>
              {day.meetings} meetings · {day.meetingHours} h
            </li>
            {day.deadlines.length ? day.deadlines.map((t) => <li key={t}>Due: {t}</li>) : <li>No deadlines</li>}
          </ul>
          <p className="m-0 mt-2 text-xs text-muted">Teams only ever see totals like these, never titles or times.</p>
        </div>
      )}
    </Card>
  );
}

function dueLabel(t: DemoTask) {
  if (t.dueIn < 1) return `Due in ${Math.round(t.dueIn * 24)} h`;
  if (t.dueIn < 2) return "Due tomorrow";
  return `Due in ${Math.round(t.dueIn)} days`;
}

export function TasksCard({
  done,
  onComplete,
  onUndo,
  highlight,
  tasks = DEMO_TASKS,
}: {
  done: Set<string>;
  onComplete: (t: DemoTask) => void;
  onUndo: (t: DemoTask) => void;
  highlight?: boolean;
  tasks?: DemoTask[];
}) {
  return (
    <Card emphasis={highlight} className={`flex flex-col gap-2 px-5 py-4 ${highlight ? "ring-2 ring-brass/40" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <Eyebrow>Tasks</Eyebrow>
        <span className="text-xs text-muted">{tasks.length - done.size} open</span>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {tasks.map((t) => {
          const isDone = done.has(t.id);
          return (
            <li key={t.id} className="flex items-center gap-3 border-t border-surface-2 py-2 first:border-t-0">
              <button
                type="button"
                onClick={() => (isDone ? onUndo(t) : onComplete(t))}
                aria-label={isDone ? `Mark “${t.title}” not done` : `Complete “${t.title}”`}
                aria-pressed={isDone}
                className={`flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-lg border bg-transparent ${
                  isDone ? "border-zone-cool text-cool-ink" : "border-rivet text-muted hover:border-brass hover:text-fg"
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  {isDone ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <rect x="5" y="5" width="14" height="14" rx="3" />}
                </svg>
              </button>
              <div className="min-w-0 flex-1">
                <div className={`text-[15px] ${isDone ? "text-muted line-through" : "text-fg"}`}>{t.title}</div>
                <div className="text-xs text-muted">
                  {t.size} · {SIZE_POINTS[t.size]} pts · {isDone ? "Done" : dueLabel(t)}
                  {t.source === "team" && " · Team"}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------- Team assignment preview ---------- */

const TEAM = demoTeams[0]!;
const MEMBERS = TEAM.boilers.map((b) => ({ name: b.name, raw: b.raw }));
const SIZES: Size[] = ["S", "M", "L"];

export function TeamScene() {
  const [size, setSize] = useState<Size>("M");
  const [dueKey, setDueKey] = useState("tomorrow");
  const due = DUE_CHOICES.find((c) => c.key === dueKey)!;
  const p = previewAssignment(MEMBERS, size, due.dueIn, EPOCH);
  const best = gentlestDue(MEMBERS, size, EPOCH);
  const pts = taskPoints({ due: new Date(EPOCH.getTime() + due.dueIn * 86_400_000).toISOString(), size }, EPOCH);
  const better = best.choice.key !== dueKey && (best.p.intoRed < p.intoRed || best.p.crossings < p.crossings);

  const moves = [p.intoRed && `${p.intoRed} into Redline`, p.intoHot && `${p.intoHot} into Hot`, p.intoWorking && `${p.intoWorking} into Working`]
    .filter(Boolean)
    .join(", ");
  const headline = p.crossings ? `This moves ${moves}.` : "No one changes zone.";
  const body = better ? (
    <>
      Due {best.choice.label} instead,{" "}
      {best.p.crossings ? `only ${best.p.crossings} ${best.p.crossings === 1 ? "person changes" : "people change"} zone` : "nobody changes zone"}.
    </>
  ) : p.crossings ? (
    "This is already the gentlest due date for this size. A smaller scope would ease it."
  ) : (
    "Looks like the team has room for this one."
  );

  return (
    <div className="flex flex-col gap-4">
      <Companion score={Math.max(...p.rows.map((r) => r.after))} reaction={p.intoRed ? "attentive" : "idle"} headline={headline} body={body} simulated>
        {better && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setDueKey(best.choice.key)}>
              Try {best.choice.label}
            </Button>
          </div>
        )}
      </Companion>

      <div className="grid gap-4 @3xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card plate emphasis className="flex flex-col gap-4 px-5 py-4">
          <div>
            <div className="font-mono text-[11px] tracking-[0.16em] text-brass-ink">ENGINE ROOM · LEAD VIEW</div>
            <h3 className="m-0 font-display text-[30px] leading-tight font-normal tracking-[0.03em]">New assignment</h3>
            <p className="m-0 text-[13px] text-muted">“Launch checklist review” for {TEAM.team.name} (demo team)</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span id="mp-size" className="text-[13px] font-medium text-body">
              Size
            </span>
            <div role="group" aria-labelledby="mp-size" className="grid grid-cols-3 gap-2">
              {SIZES.map((s) => (
                <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)} className={chip(size === s)}>
                  {s} · {SIZE_POINTS[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span id="mp-due" className="text-[13px] font-medium text-body">
              Due
            </span>
            <div role="group" aria-labelledby="mp-due" className="grid grid-cols-3 gap-2">
              {DUE_CHOICES.map((c) => (
                <button key={c.key} type="button" aria-pressed={dueKey === c.key} onClick={() => setDueKey(c.key)} className={`${chip(dueKey === c.key)} px-1 text-[13px]`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-[10px] border border-line bg-bg p-3 text-[13px] leading-normal text-body">
            <div className="mb-1 text-[11px] font-semibold tracking-[0.12em] text-muted">HOW THIS IS CALCULATED</div>
            Each person gets <strong className="text-fg">{SIZE_POINTS[size]} pts × urgency</strong> ={" "}
            <strong className="font-mono text-fg">{pts.toFixed(1)}</strong> load, added to their last snapshot. Same math as the real Engine Room preview. No calendars are read.
          </div>
        </Card>

        <Card className="flex flex-col gap-2 px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Eyebrow>Team capacity · before → after</Eyebrow>
            <span className="rounded border border-dashed border-rivet px-1.5 py-px text-[11px] text-muted">Simulated result</span>
          </div>
          <ul className="m-0 flex list-none flex-col p-0" aria-label="Preview by member">
            {[...p.rows]
              .sort((a, b) => b.after - a.after)
              .map((r) => (
                <li key={r.name} className="flex flex-col gap-1.5 border-t border-surface-2 py-2.5 first:border-t-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-fg">{r.name}</span>
                    <span className="font-mono font-bold whitespace-nowrap">
                      <span style={{ color: ZONE_INK_VAR[r.beforeZone] }}>{r.before}</span>
                      <span className="text-muted"> → </span>
                      <span style={{ color: ZONE_INK_VAR[r.afterZone] }}>{r.after}</span>
                      <span className="ml-2 text-[11px] font-semibold" style={{ color: ZONE_INK_VAR[r.afterZone] }}>
                        {r.crossed ? `▲ now ${ZONE_LABEL[r.afterZone]}` : ZONE_LABEL[r.afterZone]}
                      </span>
                    </span>
                  </div>
                  <Meter score={r.after} after={r.before} />
                </li>
              ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ---------- Onboarding ---------- */

const VIS: { key: Visibility; label: string; hint: string }[] = [
  { key: "hidden", label: "Hidden", hint: "Nobody on the team sees your gauge. You can still see theirs if they share." },
  { key: "lead", label: "Lead only", hint: "Your lead sees your score, zone and status before assigning work." },
  { key: "everyone", label: "Everyone", hint: "The whole team sees your gauge and status." },
];

export function OnboardingScene({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const [demoScore, setDemoScore] = useState(ZONE_PRESET.cool);
  const [vis, setVis] = useState<Visibility>("hidden");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const steps = [
    {
      title: `Hi, I’m ${MASCOT_NAME}.`,
      body: (
        <p className="m-0">
          I’ll keep an eye on your pressure, ol’ friend, so a heavy week doesn’t sneak up on you. I won’t bend your ear unless I’ve got something useful you can act on.
        </p>
      ),
    },
    {
      title: "One gauge, 0 to 100.",
      body: (
        <div className="flex flex-col gap-3">
          <p className="m-0">Meetings, deadlines and tasks add pressure. Finishing things and free time let it out. Pick a zone to see how I look in it.</p>
          <div role="group" aria-label="Zones" className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
            {ZONES.map((z) => {
              const s = ZONE_PRESET[z];
              const on = zoneOf(demoScore) === z;
              return (
                <button
                  key={z}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDemoScore(s)}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-bg px-2 py-1.5 text-left ${on ? "border-brass" : "border-line hover:border-rivet"}`}
                >
                  <Mascot score={s} size={32} />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold" style={{ color: ZONE_INK_VAR[z] }}>
                      {ZONE_LABEL[z]}
                    </span>
                    <span className="font-mono text-[11px] text-muted">{ZONE_RANGE[z]}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="m-0 text-[13px] text-muted">It measures load, not how you feel. You’re the judge of that.</p>
        </div>
      ),
    },
    {
      title: "Sharing is up to you.",
      body: (
        <div className="flex flex-col gap-3">
          <p className="m-0">Teams can see your gauge and status, never what’s on your calendar. You choose per team, and can change it anytime.</p>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1.5 text-[13px] font-medium text-body">Default for new teams</legend>
            {VIS.map((v) => (
              <label
                key={v.key}
                className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${vis === v.key ? "border-brass bg-bg" : "border-line hover:border-rivet"}`}
              >
                <input type="radio" name="mp-vis" value={v.key} checked={vis === v.key} onChange={() => setVis(v.key)} className="mt-1 accent-[#D1A85A]" />
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-fg">
                    {v.label}
                    {v.key === "hidden" && <span className="ml-1.5 font-normal text-muted">(default)</span>}
                  </span>
                  <span className="text-[13px] text-muted">{v.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      ),
    },
  ];
  const s = steps[step]!;
  const score = step === 1 ? demoScore : ZONE_PRESET.cool;

  return (
    <Card plate emphasis className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-5 py-6 @lg:flex-row @lg:items-start @lg:px-8 @lg:py-8">
      <div className="flex flex-none justify-center @lg:w-[150px] @lg:pt-2">
        <Mascot score={score} size={step === 1 ? 130 : 140} reaction={step === 0 ? "wave" : "idle"} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-center gap-2" aria-hidden="true">
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full ${i === step ? "w-8 bg-brass" : i < step ? "w-4 bg-brass/60" : "w-4 bg-line"}`} />
          ))}
        </div>
        <div className="font-mono text-[11px] tracking-[0.16em] text-muted">
          STEP {step + 1} OF {steps.length}
        </div>
        <h3 ref={headingRef} tabIndex={-1} className="m-0 font-display text-[40px] leading-none font-normal tracking-[0.02em] outline-none">
          {s.title}
        </h3>
        <div className="text-[15px] leading-relaxed text-body">{s.body}</div>
        <div className="flex flex-wrap gap-2 pt-1">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step < steps.length - 1 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)}>
              Next
            </Button>
          ) : (
            <Button variant="primary" onClick={onFinish}>
              Show my boiler
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ---------- Empty state ---------- */

export function EmptyScene({ onConnect }: { onConnect: () => void }) {
  return (
    <Card plate className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-4 px-6 py-10 text-center">
      <Mascot score={0} size={120} empty />
      <h3 className="m-0 font-display text-[36px] leading-none font-normal tracking-[0.02em]">Nothing in the boiler yet</h3>
      <p className="m-0 max-w-[40ch] text-[15px] leading-relaxed text-body">
        Connect your calendar and {MASCOT_NAME} will take a first reading of your next 7 days. Event details stay on your side.
      </p>
      <Button variant="primary" onClick={onConnect}>
        Connect Google Calendar
      </Button>
      <p className="m-0 text-xs text-muted">Preview only: this loads demo data instead of signing in.</p>
    </Card>
  );
}

/* ---------- Mobile notification concepts ---------- */

export function NotificationsScene({ score }: { score: number }) {
  const items = notificationsFor(score);
  return (
    <div className="grid items-start gap-6 @3xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <div
        role="img"
        aria-label="Phone lock screen mockup with four Boilerplate notifications"
        className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[40px] border-[6px] border-[#2A231B] bg-[radial-gradient(120%_80%_at_50%_0%,#3a2f22_0%,#15120e_70%)] px-3 pt-4 pb-8 text-[#F1E7D3] shadow-xl"
      >
        <div className="flex justify-between px-4 font-mono text-[11px] opacity-80">
          <span>Boilerplate</span>
          <span>100%</span>
        </div>
        <div className="mt-5 text-center">
          <div className="text-[13px] opacity-80">Thursday, October 22</div>
          <div className="font-display text-[72px] leading-none tracking-[0.02em]">9:41</div>
        </div>
        <ul aria-hidden="true" className="m-0 mt-6 flex list-none flex-col gap-2 p-0">
          {items.map((n, i) => (
            <li key={n.id} className="flex gap-2.5 rounded-[18px] bg-[#F1E7D3]/12 p-3 backdrop-blur" style={{ opacity: 1 - i * 0.12 }}>
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-[#1F1A14]">
                <Mascot score={n.id === "done" ? 30 : score} size={26} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex justify-between gap-2 text-[11px] opacity-70">
                  <span className="font-semibold tracking-[0.06em] uppercase">Boilerplate</span>
                  <span>{n.time}</span>
                </span>
                <span className="text-[14px] leading-snug font-semibold">{n.title}</span>
                <span className="text-[13px] leading-snug opacity-85">{n.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3 px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Eyebrow>Message concepts</Eyebrow>
            <span className="rounded border border-dashed border-rivet px-1.5 py-px text-[11px] text-muted">Visual concept · nothing is sent</span>
          </div>
          <ul className="m-0 flex list-none flex-col p-0">
            {items.map((n) => (
              <li key={n.id} className="flex flex-col gap-0.5 border-t border-surface-2 py-2.5 first:border-t-0">
                <span className="text-[15px] font-semibold text-fg">{n.title}</span>
                <span className="text-sm text-body">{n.body}</span>
                <span className="text-xs text-muted">
                  {n.time} · action: <span className="text-brass-ink">{n.action}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="flex flex-col gap-2 px-5 py-4 text-sm text-body">
          <Eyebrow>Rules {MASCOT_NAME} follows</Eyebrow>
          <ul className="m-0 flex flex-col gap-1.5 pl-5">
            <li>At most one nudge a day, never between 9 PM and 8 AM.</li>
            <li>Every message names the reason and offers one action.</li>
            <li>No streaks, no countdowns, no “{MASCOT_NAME} misses you”.</li>
            <li>Never mentions event titles on the lock screen.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

