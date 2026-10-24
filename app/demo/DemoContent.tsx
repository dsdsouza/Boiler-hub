"use client";

import { useMyBoiler } from "@/components/boiler/useMyBoiler";
import { DemoEngineRoom } from "./DemoEngineRoom";
import { DemoMyBoiler } from "./DemoMyBoiler";

export function DemoContent() {
  const boiler = useMyBoiler("fixture");
  return (
    <>
      <section id="engine-room" aria-label="Engine Room" className="scroll-mt-4">
        <DemoEngineRoom personal={boiler.data} />
      </section>
      <section id="maya" aria-label="Maya’s boiler" className="scroll-mt-4 border-t border-line pt-12">
        <DemoMyBoiler boiler={boiler} />
      </section>
    </>
  );
}
