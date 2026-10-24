"use client";

import { useEffect, useState } from "react";
import type { Status, Zone } from "@/lib/types";
import { ZONE_MIN } from "@/lib/pressure";
import { Avatar } from "@/components/ui/SiteHeader";
import { Button } from "@/components/ui/Button";
import { Card, Eyebrow } from "@/components/ui/Card";
import { ZONE_INK_VAR, ZONE_LABEL, ZONE_RANGE, ZONES, zoneOf } from "@/components/ui/zones";
import { Mascot } from "@/components/mascot/Mascot";
import {
  DEMO_TASKS,
  MASCOT_NAME,
  ZONE_LINE,
  ZONE_PRESET,
  completeTask,
  demoWeek,
  insightFor,
  moveTask,
  type DemoTask,
  type Reaction,
} from "./companion";
import { chip, Companion, EmptyScene, GaugeCard, NotificationsScene, OnboardingScene, TasksCard, TeamScene, WeekCard } from "./scenes";
import { HeroCompare } from "./HeroCompare";
import { WardrobeSheet } from "./WardrobeSheet";

type Scenario = "onboarding" | "insight" | "complete" | "high" | "team" | "empty" | "notify";
type Frame = "desktop" | "phone";
type Help = "drivers" | "move" | "status" | null;

const SCENARIOS: { key: Scenario; label: string; hint: string }[] = [
  { key: "onboarding", label: "1 · Welcome", hint: "Pip introduces the gauge and optional sharing." },
  { key: "insight", label: "2 · Insight", hint: "A specific observation about the week, with one action." },
  { key: "complete", label: "3 · Task done", hint: "Complete a task to see a small celebration and the needle drop." },
  { key: "high", label: "4 · High load", hint: "Pip gets attentive and offers help, without guilt." },
  { key: "team", label: "5 · Team preview", hint: "How a proposed assignment moves team capacity. Simulated." },
  { key: "empty", label: "6 · Empty", hint: "No data yet, one clear next step." },
  { key: "notify", label: "7 · Notifications", hint: "Mobile message concepts. Visual only." },
];

const CAPTION: Record<Zone, string> = {
  cool: "Low water, lazy waves, a wave hello.",
  working: "Water rising and sloshing. A little steam.",
  hot: "Bubbling, brows up, a bead of sweat. Still calm.",
  redline: "Brim-full, cracked glass, steam everywhere. Attentive, never alarmed.",
};

/** The big task Pip suggests pushing out when the week runs hot. */
const MOVABLE = DEMO_TASKS.find((t) => t.id === "t-spec")!;
const MOVE_TO = { dueIn: 7, label: "next Tuesday" };

export function MascotPreview() {
  const [scenario, setScenario] = useState<Scenario>("onboarding");
  const [score, setScore] = useState(62);
  const [frame, setFrame] = useState<Frame>("desktop");
  const [still, setStill] = useState(false);

  // Dashboard state shared by the insight, task and high-load moments.
  const [done, setDone] = useState<Set<string>>(new Set());
  const [last, setLast] = useState<{ task: DemoTask; before: number; after: number } | null>(null);
  const [reaction, setReaction] = useState<Reaction>("idle");
  const [celebrations, setCelebrations] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [help, setHelp] = useState<Help>(null);
  const [moved, setMoved] = useState<{ before: number; after: number } | null>(null);
  const [status, setStatus] = useState<Status>("open");

  useEffect(() => {
    if (!celebrations) return;
    const t = setTimeout(() => setReaction("idle"), 1600);
    return () => clearTimeout(t);
  }, [celebrations]);

  const zone = zoneOf(score);

  const go = (s: Scenario) => {
    setScenario(s);
    setHelp(null);
    setDismissed(false);
    setReaction("idle");
    if (s === "high" && score < ZONE_PRESET.hot) setScore(ZONE_PRESET.redline - 3);
    if (s === "insight" && score < ZONE_PRESET.working) setScore(62);
  };

  const complete = (t: DemoTask) => {
    const r = completeTask(score, t, new Date());
    setDone((d) => new Set(d).add(t.id));
    setLast({ task: t, before: r.before, after: r.after });
    setScore(r.after);
    setReaction("celebrate");
    setCelebrations((n) => n + 1);
  };

  const undo = (t: DemoTask) => {
    setDone((d) => {
      const next = new Set(d);
      next.delete(t.id);
      return next;
    });
    if (last?.task.id === t.id) {
      setScore(last.before);
      setLast(null);
    }
    setReaction("idle");
  };

  const week = demoWeek(score);
  const insight = insightFor(week);
  const peakIndex = week.indexOf(insight.peak);

  const dashboard = scenario === "insight" || scenario === "complete" || scenario === "high";
  const pageTitle = scenario === "team" ? "Engine Room" : scenario === "onboarding" ? "Welcome" : "My Boiler";

  let companion: React.ReactNode = null;
  if (scenario === "insight") {
    companion = dismissed ? (
      <Companion score={score} headline="Okay, I’ll stay quiet." body="Tap any day in your week to see what’s in it.">
        <div>
          <Button variant="ghost" onClick={() => setDismissed(false)}>
            Show the tip again
          </Button>
        </div>
      </Companion>
    ) : (
      <Companion score={score} reaction={insight.peak.score >= 70 ? "attentive" : "idle"} headline={insight.headline} body={`${insight.why} ${insight.action}?`}>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setSelectedDay(peakIndex);
              setFocusKey((k) => k + 1);
            }}
          >
            {insight.action}
          </Button>
          <Button variant="ghost" onClick={() => setDismissed(true)}>
            Not now
          </Button>
        </div>
      </Companion>
    );
  } else if (scenario === "complete") {
    companion = last ? (
      <Companion
        score={score}
        reaction={reaction}
        headline="A little breathing room."
        body={
          <>
            “{last.task.title}” is done. Pressure{" "}
            <span className="font-mono font-bold">
              {last.before} → {last.after}
            </span>
            {zoneOf(last.before) !== zoneOf(last.after) && <> · now {ZONE_LABEL[zoneOf(last.after)]}</>}.
          </>
        }
      >
        <div>
          <Button variant="ghost" onClick={() => undo(last.task)}>
            Undo
          </Button>
        </div>
      </Companion>
    ) : (
      <Companion score={score} headline="Finish one and I’ll let some steam out." body="Mark a task done. The drop uses the engine’s real completion math on demo tasks." />
    );
  } else if (scenario === "high") {
    if (zone !== "hot" && zone !== "redline") {
      companion = <Companion score={score} headline={`Back under ${ZONE_MIN.hot}.`} body="Nothing needs your attention right now." />;
    } else {
      const line = ZONE_LINE[zone];
      const preview = moveTask(score, MOVABLE, MOVE_TO.dueIn, new Date());
      companion = (
        <Companion score={score} reaction="attentive" headline={line.headline} body={line.body}>
          <div role="group" aria-label="Ways Pip can help" className="flex flex-wrap gap-2">
            <Button variant="secondary" aria-pressed={help === "drivers"} onClick={() => setHelp("drivers")}>
              What’s driving it?
            </Button>
            <Button variant="secondary" aria-pressed={help === "move"} onClick={() => setHelp("move")}>
              Find something to move
            </Button>
            <Button variant="secondary" aria-pressed={help === "status"} onClick={() => setHelp("status")}>
              Let my team know
            </Button>
          </div>
          {help && (
            <div className="mp-pop rounded-[10px] border border-line bg-bg p-3 text-sm leading-normal text-body" aria-live="polite">
              {help === "drivers" && (
                <ul className="m-0 flex flex-col gap-1 pl-5">
                  <li>
                    {insight.peak.long}: {insight.peak.meetings} meetings, {insight.peak.meetingHours} h
                  </li>
                  <li>Finish onboarding v2 spec · L task, due in 3 days</li>
                  <li>Q4 roadmap deck · M task from your team, due tomorrow</li>
                </ul>
              )}
              {help === "move" &&
                (moved ? (
                  <p className="m-0">
                    Moved to {MOVE_TO.label}. Pressure{" "}
                    <span className="font-mono font-bold">
                      {moved.before} → {moved.after}
                    </span>
                    .{" "}
                    <button
                      type="button"
                      className="cursor-pointer border-0 bg-transparent p-0 text-brass-ink underline"
                      onClick={() => {
                        setScore(moved.before);
                        setMoved(null);
                      }}
                    >
                      Undo
                    </button>
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="m-0">
                      “{MOVABLE.title}” is the biggest open item. Moving it to {MOVE_TO.label} would take you from{" "}
                      <span className="font-mono font-bold">
                        {preview.before} → {preview.after}
                      </span>{" "}
                      <span className="text-muted">(simulated)</span>.
                    </p>
                    <div>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setMoved({ before: score, after: preview.after });
                          setScore(preview.after);
                        }}
                      >
                        Move it to {MOVE_TO.label}
                      </Button>
                    </div>
                  </div>
                ))}
              {help === "status" &&
                (status === "running_hot" ? (
                  <p className="m-0">Done. Your teams see “Running hot · check in with me” beside your gauge. Your score doesn’t change.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="m-0">Set your status so teammates know to check in before adding work. Only teams you share with can see it.</p>
                    <div>
                      <Button variant="secondary" onClick={() => setStatus("running_hot")}>
                        Set “Running hot”
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Companion>
      );
    }
  }

  const scene = dashboard ? (
    <div className="flex flex-col gap-4">
      {companion}
      <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <GaugeCard score={score} status={status} />
          <WeekCard score={score} selected={selectedDay} onSelect={setSelectedDay} focusKey={focusKey} />
        </div>
        <TasksCard done={done} onComplete={complete} onUndo={undo} highlight={scenario === "complete"} />
      </div>
    </div>
  ) : scenario === "onboarding" ? (
    <OnboardingScene onFinish={() => go("insight")} />
  ) : scenario === "team" ? (
    <TeamScene />
  ) : scenario === "empty" ? (
    <EmptyScene onConnect={() => go("insight")} />
  ) : (
    <NotificationsScene score={score} />
  );

  const current = SCENARIOS.find((s) => s.key === scenario)!;

  return (
    <div data-still={still || undefined} className="flex flex-col gap-6">
      {/* Controls */}
      <Card as="section" aria-label="Preview controls" className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-2">
          <Eyebrow id="mp-scn">Scenario</Eyebrow>
          <div role="group" aria-labelledby="mp-scn" className="flex flex-wrap gap-2">
            {SCENARIOS.map((s) => (
              <button key={s.key} type="button" aria-pressed={scenario === s.key} onClick={() => go(s.key)} className={chip(scenario === s.key)}>
                {s.label}
              </button>
            ))}
          </div>
          <p className="m-0 text-sm text-muted">{current.hint}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="mp-score" className="text-[13px] font-semibold tracking-[0.1em] text-muted uppercase">
                Pressure
              </label>
              <span className="font-mono text-sm font-bold" style={{ color: ZONE_INK_VAR[zone] }}>
                {score} · {ZONE_LABEL[zone]}
              </span>
            </div>
            <input
              id="mp-score"
              type="range"
              min={0}
              max={100}
              value={score}
              onChange={(e) => {
                setScore(Number(e.target.value));
                setMoved(null);
              }}
              aria-valuetext={`${score}, ${ZONE_LABEL[zone]}`}
              className="min-h-11 w-full"
            />
            <div role="group" aria-label="Jump to a zone" className="flex flex-wrap gap-2">
              {ZONES.map((z) => (
                <button key={z} type="button" aria-pressed={zone === z} onClick={() => setScore(ZONE_PRESET[z])} className={`${chip(zone === z)} px-3`}>
                  {ZONE_LABEL[z]} <span className="font-mono text-xs opacity-80">{ZONE_RANGE[z]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span id="mp-frame" className="text-[13px] font-semibold tracking-[0.1em] text-muted uppercase">
              Layout
            </span>
            <div role="group" aria-labelledby="mp-frame" className="flex gap-2">
              {(["desktop", "phone"] as Frame[]).map((f) => (
                <button key={f} type="button" aria-pressed={frame === f} onClick={() => setFrame(f)} className={chip(frame === f)}>
                  {f === "desktop" ? "Desktop" : "Phone"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold tracking-[0.1em] text-muted uppercase">Motion</span>
            <button type="button" aria-pressed={still} onClick={() => setStill(!still)} className={chip(still)}>
              {still ? "Paused" : "Pause motion"}
            </button>
          </div>
        </div>
      </Card>

      {/* Stage */}
      <section aria-label={`Preview: ${current.label.replace(/^\d · /, "")}`}>
        {scenario === "notify" ? (
          <div className="@container">{scene}</div>
        ) : frame === "desktop" ? (
          <div className="overflow-hidden rounded-[18px] border border-line bg-bg shadow-(--shadow)">
            <div aria-hidden="true" className="flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-2">
              <span className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rivet" />
                <span className="h-2.5 w-2.5 rounded-full bg-rivet" />
                <span className="h-2.5 w-2.5 rounded-full bg-rivet" />
              </span>
              <span className="truncate rounded-md bg-bg px-3 py-0.5 font-mono text-[11px] text-muted">boilerhub · {pageTitle.toLowerCase()} · demo data</span>
            </div>
            <AppChrome title={pageTitle} />
            <div className="@container p-4 sm:p-6">{scene}</div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[402px] overflow-hidden rounded-[44px] border-[6px] border-[#2A231B] bg-bg shadow-xl">
            <div aria-hidden="true" className="flex justify-between px-7 pt-3 pb-1 font-mono text-[11px] text-muted">
              <span>9:41</span>
              <span>100%</span>
            </div>
            <AppChrome title={pageTitle} compact />
            <div className="@container px-3 py-4">{scene}</div>
            <div aria-hidden="true" className="grid grid-cols-3 border-t border-line bg-bg-2 py-2 text-center text-xs font-semibold text-muted">
              <span className={pageTitle === "My Boiler" ? "text-brass-ink" : ""}>Boiler</span>
              <span className={pageTitle === "Engine Room" ? "text-brass-ink" : ""}>Teams</span>
              <span>How</span>
            </div>
          </div>
        )}
      </section>

      <HeroCompare still={still} />
      <CharacterSheet still={still} />
      <WardrobeSheet still={still} />
    </div>
  );
}

function AppChrome({ title, compact }: { title: string; compact?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line bg-bg-2 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <svg width="24" height="24" viewBox="0 0 34 34" aria-hidden="true">
          <circle cx="17" cy="17" r="14" fill="none" stroke="#D1A85A" strokeWidth="3" />
          <line x1="17" y1="17" x2="25" y2="10" stroke="#F0913A" strokeWidth="3" strokeLinecap="round" />
          <circle cx="17" cy="17" r="3" fill="#D1A85A" />
        </svg>
        <span className="truncate font-display text-[24px] leading-none tracking-[0.04em]">{title}</span>
        {!compact && (
          <span aria-hidden="true" className="hidden gap-4 pl-3 text-sm text-muted md:flex">
            <span className={title === "My Boiler" ? "text-fg" : ""}>My Boiler</span>
            <span className={title === "Engine Room" ? "text-fg" : ""}>Teams</span>
            <span>Sources</span>
          </span>
        )}
      </div>
      <Avatar name="Maya Chen" size={32} label="Maya Chen (demo user)" />
    </div>
  );
}

function CharacterSheet({ still }: { still: boolean }) {
  return (
    <section aria-labelledby="mp-sheet" className="flex flex-col gap-4 border-t border-line pt-8">
      <div className="flex flex-col gap-1">
        <h2 id="mp-sheet" className="m-0 font-display text-[36px] leading-none font-normal tracking-[0.03em]">
          {MASCOT_NAME} in four states
        </h2>
        <p className="m-0 text-sm text-muted">
          Zones and ranges come from the pressure engine’s thresholds. Small sizes drop fine detail but keep the gauge eye, rim and water color.
          {still && " Motion is paused."}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ZONES.map((z) => (
          <Card key={z} className="flex flex-col items-center gap-3 px-4 pt-6 pb-5 text-center">
            <Mascot score={ZONE_PRESET[z]} size={120} label={`${MASCOT_NAME}, ${ZONE_LABEL[z]} state`} />
            <div className="font-display text-[28px] leading-none tracking-[0.05em]" style={{ color: ZONE_INK_VAR[z] }}>
              {ZONE_LABEL[z]} · {ZONE_RANGE[z]}
            </div>
            <p className="m-0 text-sm text-body">{CAPTION[z]}</p>
            <div className="flex items-end gap-3 rounded-lg border border-line bg-bg px-3 py-2" aria-hidden="true">
              <Mascot score={ZONE_PRESET[z]} size={48} />
              <Mascot score={ZONE_PRESET[z]} size={32} />
              <Mascot score={ZONE_PRESET[z]} size={24} />
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-2 px-5 py-4 text-sm text-body">
          <Eyebrow>How {MASCOT_NAME} talks</Eyebrow>
          <ul className="m-0 flex flex-col gap-1.5 pl-5">
            <li>Steady and practical. Short sentences, one idea each.</li>
            <li>Always names the reason (“5 meetings land Thursday”) and one action.</li>
            <li>Celebrates small: a hop, a puff of steam, “A little breathing room.”</li>
            <li>At high load it gets attentive and offers help. It never panics.</li>
          </ul>
        </Card>
        <Card className="flex flex-col gap-2 px-5 py-4 text-sm text-body">
          <Eyebrow>What {MASCOT_NAME} never does</Eyebrow>
          <ul className="m-0 flex flex-col gap-1.5 pl-5">
            <li>Guilt, shame, streaks or countdowns.</li>
            <li>Asks you to look after it, or acts hurt when you’re busy.</li>
            <li>Covers the gauge, tasks or buttons with a speech bubble.</li>
            <li>Comments on how you feel. The gauge measures load, not wellbeing.</li>
          </ul>
        </Card>
      </div>
    </section>
  );
}
