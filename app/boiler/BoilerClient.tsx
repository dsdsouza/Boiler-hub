"use client";

import { MyBoilerView } from "@/components/boiler/MyBoilerView";
import { useMyBoiler } from "@/components/boiler/useMyBoiler";

export function BoilerClient() {
  const boiler = useMyBoiler();
  return (
    <>
      {boiler.source === "fixture" && (
        <p role="note" className="mt-0 mb-6 rounded-lg border border-dashed border-rivet px-4 py-2.5 text-sm text-body">
          Showing sample data while calendar sync is being wired up.
        </p>
      )}
      <MyBoilerView boiler={boiler} />
    </>
  );
}
