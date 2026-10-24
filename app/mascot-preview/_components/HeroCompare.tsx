"use client";

import { useState } from "react";
import { Boiler } from "@/components/boiler/Boiler";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ZONES, ZONE_INK_VAR, ZONE_LABEL, zoneOf } from "@/components/ui/zones";
import type { HeroFace } from "@/components/mascot/heroExpression";
import { PipHero } from "@/components/mascot/PipHero";
import { usePipAccessory } from "@/components/mascot/useAccessory";
import { MASCOT_NAME, ZONE_PRESET } from "@/components/mascot/voice";
import { chip } from "./scenes";

// The classic boiler and the Pip hero side by side at the same score, to review the swap.

export function HeroCompare({ still }: { still: boolean }) {
  const [score, setScore] = useState(64);
  const [vent, setVent] = useState(0);
  const [face, setFace] = useState<HeroFace>("expressive");
  const accessory = usePipAccessory();
  const zone = zoneOf(score);

  return (
    <section id="hero" aria-labelledby="mp-hero" className="flex flex-col gap-4 border-t border-line pt-8">
      <div className="flex flex-col gap-1">
        <h2 id="mp-hero" className="m-0 font-display text-[36px] leading-none font-normal tracking-[0.03em]">
          The boiler becomes {MASCOT_NAME}
        </h2>
        <p className="m-0 max-w-[72ch] text-sm text-muted">
          Same machine underneath: the gauge (now {MASCOT_NAME}’s monocle eye), steam, shake at Hot, the whistle at 90 and the vent burst all come from the boiler.
          Drag past 90 to hear the whistle (sound toggle in the header); “Complete a task” vents steam and {MASCOT_NAME} celebrates.
          {still && " Motion is paused."}
        </p>
      </div>
      <Card className="flex flex-col gap-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label htmlFor="hero-score" className="flex min-w-[240px] flex-1 flex-col gap-1.5 text-sm text-body">
            <span className="flex justify-between">
              <span>Pressure</span>
              <span className="font-mono font-bold" style={{ color: ZONE_INK_VAR[zone] }}>
                {score} · {ZONE_LABEL[zone]}
              </span>
            </span>
            <input id="hero-score" type="range" min={0} max={100} value={score} onChange={(e) => setScore(Number(e.target.value))} className="accent-[#D1A85A]" />
          </label>
          <div role="group" aria-label="Face" className="flex gap-2">
            {(["expressive", "calm"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={face === f} onClick={() => setFace(f)} className={chip(face === f)}>
                {f === "expressive" ? "Your boiler" : "Teammate (calm)"}
              </button>
            ))}
          </div>
          <Button onClick={() => setVent((v) => v + 1)}>Complete a task</Button>
        </div>
        <div id="hero-figures" className="grid scroll-mt-4 grid-cols-1 gap-4 sm:grid-cols-2">
          <figure className="m-0 flex flex-col items-center gap-2">
            <div className="w-full max-w-[280px]">
              <Boiler score={score} width="fluid" vent={vent} animate={!still} />
            </div>
            <figcaption className="text-sm text-muted">Today’s boiler</figcaption>
          </figure>
          <figure className="m-0 flex flex-col items-center gap-2">
            <div className="w-full max-w-[280px]">
              <PipHero score={score} vent={vent} face={face} accessory={accessory} animate={!still} />
            </div>
            <figcaption className="text-sm text-muted">
              {MASCOT_NAME} hero{accessory !== "none" && " (wearing your wardrobe pick)"}
            </figcaption>
          </figure>
        </div>
      </Card>
      <div id="hero-zones" className="grid scroll-mt-4 grid-cols-2 gap-3 sm:grid-cols-5">
        {ZONES.map((z) => (
          <figure key={z} className="m-0 flex flex-col items-center gap-1">
            <PipHero score={ZONE_PRESET[z]} accessory={accessory} animate={!still} whistle={false} />
            <figcaption className="text-sm font-semibold" style={{ color: ZONE_INK_VAR[z] }}>
              {ZONE_LABEL[z]} · {ZONE_PRESET[z]}
            </figcaption>
          </figure>
        ))}
        <figure className="m-0 flex flex-col items-center gap-1">
          <PipHero score={ZONE_PRESET.redline} face="calm" accessory={accessory} animate={!still} whistle={false} />
          <figcaption className="text-center text-sm text-muted">Teammate, calm · {ZONE_PRESET.redline}</figcaption>
        </figure>
      </div>
    </section>
  );
}
