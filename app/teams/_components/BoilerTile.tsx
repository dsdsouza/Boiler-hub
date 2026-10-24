"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamBoiler } from "@/lib/data/teams";
import { Boiler } from "@/components/boiler/Boiler";
import { timeAgo } from "@/components/boiler/format";
import { freshness } from "@/app/api/teams/_lib/assignment";
import { ZoneBadge } from "@/components/ui/ZoneBadge";
import { C, MONO, STATUS_META, ZONE_COLOR, ZONE_LABEL, countsLine, initials } from "../_theme";
import { api } from "./api";

export interface TileOverlay {
  after: number;
  zoneAfter: TeamBoiler["zone"];
  moved: boolean;
}

function updatedLabel(iso: string) {
  return iso ? `updated ${timeAgo(iso)}` : "never synced";
}

export function BoilerTile({
  boiler,
  overlay,
  isMe,
  canPromote,
  teamId,
  leadLabel,
}: {
  boiler: TeamBoiler;
  overlay?: TileOverlay;
  isMe: boolean;
  canPromote: boolean;
  teamId: string;
  leadLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const show = overlay?.after ?? boiler.score;
  const zone = overlay?.zoneAfter ?? boiler.zone;
  const color = ZONE_COLOR[zone];
  const status = STATUS_META[boiler.status];
  const c = boiler.counts;
  // Older than 24h: dimmed. Older than 72h: labelled Stale. The score may describe a week that has moved on.
  const age = freshness(boiler.updatedAt, new Date());
  const dim = age === "dim" || age === "stale";

  async function promote() {
    if (!window.confirm(`Make ${boiler.name} a co-${leadLabel.toLowerCase()}? They will see boilers set to "${leadLabel} only" and can post assignments.`)) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/teams/${teamId}/membership`, "PATCH", { userId: boiler.userId, role: "lead" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      tabIndex={0}
      aria-label={`${boiler.name}, ${boiler.synced ? `pressure ${show}, ${ZONE_LABEL[zone]}, ${updatedLabel(boiler.updatedAt)}${age === "stale" ? ", stale" : ""}` : "not synced yet"}, ${status.label}`}
      className="group relative flex flex-col gap-3 rounded-xl p-[18px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        backgroundColor: C.surface,
        border: overlay?.moved ? `2px solid ${color}` : `1px solid ${C.line}`,
        outlineColor: C.brassLight,
      }}
    >
      <div className="flex items-center gap-3">
        {boiler.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={boiler.avatarUrl} alt="" className="h-10 w-10 flex-none rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-bold"
            style={{ backgroundColor: C.line, color: C.text }}
          >
            {initials(boiler.name)}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="m-0 flex items-center gap-2 truncate text-base font-bold">
            <span className="truncate">{boiler.name}</span>
            {isMe && <span className="text-xs font-medium" style={{ color: C.muted }}>(you)</span>}
            {boiler.isLead && (
              <span className={`rounded px-1.5 text-[11px] tracking-[0.08em] ${MONO}`} style={{ border: `1px solid ${C.rivet}`, color: C.brassLight }}>
                {leadLabel.toUpperCase()}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1.5 text-[13px]" style={{ color: C.text2 }}>
            <span aria-hidden="true" className="h-[9px] w-[9px] flex-none rounded-full" style={{ backgroundColor: status.color }} />
            {status.label}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[150px]" style={dim && !overlay ? { opacity: 0.55 } : undefined}>
        <Boiler score={boiler.synced || overlay ? show : 0} zone={zone} size="sm" width="fluid" status={boiler.status} />
      </div>

      {boiler.synced || overlay ? (
        <div className="flex flex-wrap items-center gap-2.5" style={dim && !overlay ? { opacity: 0.7 } : undefined}>
          <span className={`text-[30px] font-bold leading-none ${MONO}`} style={{ color }}>
            {show}
          </span>
          <ZoneBadge zone={zone} size="sm" />
          {age === "stale" && (
            <span
              className={`rounded px-1.5 text-[11px] font-bold tracking-[0.08em] ${MONO}`}
              style={{ border: `1px solid ${ZONE_COLOR.hot}`, color: ZONE_COLOR.hot }}
            >
              STALE
            </span>
          )}
          {overlay && overlay.after !== boiler.score && (
            <span className={`text-xs ${MONO}`} style={{ color: C.muted }}>
              was {boiler.score}
            </span>
          )}
        </div>
      ) : (
        <p className="m-0 text-sm" style={{ color: C.muted }}>
          Not synced yet
        </p>
      )}

      {boiler.statusNote && (
        <p className="m-0 text-sm italic" style={{ color: C.text }}>
          “{boiler.statusNote}”
        </p>
      )}

      <div className="pt-2.5 text-[13px]" style={{ color: C.muted, borderTop: `1px solid ${C.line}` }}>
        {boiler.synced ? countsLine(c) : "No load data yet"}
        {boiler.synced && (
          <span className="block text-xs" style={{ color: age === "fresh" ? C.muted : C.text2 }} suppressHydrationWarning>
            {updatedLabel(boiler.updatedAt)}
          </span>
        )}
      </div>

      {/* Hover / focus: category counts only, never event details. */}
      {boiler.synced && (
        <div
          role="tooltip"
          className="pointer-events-none absolute inset-x-3 top-[64px] z-10 rounded-lg p-3 text-[13px] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          style={{ backgroundColor: C.surface2, border: `1px solid ${C.rivet}`, color: C.text2 }}
        >
          <div className={`mb-1.5 text-[11px] tracking-[0.12em] ${MONO}`} style={{ color: C.muted }}>
            NEXT 7 DAYS
          </div>
          <dl className={`m-0 grid grid-cols-2 gap-x-3 gap-y-1 ${MONO}`}>
            <dt>Meetings</dt>
            <dd className="m-0 text-right" style={{ color: C.text }}>{c.meetings}</dd>
            <dt>Meeting hours</dt>
            <dd className="m-0 text-right" style={{ color: C.text }}>{c.meetingHours}</dd>
            <dt>Tasks due</dt>
            <dd className="m-0 text-right" style={{ color: C.text }}>{c.tasksDue}</dd>
            <dt>Overdue</dt>
            <dd className="m-0 text-right" style={{ color: c.overdue ? ZONE_COLOR.redline : C.text }}>{c.overdue}</dd>
          </dl>
          <div className="mt-1.5 text-[11px]" style={{ color: C.muted }} suppressHydrationWarning>
            {updatedLabel(boiler.updatedAt)}
          </div>
        </div>
      )}

      {canPromote && !boiler.isLead && !isMe && (
        <button
          type="button"
          onClick={promote}
          disabled={busy}
          className="relative z-20 min-h-11 rounded-lg text-sm font-semibold disabled:opacity-50"
          style={{ border: `1px solid ${C.rivet}`, color: C.text2, backgroundColor: "transparent" }}
        >
          {busy ? "Promoting…" : `Make co-${leadLabel.toLowerCase()}`}
        </button>
      )}
      {error && (
        <p role="alert" className="m-0 text-sm" style={{ color: ZONE_COLOR.redline }}>
          {error}
        </p>
      )}
    </article>
  );
}
