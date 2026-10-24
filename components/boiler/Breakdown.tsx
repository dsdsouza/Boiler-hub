"use client";

import { useId, useState } from "react";
import type { Contribution, LoadItem, Weight } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { DEFAULT_WEIGHT } from "@/lib/pressure/config";
import { WEIGHT_LABEL, formatPoints } from "./format";

const WEIGHTS: Weight[] = ["light", "normal", "heavy"];
const COLLAPSED = 6;

/** "Why is my needle here?" Owner-only, sorted by points. Events get a Light/Normal/Heavy tag. */
export function Breakdown({
  contributions,
  items,
  overrides = {},
  onWeight,
  className = "",
}: {
  contributions: Contribution[];
  items: LoadItem[];
  /** Events the owner tagged, and whether the tag is on the event alone or its series. */
  overrides?: Record<string, "event" | "series">;
  /** clearIds: single-event tags in the series that the series tag should replace. */
  onWeight: (id: string, weight: Weight, series: boolean, clearIds?: string[]) => void;
  className?: string;
}) {
  // Unique per instance: My Boiler renders one breakdown per breakpoint.
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  const sorted = [...contributions].sort((a, b) => b.points - a.points);
  const max = Math.max(0.01, ...sorted.map((c) => Math.abs(c.points)));
  const shown = expanded ? sorted : sorted.slice(0, COLLAPSED);
  const byId = new Map(items.map((i) => [i.id, i]));

  return (
    <Card as="section" aria-labelledby={titleId} className={`px-5 py-6 sm:px-7 ${className}`}>
      <CardTitle id={titleId}>Why is my needle here?</CardTitle>
      <p className="mt-1 mb-3 text-sm text-muted">
        Only you see this breakdown. Teams see a number, a zone and counts. Tag an event Light, Normal or Heavy to tune it.
      </p>
      <ul className="m-0 list-none p-0">
        {shown.map((c) => (
          <BreakdownRow
            key={c.itemId}
            c={c}
            item={byId.get(c.itemId)}
            max={max}
            override={overrides[c.itemId] ?? null}
            ownTagsInSeries={ownTagsInSeries(byId.get(c.itemId), items, overrides)}
            onWeight={onWeight}
          />
        ))}
      </ul>
      {sorted.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="mt-2 min-h-11 cursor-pointer border-0 bg-transparent px-0 text-sm font-semibold text-brass-ink hover:underline"
        >
          {expanded ? "Show fewer" : `Show all ${sorted.length}`}
        </button>
      )}
    </Card>
  );
}

/** Ids of events in `item`'s series that carry their own single-event tag. */
function ownTagsInSeries(item: LoadItem | undefined, items: LoadItem[], overrides: Record<string, "event" | "series">): string[] {
  if (!item?.isRecurring || !item.seriesKey) return [];
  return items.filter((i) => i.kind === "event" && i.seriesKey === item.seriesKey && overrides[i.id] === "event").map((i) => i.id);
}

function BreakdownRow({
  c,
  item,
  max,
  override,
  ownTagsInSeries,
  onWeight,
}: {
  c: Contribution;
  item?: LoadItem;
  max: number;
  override: "event" | "series" | null;
  ownTagsInSeries: string[];
  onWeight: (id: string, weight: Weight, series: boolean, clearIds?: string[]) => void;
}) {
  const [series, setSeries] = useState(true);
  const release = c.points < 0;
  const tunable = item?.kind === "event" && !item.release;
  const recurring = tunable && !!item?.isRecurring && !!item.seriesKey;
  const current = item?.weight ?? DEFAULT_WEIGHT;
  const color = release ? "var(--cool-ink)" : "var(--brass-ink)";

  return (
    <li className="flex flex-col gap-2 border-t border-line py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">{c.title}</div>
          <div className="text-[13px] text-muted">{c.reason}</div>
        </div>
        <span className="font-mono text-[15px] font-bold whitespace-nowrap" style={{ color }}>
          <span className="sr-only">{release ? "vents" : "adds"} </span>
          {formatPoints(c.points)}
        </span>
      </div>
      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-[3px] bg-surface-2">
        <div
          className="h-1.5 rounded-[3px] transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${Math.round((Math.abs(c.points) / max) * 100)}%`, backgroundColor: release ? "#7FB3D5" : "#E3BE74" }}
        />
      </div>
      {tunable && (
        <div className="flex flex-wrap items-center gap-1.5">
          <div role="group" aria-label={`Weight for ${c.title}`} className="flex gap-1.5">
            {WEIGHTS.map((w) => {
              const on = current === w;
              return (
                <button
                  key={w}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    if (on) return;
                    const toSeries = recurring && series;
                    if (!toSeries) return onWeight(c.itemId, w, false);
                    // This event's own tag is replaced (it was clicked). Others in the series keep theirs unless confirmed.
                    const others = ownTagsInSeries.filter((id) => id !== c.itemId);
                    const replace =
                      others.length > 0 &&
                      window.confirm(
                        `${others.length} other ${others.length === 1 ? "event in this series has its" : "events in this series have their"} own tag. Change ${others.length === 1 ? "it" : "them"} to ${WEIGHT_LABEL[w]} too?`,
                      );
                    const mine = override === "event" ? [c.itemId] : [];
                    onWeight(c.itemId, w, true, replace ? [...mine, ...others] : mine);
                  }}
                  className={`min-h-11 cursor-pointer rounded-md border px-3.5 text-[13px] font-semibold ${
                    on ? "border-brass bg-brass text-soot" : "border-line bg-transparent text-body hover:border-rivet hover:text-fg"
                  }`}
                >
                  {WEIGHT_LABEL[w]}
                  {on && !override && <span className="font-normal"> (default)</span>}
                </button>
              );
            })}
          </div>
          {recurring && (
            <label className="ml-1 inline-flex min-h-11 cursor-pointer items-center gap-2 text-[13px] text-body">
              <input type="checkbox" checked={series} onChange={(e) => setSeries(e.target.checked)} className="size-4 accent-brass" />
              Apply to series
            </label>
          )}
        </div>
      )}
    </li>
  );
}
