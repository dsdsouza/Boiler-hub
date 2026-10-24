"use client";

import type { BoilerCard } from "@/lib/types";
import { Avatar } from "@/components/ui/SiteHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { ZoneBadge } from "@/components/ui/ZoneBadge";
import { ZONE_FILL, ZONE_INK, zoneOf } from "@/components/ui/zones";
import { Boiler } from "./Boiler";
import { timeAgo } from "./format";
import { CountBadges } from "./CountBadges";

/**
 * One member's boiler in an Engine Room grid (EngineRoom.dc.html). Shows only
 * what a team may see: score, zone, status, note and category counts.
 * Pass `preview` to show an assignment's after-score with "was N".
 */
export function BoilerTile({
  card,
  teamType = "work",
  preview,
  headingLevel = 3,
}: {
  card: BoilerCard;
  teamType?: "class" | "work";
  preview?: number;
  headingLevel?: 2 | 3;
}) {
  const shown = preview ?? card.score;
  const zone = preview === undefined ? card.zone : zoneOf(preview);
  const moved = preview !== undefined && rank(zone) > rank(card.zone);
  const H = headingLevel === 2 ? "h2" : "h3";

  return (
    <article
      className={`flex flex-col gap-3 rounded-xl bg-surface p-3 min-[400px]:p-[18px] sm:p-[18px] shadow-(--shadow) ${moved ? "border-2" : "border border-line"}`}
      style={moved ? { borderColor: ZONE_FILL[zone] } : undefined}
    >
      <div className="flex items-center gap-3">
        <Avatar name={card.name} url={card.avatarUrl} color="var(--line)" ink="var(--text)" />
        <div className="min-w-0">
          <H className="m-0 truncate text-base font-bold">{card.name}</H>
          <StatusPill status={card.status} />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[150px]">
        <Boiler score={shown} zone={zone} size="sm" width="fluid" status={card.status} />
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`font-mono text-[26px] leading-none font-bold sm:text-[30px] ${ZONE_INK[zone]}`}>
          <span className="sr-only">Pressure </span>
          {shown}
        </span>
        <ZoneBadge zone={zone} size="sm" />
        {preview !== undefined && preview !== card.score && <span className="font-mono text-xs text-muted">was {card.score}</span>}
      </div>
      {card.statusNote && <p className="m-0 text-sm text-fg italic">“{card.statusNote}”</p>}
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-line pt-2.5 text-[13px] text-muted">
        <CountBadges counts={card.counts} teamType={teamType} />
        <span suppressHydrationWarning>
          <span className="sr-only">Updated </span>
          {timeAgo(card.updatedAt)}
        </span>
      </div>
    </article>
  );
}

function rank(z: string) {
  return ["cool", "working", "hot", "redline"].indexOf(z);
}
