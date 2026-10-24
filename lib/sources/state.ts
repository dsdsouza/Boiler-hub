import { COMPLETED_RELEASE_HOURS } from "@/lib/pressure/config";
import type { ItemStateRow, SourceItem } from "./types";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Apply the owner's overrides (source_item_state) to live items: size_override replaces the size,
 * done_at marks a task done (a source's own completion, e.g. a closed GitHub issue, wins).
 * Completed items are normally retained briefly; includeCompleted keeps legacy cleared items reviewable.
 */
export function applyItemState(items: SourceItem[], rows: ItemStateRow[], now: Date, opts: { includeCompleted?: boolean } = {}): SourceItem[] {
  const state = new Map(rows.map((r) => [`${r.source_id}:${r.item_key}`, r]));
  const cutoff = now.getTime() - COMPLETED_RELEASE_HOURS * HOUR_MS;
  const out: SourceItem[] = [];
  for (const item of items) {
    if (item.kind !== "task") {
      out.push(item);
      continue;
    }
    const s = state.get(`${item.sourceId}:${item.itemKey}`);
    const next: SourceItem = {
      ...item,
      ...(s?.size_override ? { size: s.size_override } : {}),
      doneAt: item.doneAt ?? s?.done_at ?? null,
      ...(item.doneAt ? { completedInSource: true } : {}),
    };
    if (!opts.includeCompleted && next.doneAt && Date.parse(next.doneAt) <= cutoff) continue;
    out.push(next);
  }
  return out;
}

/**
 * Legacy completion timestamp used by older bulk-clear versions.
 * Kept for compatibility with stored marks; new completion writes use the actual time.
 */
export function silentDoneAt(now: Date): string {
  return new Date(now.getTime() - COMPLETED_RELEASE_HOURS * HOUR_MS).toISOString();
}

/** Open tasks already past due. */
export function overdueOpen(items: SourceItem[], now: Date): SourceItem[] {
  return items.filter((i) => i.kind === "task" && !i.doneAt && i.due && Date.parse(i.due) < now.getTime());
}
