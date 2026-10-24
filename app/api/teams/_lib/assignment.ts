import type { AssignmentPreview, Size, Zone } from "@/lib/types";
import { applyTaskToRaw, zoneFor } from "@/lib/pressure";

// Pure assignment logic shared by the preview and post routes (and the summary by the UI).

const HOUR_MS = 60 * 60 * 1000;
/** Boilers older than this are dimmed in the Engine Room. */
export const DIM_AFTER_MS = 24 * HOUR_MS;
/** Boilers older than this are "Stale", and left out of preview summaries. */
export const STALE_AFTER_MS = 72 * HOUR_MS;
/** Fewer hidden members than this and no hidden count is shown anywhere (k-anonymity). */
export const HIDDEN_MIN = 2;

/** Hidden count safe to show: 0 when it could single someone out. */
export function safeHiddenCount(n: number): number {
  return n >= HIDDEN_MIN ? n : 0;
}

export type Freshness = "fresh" | "dim" | "stale" | "never";

/** How current a boiler is, from its last snapshot time ("" or null = never synced). */
export function freshness(updatedAt: string | null | undefined, now: Date): Freshness {
  if (!updatedAt) return "never";
  const age = now.getTime() - Date.parse(updatedAt);
  if (age > STALE_AFTER_MS) return "stale";
  if (age > DIM_AFTER_MS) return "dim";
  return "fresh";
}

/**
 * AssignmentPreview (frozen in lib/types.ts) plus what the panel needs to stay honest:
 * visible members with no snapshot, or one older than 72h, are listed apart from the summary.
 */
export interface TeamAssignmentPreview extends AssignmentPreview {
  noRecentData: { userId: string; name: string }[];
  /** Everyone who will get the task, or null when that would reveal a hidden count below HIDDEN_MIN. */
  recipients: number | null;
}

export interface AssignmentInput {
  title: string;
  due: string; // ISO
  size: Size;
}

// One recipient as read from memberships + profiles + pressure_snapshots.
// raw/score/zone are null when the member has never synced.
export interface AssignmentTarget {
  userId: string;
  name: string;
  visible: boolean; // visible to the posting lead in the Engine Room
  raw: number | null;
  score: number | null;
  zone: Zone | null;
  /** computed_at of the snapshot; null when never synced. */
  updatedAt: string | null;
}

export interface TargetResult {
  userId: string;
  visible: boolean;
  before: number;
  after: number;
  zoneBefore: Zone;
  zoneAfter: Zone;
  rawAfter: number;
  /** Has a snapshot no older than STALE_AFTER_MS. Others are excluded from summaries. */
  recent: boolean;
}

const SIZES: Size[] = ["S", "M", "L"];
const ZONE_RANK: Record<Zone, number> = { cool: 0, working: 1, hot: 2, redline: 3 };

export function parseAssignmentInput(
  body: unknown,
  now: Date,
): { ok: true; value: AssignmentInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Expected a JSON body" };
  const b = body as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (title.length < 1 || title.length > 200) return { ok: false, error: "Title must be 1 to 200 characters" };
  if (typeof b.size !== "string" || !SIZES.includes(b.size as Size)) {
    return { ok: false, error: "Size must be S, M or L" };
  }
  const dueMs = typeof b.due === "string" ? Date.parse(b.due) : NaN;
  if (Number.isNaN(dueMs)) return { ok: false, error: "Due must be a date" };
  if (dueMs < now.getTime()) return { ok: false, error: "Due date is in the past" };
  return { ok: true, value: { title, due: new Date(dueMs).toISOString(), size: b.size as Size } };
}

export function computeTargets(targets: AssignmentTarget[], input: AssignmentInput, now: Date): TargetResult[] {
  return targets.map((t) => {
    const before = t.score ?? 0;
    const zoneBefore = t.zone ?? zoneFor(before);
    const next = applyTaskToRaw(t.raw ?? 0, { due: input.due, size: input.size }, now);
    return {
      userId: t.userId,
      visible: t.visible,
      before,
      after: next.score,
      zoneBefore,
      zoneAfter: next.zone,
      rawAfter: next.raw,
      recent: t.raw !== null && freshness(t.updatedAt, now) !== "stale" && freshness(t.updatedAt, now) !== "never",
    };
  });
}

export function toPreview(targets: AssignmentTarget[], results: TargetResult[]): TeamAssignmentPreview {
  const names = new Map(targets.map((t) => [t.userId, t.name]));
  const visible = results.filter((r) => r.visible && r.recent);
  const hidden = results.filter((r) => !r.visible);
  const shownHidden = safeHiddenCount(hidden.length);
  return {
    members: visible
      .map((r) => ({
        userId: r.userId,
        name: names.get(r.userId) ?? "Unnamed",
        before: r.before,
        after: r.after,
        zoneBefore: r.zoneBefore,
        zoneAfter: r.zoneAfter,
      }))
      .sort((a, b) => b.after - a.after),
    hidden: {
      count: shownHidden,
      intoRedline: shownHidden
        ? hidden.filter((r) => r.recent && r.zoneAfter === "redline" && r.zoneBefore !== "redline").length
        : 0,
    },
    noRecentData: results
      .filter((r) => r.visible && !r.recent)
      .map((r) => ({ userId: r.userId, name: names.get(r.userId) ?? "Unnamed" }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    recipients: hidden.length > 0 && shownHidden === 0 ? null : results.length,
  };
}

export function movedUp(m: { zoneBefore: Zone; zoneAfter: Zone }): boolean {
  return ZONE_RANK[m.zoneAfter] > ZONE_RANK[m.zoneBefore];
}

// "Moves 4 into Hot, 1 into Redline". Counts named members only; hidden ones get their own line.
export function summarize(preview: AssignmentPreview): { text: string; intoHot: number; intoRedline: number } {
  let intoHot = 0;
  let intoRedline = 0;
  let intoWorking = 0;
  for (const m of preview.members) {
    if (!movedUp(m)) continue;
    if (m.zoneAfter === "redline") intoRedline++;
    else if (m.zoneAfter === "hot") intoHot++;
    else if (m.zoneAfter === "working") intoWorking++;
  }
  const parts: string[] = [];
  if (intoHot) parts.push(`${intoHot} into Hot`);
  if (intoRedline) parts.push(`${intoRedline} into Redline`);
  if (intoWorking) parts.push(`${intoWorking} into Working`);
  return { text: parts.length ? `Moves ${parts.join(", ")}` : "No zone changes", intoHot, intoRedline };
}
