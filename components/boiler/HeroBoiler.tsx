"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Boiler } from "./Boiler";
import { ZONES, ZONE_FILL, ZONE_INK, ZONE_LABEL, ZONE_RANGE, zoneOf } from "@/components/ui/zones";
import { ZONE_MIN } from "@/lib/pressure/config";

const subscribe = () => () => {};
const DIVIDERS = ZONES.slice(1);

/** Landing hero: an idling boiler with a native, keyboard-accessible pressure slider. */
export function HeroBoiler() {
  const [score, setScore] = useState(62);
  const interactive = useSyncExternalStore(subscribe, () => true, () => false);
  const zone = zoneOf(score);
  const control = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const node = control.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col items-center gap-5 rounded-[14px] border border-line bg-surface px-5 pt-9 pb-7 shadow-(--shadow) plate sm:px-8">
      <div className="w-full max-w-[320px]">
        <Boiler score={score} width="fluid" />
      </div>
      <div className="w-full max-w-[380px]">
        <div
          ref={control}
          className="bp-pressure-control"
          data-zone={zone}
          data-paused={!interactive || !visible ? "" : undefined}
          style={{
            "--pressure-color": ZONE_FILL[zone],
            "--pressure-fill": score / 100,
            "--pressure-shake": zone === "redline" ? "0.5px" : "0.25px",
          } as CSSProperties}
        >
          <div className="bp-pressure-track" aria-hidden="true">
            <div className="bp-pressure-rail"><div className="bp-pressure-fill" /></div>
            {DIVIDERS.map((z) => <span key={z} className="bp-pressure-divider" style={{ left: `${ZONE_MIN[z]}%` }} title={`${ZONE_LABEL[z]} starts at ${ZONE_MIN[z]}%`} />)}
          </div>
          <input
            id="pressure"
            type="range"
            min={0}
            max={100}
            value={score}
            disabled={!interactive}
            aria-valuetext={`${score} percent, ${ZONE_LABEL[zone]}`}
            aria-describedby="pressure-zones"
            onChange={(e) => setScore(Number(e.target.value))}
            className="bp-pressure-slider"
          />
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <label htmlFor="pressure" className="text-[13px] font-medium text-body sm:text-sm">Drag to add pressure</label>
          <output htmlFor="pressure" className={`ml-auto inline-flex items-baseline gap-2 font-mono ${ZONE_INK[zone]}`} aria-hidden="true">
            <span className="text-[15px] font-bold tabular-nums">{score}%</span>
            <span className="text-[11px] font-medium tracking-wide uppercase">{ZONE_LABEL[zone]}</span>
          </output>
        </div>
        <p id="pressure-zones" className="sr-only">{ZONES.map((z) => `${ZONE_LABEL[z]}: ${ZONE_RANGE[z]} percent`).join(". ")}.</p>
      </div>
    </div>
  );
}
