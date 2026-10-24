"use client";

import { MyBoilerView } from "@/components/boiler/MyBoilerView";
import { useMyBoiler } from "@/components/boiler/useMyBoiler";
import { BoilerCompanion } from "@/components/mascot/BoilerCompanion";

export function DemoMyBoiler() {
  const boiler = useMyBoiler("fixture");
  return (
    <div className="flex flex-col gap-4">
      <BoilerCompanion data={boiler.data} vent={boiler.vent} />
      <MyBoilerView boiler={boiler} title="Maya’s boiler" sourceLabel="Demo calendar" headingLevel={2} />
    </div>
  );
}
