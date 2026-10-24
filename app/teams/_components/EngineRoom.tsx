"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AssignmentPreview, Status, Zone } from "@/lib/types";
import type { EngineRoomView } from "@/lib/data/teams";
import { movedUp } from "@/app/api/teams/_lib/assignment";
import { C, DISPLAY, MONO, STATUS_META, ZONE_LABEL, plural, teamLabels } from "../_theme";
import { AssignmentPanel } from "./AssignmentPanel";
import { BoilerTile, type TileOverlay } from "./BoilerTile";
import { VisibilityPicker } from "./VisibilityPicker";

const ZONES: Zone[] = ["redline", "hot", "working", "cool"];
const STATUSES: Status[] = ["open", "heads_down", "running_hot", "away"];

const chip = (on: boolean) => ({
  border: `1px solid ${on ? C.brass : C.line}`,
  backgroundColor: on ? C.brass : C.surface,
  color: on ? C.onFill : C.text2,
});

export function EngineRoom({ room }: { room: EngineRoomView }) {
  const l = teamLabels(room.team.type);
  const isLead = room.myRole === "lead";
  const [zoneFilter, setZoneFilter] = useState<Zone | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
  const onPreview = useCallback((p: AssignmentPreview | null) => setPreview(p), []);

  // While previewing, tiles show the after score (as in the design) and re-sort by it.
  const tiles = useMemo(() => {
    const byId = new Map(preview?.members.map((m) => [m.userId, m]) ?? []);
    return room.boilers
      .map((b) => {
        const m = byId.get(b.userId);
        const overlay: TileOverlay | undefined = m && { after: m.after, zoneAfter: m.zoneAfter, moved: movedUp(m) };
        return {
          boiler: b,
          overlay,
          score: overlay?.after ?? b.score,
          zone: overlay?.zoneAfter ?? b.zone,
          ranked: b.synced || Boolean(overlay),
        };
      })
      .sort((a, b) => Number(b.ranked) - Number(a.ranked) || b.score - a.score || a.boiler.name.localeCompare(b.boiler.name));
  }, [room.boilers, preview]);

  const zoneCount = (z: Zone) => tiles.filter((t) => t.ranked && t.zone === z).length;
  const shown = tiles.filter(
    (t) =>
      (zoneFilter === "all" || (t.ranked && t.zone === zoneFilter)) &&
      (statusFilter === "all" || t.boiler.status === statusFilter),
  );

  return (
    <main className="mx-auto flex max-w-[1320px] flex-col gap-[22px] px-4 pb-16 pt-7 sm:px-8">
      <Link href="/teams" className="text-sm" style={{ color: C.brassLight }}>
        ← My Teams
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className={`text-[13px] tracking-[0.16em] ${MONO}`} style={{ color: C.brassLight }}>
            ENGINE ROOM · {room.team.type === "class" ? "CLASS" : "WORK"}
          </div>
          <h1 className={`m-0 text-[48px] leading-none tracking-[0.02em] sm:text-[60px] ${DISPLAY}`}>{room.team.name}</h1>
          <p className="m-0 text-[15px]" style={{ color: C.muted }}>
            You are {isLead ? `the ${l.lead}` : `a ${l.member}`} · {plural(room.memberCount, l.member.toLowerCase(), l.members)}
            {room.inviteCode && (
              <>
                {" "}· invite code{" "}
                <span className={`font-bold ${MONO}`} style={{ color: C.text }}>
                  {room.inviteCode}
                </span>
              </>
            )}
          </p>
        </div>
        {room.hiddenCount > 0 && (
          <span
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3.5 text-sm"
            style={{ border: `1px dashed ${C.rivet}`, color: C.text2 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l18 18" />
              <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 9 5 10 7a14 14 0 0 1-3 3.8M6.6 6.6C4.4 8 2.9 10.2 2 12c1 2 5 7 10 7a9.6 9.6 0 0 0 4.4-1" />
            </svg>
            {plural(room.hiddenCount, `hidden ${l.member.toLowerCase()}`, `hidden ${l.members}`)}
          </span>
        )}
      </div>

      <details className="rounded-xl px-4 py-3" style={{ backgroundColor: C.surface, border: `1px solid ${C.line}` }}>
        <summary className="min-h-8 cursor-pointer text-sm font-semibold" style={{ color: C.text2 }}>
          Your visibility on this team
        </summary>
        <div className="pt-3">
          <VisibilityPicker teamId={room.team.id} value={room.myVisibility} leadLabel={l.lead} />
        </div>
      </details>

      <div className="flex flex-col gap-2">
        <div role="group" aria-label="Filter by zone" className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={zoneFilter === "all"} onClick={() => setZoneFilter("all")} className="min-h-11 rounded-lg px-3.5 text-sm font-semibold" style={chip(zoneFilter === "all")}>
            All · {tiles.length}
          </button>
          {ZONES.map((z) => (
            <button key={z} type="button" aria-pressed={zoneFilter === z} onClick={() => setZoneFilter(z)} className="min-h-11 rounded-lg px-3.5 text-sm font-semibold" style={chip(zoneFilter === z)}>
              {ZONE_LABEL[z]} · {zoneCount(z)}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={statusFilter === "all"} onClick={() => setStatusFilter("all")} className="min-h-11 rounded-lg px-3.5 text-sm font-semibold" style={chip(statusFilter === "all")}>
            Any status
          </button>
          {STATUSES.map((s) => (
            <button key={s} type="button" aria-pressed={statusFilter === s} onClick={() => setStatusFilter(s)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold" style={chip(statusFilter === s)}>
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-label={`${l.Members} boilers`}
          className="grid min-w-0 flex-[999_1_560px] grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4"
        >
          {shown.map((t) => (
            <BoilerTile
              key={t.boiler.userId}
              boiler={t.boiler}
              overlay={t.overlay}
              isMe={t.boiler.userId === room.myUserId}
              canPromote={isLead}
              teamId={room.team.id}
              leadLabel={l.lead}
            />
          ))}
          {shown.length === 0 && (
            <p className="m-0" style={{ color: C.muted }}>
              {tiles.length <= 1 && room.hiddenCount > 0
                ? `Everyone else is hidden. ${l.Members} choose who sees their boiler.`
                : `No visible ${l.members} match these filters.`}
            </p>
          )}
        </section>

        {isLead && <AssignmentPanel teamId={room.team.id} labels={l} onPreview={onPreview} />}
      </div>
      {isLead && <JumpToAssignment />}
    </main>
  );
}

/**
 * Sticky "New assignment" button for leads, shown while the panel is out of view (on a phone it sits
 * below every tile). It scrolls to the panel and puts focus in its first field.
 */
function JumpToAssignment() {
  const [panelVisible, setPanelVisible] = useState(true);

  useEffect(() => {
    const panel = document.getElementById("new-assignment")?.closest("aside");
    if (!panel) return;
    const io = new IntersectionObserver(([entry]) => setPanelVisible(!!entry?.isIntersecting), { threshold: 0.15 });
    io.observe(panel);
    return () => io.disconnect();
  }, []);

  if (panelVisible) return null;
  return (
    <button
      type="button"
      onClick={() => {
        const panel = document.getElementById("new-assignment")?.closest("aside");
        panel?.scrollIntoView({ behavior: "smooth", block: "start" });
        const target = panel?.querySelector<HTMLElement>("#a-title") ?? panel?.querySelector<HTMLElement>("button");
        target?.focus({ preventScroll: true });
      }}
      className={`fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 min-h-12 rounded-full px-5 text-xl tracking-[0.05em] shadow-lg outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 sm:right-8 sm:bottom-6 ${DISPLAY}`}
      style={{ backgroundColor: C.brass, color: C.onFill, outlineColor: C.brassLight, boxShadow: "inset 0 -3px 0 #8C6A35" }}
    >
      + New assignment
    </button>
  );
}
