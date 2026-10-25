"use client";

import { useEffect, useMemo, useState } from "react";
import type { Size, Zone } from "@/lib/types";
import { BoilerTile } from "@/components/boiler/BoilerTile";
import { demoTeams, mayaUserId, zoneCounts, type DemoTeam } from "@/components/boiler/fixture";
import type { MyBoilerData, NewTask } from "@/components/boiler/boilerState";
import { safeHiddenCount } from "@/app/api/teams/_lib/assignment";
import { applyTaskToRaw, scoreFromRaw, SIZE_POINTS, taskPoints } from "@/lib/pressure";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ZONE_INK_VAR, ZONE_LABEL, zoneOf } from "@/components/ui/zones";

const RANK: Record<Zone, number> = { cool: 0, working: 1, hot: 2, redline: 3 };
const FILTERS: (Zone | "all")[] = ["all", "redline", "hot", "working", "cool"];
const SIZES: Size[] = ["S", "M", "L"];
const DEFAULT_TITLE = { class: "Lab report: enzyme kinetics", work: "Launch checklist review" };

function nouns(type: "class" | "work") {
  return type === "class"
    ? { lead: "Teacher", member: "student", members: "students" }
    : { lead: "Lead", member: "member", members: "members" };
}

/** Due options relative to today: tomorrow, this Friday, and the Tuesday after. */
function dueOptions(now: Date) {
  const at5 = (d: Date) => {
    const x = new Date(d);
    x.setHours(17, 0, 0, 0);
    return x;
  };
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const friday = new Date(now);
  friday.setDate(now.getDate() + (((5 - now.getDay() + 7) % 7) || 7));
  const tuesday = new Date(friday);
  tuesday.setDate(friday.getDate() + 4);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return [
    { key: "tomorrow", label: "Tomorrow", due: at5(tomorrow).toISOString() },
    { key: "friday", label: fmt(friday), due: at5(friday).toISOString() },
    { key: "tuesday", label: fmt(tuesday), due: at5(tuesday).toISOString() },
  ];
}

const PLACEHOLDER_DUES = [
  { key: "tomorrow", label: "Tomorrow", due: "" },
  { key: "friday", label: "Friday", due: "" },
  { key: "tuesday", label: "Next Tue", due: "" },
];

function chip(on: boolean) {
  return `min-h-11 cursor-pointer rounded-lg border px-3.5 text-sm font-semibold ${
    on ? "border-brass bg-brass text-soot" : "border-line bg-surface text-body hover:border-rivet hover:text-fg"
  }`;
}

export function DemoEngineRoom({ personal, onAssign }: { personal: MyBoilerData | null; onAssign: (task: NewTask) => void }) {
  const [storedTeams, setTeams] = useState<DemoTeam[]>(demoTeams);
  const teams = useMemo(() => storedTeams.map((t) => ({ ...t, boilers: t.boilers.map((b) =>
    personal && b.userId === mayaUserId ? { ...b, raw: personal.result.raw, score: personal.result.score, zone: personal.result.zone,
      counts: personal.result.counts, updatedAt: personal.syncedAt, status: personal.status, statusNote: personal.statusNote } : b,
  ) })), [storedTeams, personal]);
  const [teamIdx, setTeamIdx] = useState(1);
  const [filter, setFilter] = useState<Zone | "all">("all");
  const team = teams[teamIdx]!;
  // Same k-anonymity rule as real teams: no hidden count below two.
  const hiddenShown = safeHiddenCount(team.hiddenCount);
  const n = nouns(team.team.type);

  const [title, setTitle] = useState(DEFAULT_TITLE[team.team.type]);
  // Dates depend on the viewer's clock, so they exist only after mount; until
  // then the grid shows plain scores and the preview stays off.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const options = useMemo(() => (now ? dueOptions(now) : PLACEHOLDER_DUES), [now]);
  const [dueKey, setDueKey] = useState("tomorrow");
  const [size, setSize] = useState<Size>("L");
  const [posted, setPosted] = useState<string | null>(null);

  const due = options.find((o) => o.key === dueKey)!.due;
  const previewing = !!now && !posted && title.trim().length > 0;

  const preview = useMemo(() => {
    const at = now ?? new Date(0);
    const members = team.boilers.map((b) => ({ b, after: applyTaskToRaw(b.raw, { due, size, title }, at) }));
    const hidden = team.hiddenRaw.map((raw) => ({ before: zoneOf(scoreFromRaw(raw)), after: applyTaskToRaw(raw, { due, size, title }, at).zone }));
    return { members, hidden };
  }, [team, due, size, title, now]);

  const afterById = new Map(preview.members.map((m) => [m.b.userId, m.after.score]));
  const shownScore = (id: string, score: number) => (previewing ? afterById.get(id)! : score);
  const sorted = [...team.boilers].sort((a, b) => shownScore(b.userId, b.score) - shownScore(a.userId, a.score));
  const counts = zoneCounts(team.boilers.map((b) => ({ zone: zoneOf(shownScore(b.userId, b.score)) })));
  const visible = sorted.filter((b) => filter === "all" || zoneOf(shownScore(b.userId, b.score)) === filter);

  let intoHot = 0;
  let intoRed = 0;
  let intoWorking = 0;
  for (const { b, after } of preview.members) {
    if (after.zone === "redline" && b.zone !== "redline") intoRed++;
    else if (after.zone === "hot" && RANK[b.zone] < 2) intoHot++;
    else if (after.zone === "working" && b.zone === "cool") intoWorking++;
  }
  const parts = [intoHot && `${intoHot} into Hot`, intoRed && `${intoRed} into Redline`, intoWorking && `${intoWorking} into Working`].filter(Boolean);
  const summary = !now ? "Preparing preview…" : !title.trim() ? "Add a title to preview" : parts.length ? `Moves ${parts.join(", ")}` : "No zone changes";
  const summaryColor = intoRed ? "var(--redline-ink)" : intoHot ? "var(--hot-ink)" : "var(--text)";
  const hiddenIntoRed = preview.hidden.filter((h) => h.after === "redline" && h.before !== "redline").length;

  const switchTeam = (i: number) => {
    setTeamIdx(i);
    setFilter("all");
    setPosted(null);
    setTitle(DEFAULT_TITLE[teams[i]!.team.type]);
  };

  const post = () => {
    const at = new Date();
    const add = (raw: number) => raw + taskPoints({ due, size, title }, at);
    if (team.boilers.some((b) => b.userId === mayaUserId)) onAssign({ title: title.trim(), due, size });
    setTeams((all) =>
      all.map((t, i) =>
        i !== teamIdx
          ? t
          : {
              ...t,
              boilers: t.boilers.map((b) => {
                // Maya's assignment is computed from her real demo load items.
                if (b.userId === mayaUserId) return b;
                const raw = add(b.raw);
                const score = scoreFromRaw(raw);
                return { ...b, raw, score, zone: zoneOf(score), counts: { ...b.counts, tasksDue: b.counts.tasksDue + 1 }, updatedAt: at.toISOString() };
              }),
              hiddenRaw: t.hiddenRaw.map(add),
            },
      ),
    );
    setPosted(title.trim());
  };

  return (
    <div className="flex flex-col gap-[22px]">
      <div role="group" aria-label="Demo team" className="flex flex-wrap gap-2">
        {teams.map((t, i) => (
          <button key={t.team.id} type="button" aria-pressed={i === teamIdx} onClick={() => switchTeam(i)} className={chip(i === teamIdx)}>
            {t.team.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-[13px] tracking-[0.16em] text-brass-ink">ENGINE ROOM · {team.team.type === "class" ? "CLASS" : "WORK TEAM"}</div>
          <h1 className="m-0 font-display text-[48px] leading-none font-normal tracking-[0.02em] sm:text-[60px]">{team.team.name}</h1>
          <p className="m-0 text-[15px] text-muted">
            You are the {n.lead} · {team.boilers.length + hiddenShown} {n.members}
          </p>
        </div>
        {hiddenShown > 0 && (
          <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-rivet px-3.5 text-sm text-body">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l18 18" />
              <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 9 5 10 7a14 14 0 0 1-3 3.8M6.6 6.6C4.4 8 2.9 10.2 2 12c1 2 5 7 10 7a9.6 9.6 0 0 0 4.4-1" />
            </svg>
            {hiddenShown} hidden {hiddenShown === 1 ? n.member : n.members}
          </span>
        )}
      </div>

      <div role="group" aria-label="Filter by zone" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={chip(filter === f)}>
            {f === "all" ? "All" : ZONE_LABEL[f]} · {f === "all" ? team.boilers.length : counts[f]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <section aria-label={`${team.team.name} boilers`} className="grid min-w-0 flex-[999_1_560px] grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] sm:gap-4">
          {visible.map((b) => (
            <BoilerTile key={b.userId} card={b} teamType={team.team.type} headingLevel={2} preview={previewing ? afterById.get(b.userId) : undefined} />
          ))}
          {visible.length === 0 && <p className="m-0 text-muted">No visible {n.members} in this zone.</p>}
        </section>

        <Card as="aside" aria-labelledby="na" plate emphasis className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 px-6 py-[26px]">
          <div>
            <h2 id="na" className="m-0 font-display text-[32px] font-normal tracking-[0.03em]">
              New assignment
            </h2>
            <p className="mt-0.5 mb-0 text-[13px] text-muted">{n.lead} only. Preview the pressure before you post.</p>
          </div>

          {!posted ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="at" className="text-[13px] font-medium text-body">
                  Title
                </label>
                <input
                  id="at"
                  type="text"
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-line bg-field px-3 text-base text-fg"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span id="dl" className="text-[13px] font-medium text-body">
                  Due
                </span>
                <div role="group" aria-labelledby="dl" className="flex flex-wrap gap-2">
                  {options.map((o) => (
                    <button key={o.key} type="button" aria-pressed={dueKey === o.key} onClick={() => setDueKey(o.key)} className={`${chip(dueKey === o.key)} grow`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span id="sl" className="text-[13px] font-medium text-body">
                  Size
                </span>
                <div role="group" aria-labelledby="sl" className="grid grid-cols-3 gap-2">
                  {SIZES.map((s) => (
                    <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)} className={chip(size === s)}>
                      {s} · {SIZE_POINTS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-[10px] border border-line bg-bg p-4">
                <div className="text-xs font-semibold tracking-[0.12em] text-muted">PRESSURE PREVIEW</div>
                <div role="status" className="font-display text-[30px] leading-[1.05] tracking-[0.02em]" style={{ color: summaryColor }}>
                  {summary}
                </div>
                {previewing && (
                  <div className="flex flex-col">
                    {[...preview.members]
                      .sort((a, b) => b.after.score - a.after.score)
                      .map(({ b, after }) => {
                        const moved = RANK[after.zone] > RANK[b.zone];
                        return (
                          <div key={b.userId} className="flex items-center justify-between gap-2 border-t border-surface-2 py-[7px] text-sm">
                            <span className="min-w-0">{b.name}</span>
                            <span className="font-mono font-bold whitespace-nowrap">
                              <span style={{ color: ZONE_INK_VAR[b.zone] }}>{b.score}</span>
                              <span className="sr-only"> to </span>
                              <span className="text-muted" aria-hidden="true">
                                {" → "}
                              </span>
                              <span style={{ color: ZONE_INK_VAR[after.zone] }}>{after.score}</span>
                              {moved && (
                                <span className="text-[11px]" style={{ color: ZONE_INK_VAR[after.zone] }}>
                                  {"  ▲ "}
                                  {after.zone.toUpperCase()}
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    {hiddenShown > 0 && (
                      <div className="border-t border-surface-2 pt-[9px] text-[13px] text-muted">
                        + {hiddenShown} hidden {hiddenShown === 1 ? n.member : n.members} ·{" "}
                        {hiddenIntoRed ? `${hiddenIntoRed} would cross into Redline` : "no Redline crossing"}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Button variant="primary" className="min-h-[52px] text-2xl" disabled={!now || !title.trim()} onClick={post}>
                Post to {team.boilers.length + hiddenShown} {n.members}
              </Button>
              <p className="m-0 text-xs text-muted">The preview adds this task to each stored snapshot. No calendars are re-read.</p>
            </div>
          ) : (
            <div role="status" className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5 rounded-[10px] border border-zone-cool bg-bg p-4">
                <div className="font-display text-[28px] tracking-[0.03em] text-cool-ink">Posted</div>
                <p className="m-0 break-words text-sm leading-normal text-body">
                  “{posted}” is now on every {n.member}’s task list, and their boilers have updated.
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setPosted(null);
                  setTitle("");
                }}
              >
                Draft another
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

