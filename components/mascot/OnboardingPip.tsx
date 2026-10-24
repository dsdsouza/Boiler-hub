"use client";

import type { Zone } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { ZONES, ZONE_INK_VAR, ZONE_LABEL, ZONE_RANGE } from "@/components/ui/zones";
import { Mascot } from "./Mascot";
import { usePipAccessory } from "./useAccessory";
import { FIRST_READING, MASCOT_NAME, ZONE_PRESET } from "./voice";

// Pip in onboarding: an introduction above the steps, and a line on the first reading.

export function OnboardingPip() {
  const accessory = usePipAccessory();
  return (
    <Card as="section" plate emphasis aria-labelledby="pip-hello" className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:gap-6 sm:px-7">
      <div className="flex flex-none justify-center sm:w-[112px]">
        <Mascot score={ZONE_PRESET.cool} size={104} reaction="wave" accessory={accessory} />
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <CardTitle id="pip-hello">Hi, I’m {MASCOT_NAME}.</CardTitle>
        <p className="m-0 text-[15px] leading-relaxed text-body">
          I keep an eye on your pressure, so you can see a heavy week coming before it arrives. I’ll speak up rarely, and only with something you can act on.
        </p>
        <ul aria-label={`How ${MASCOT_NAME} looks in each zone`} className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-2 p-0 sm:grid-cols-4">
          {ZONES.map((z) => (
            <li key={z} className="flex items-center gap-2">
              <Mascot score={ZONE_PRESET[z]} size={28} />
              <span className="flex flex-col">
                <span className="text-sm font-semibold" style={{ color: ZONE_INK_VAR[z] }}>
                  {ZONE_LABEL[z]}
                </span>
                <span className="font-mono text-[11px] text-muted">{ZONE_RANGE[z]}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="m-0 text-[13px] text-muted">It measures load, not how you feel. You’re the judge of that.</p>
      </div>
    </Card>
  );
}

export function FirstReadingPip({ score, zone }: { score: number; zone: Zone }) {
  const reaction = zone === "hot" || zone === "redline" ? "attentive" : zone === "cool" ? "wave" : "idle";
  const accessory = usePipAccessory();
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-bg-2 px-3 py-2.5">
      <Mascot score={score} size={40} reaction={reaction} accessory={accessory} />
      <p className="m-0 text-sm leading-snug text-body">
        <strong className="text-fg">{MASCOT_NAME}:</strong> That’s your first reading. {FIRST_READING[zone]}
      </p>
    </div>
  );
}
