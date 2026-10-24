import type { AssignmentPreview, Size, Zone } from "@/lib/types";
import { applyTaskToRaw, zoneFor } from "./pressure";

// Pure assignment logic shared by the preview and post routes (and the summary by the UI).

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
}

export interface TargetResult {
  userId: string;
  visible: boolean;
  before: number;
  after: number;
  zoneBefore: Zone;
  zoneAfter: Zone;
  rawAfter: number;
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
    };
  });
}

export function toPreview(targets: AssignmentTarget[], results: TargetResult[]): AssignmentPreview {
  const names = new Map(targets.map((t) => [t.userId, t.name]));
  const visible = results.filter((r) => r.visible);
  const hidden = results.filter((r) => !r.visible);
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
      count: hidden.length,
      intoRedline: hidden.filter((r) => r.zoneAfter === "redline" && r.zoneBefore !== "redline").length,
    },
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
