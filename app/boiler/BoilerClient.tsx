"use client";

import { MyBoilerView } from "@/components/boiler/MyBoilerView";
import { useMyBoiler } from "@/components/boiler/useMyBoiler";
import { BoilerCompanion } from "@/components/mascot/BoilerCompanion";

export function BoilerClient() {
  const boiler = useMyBoiler();
  return (
    <div className="flex flex-col gap-4">
      <BoilerCompanion data={boiler.data} vent={boiler.vent} />
      <MyBoilerView boiler={boiler} />
    </div>
  );
}
