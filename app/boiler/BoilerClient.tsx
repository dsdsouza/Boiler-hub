"use client";

import { MyBoilerView } from "@/components/boiler/MyBoilerView";
import { useMyBoiler } from "@/components/boiler/useMyBoiler";

export function BoilerClient() {
  const boiler = useMyBoiler();
  return (
    <div className="flex flex-col gap-4">
      <MyBoilerView boiler={boiler} />
    </div>
  );
}
