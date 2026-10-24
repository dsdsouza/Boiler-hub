"use client";

import { useState } from "react";
import { Boiler } from "./Boiler";
import { ZONE_DESC, ZONE_INK, ZONE_LABEL, zoneOf } from "@/components/ui/zones";

/** Landing hero: an idling boiler with a "drag to add pressure" slider (Main.dc.html). */
export function HeroBoiler() {
  const [score, setScore] = useState(62);
  const zone = zoneOf(score);
  return (
    <div className="flex flex-col items-center gap-5 rounded-[14px] border border-line bg-surface px-5 pt-9 pb-7 shadow-(--shadow) plate sm:px-8">
      <div className="w-full max-w-[320px]">
        <Boiler score={score} width="fluid" />
      </div>
      <div className="flex w-full max-w-[380px] flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="pressure" className="text-sm font-medium text-body">
            Drag to add pressure
          </label>
          <span className={`font-mono text-[15px] font-bold ${ZONE_INK[zone]}`} aria-hidden="true">
            {score} · {ZONE_LABEL[zone].toUpperCase()}
          </span>
        </div>
        <input
          id="pressure"
          type="range"
          min={0}
          max={100}
          value={score}
          aria-valuetext={`${score}, ${ZONE_LABEL[zone]}`}
          onChange={(e) => setScore(Number(e.target.value))}
          className="m-0 h-7 w-full cursor-pointer"
        />
        <div className="text-[13px] text-muted">{ZONE_DESC[zone]}</div>
      </div>
    </div>
  );
}
