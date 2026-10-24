import { Card } from "@/components/ui/Card";
import { ZONES, ZONE_INK_VAR, ZONE_LABEL } from "@/components/ui/zones";
import { Mascot } from "@/components/mascot/Mascot";
import { MASCOT_NAME, ZONE_PRESET } from "@/components/mascot/voice";
import { ACCESSORIES } from "@/components/mascot/wardrobe";

// Every accessory in every zone, plus the dock size, so artwork is reviewed where it actually shows up.

export function WardrobeSheet({ still }: { still: boolean }) {
  const items = ACCESSORIES.filter((a) => a.id !== "none");
  return (
    <section id="wardrobe" aria-labelledby="mp-wardrobe" className="flex flex-col gap-4 border-t border-line pt-8">
      <div className="flex flex-col gap-1">
        <h2 id="mp-wardrobe" className="m-0 font-display text-[36px] leading-none font-normal tracking-[0.03em]">
          {MASCOT_NAME}’s wardrobe
        </h2>
        <p className="m-0 text-sm text-muted">
          One cosmetic at a time, all free, picked from “Dress up” on the dock or My Boiler. Nothing covers the gauge eye, face or water.
          {still && " Motion is paused."}
        </p>
      </div>
      <div className="overflow-x-auto">
        <Card className="min-w-[720px] px-4 py-4">
          <div className="grid grid-cols-[110px_repeat(4,minmax(0,1fr))_90px] items-center gap-y-2">
            <span />
            {ZONES.map((z) => (
              <span key={z} className="text-center text-sm font-semibold" style={{ color: ZONE_INK_VAR[z] }}>
                {ZONE_LABEL[z]}
              </span>
            ))}
            <span className="text-center font-mono text-[11px] text-muted">DOCK · 44PX</span>
            {items.map((a) => (
              <div key={a.id} className="contents">
                <span id={`wardrobe-${a.id}`} className="scroll-mt-4 text-sm font-semibold text-fg">
                  {a.label}
                </span>
                {ZONES.map((z) => (
                  <div key={z} className="flex justify-center">
                    <Mascot score={ZONE_PRESET[z]} size={96} accessory={a.id} label={`${MASCOT_NAME} in ${a.label}, ${ZONE_LABEL[z]}`} />
                  </div>
                ))}
                <div className="flex justify-center">
                  <Mascot score={ZONE_PRESET.working} size={44} accessory={a.id} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
