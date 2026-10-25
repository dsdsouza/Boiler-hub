"use client";

import { MyBoilerView } from "@/components/boiler/MyBoilerView";
import type { MyBoiler } from "@/components/boiler/useMyBoiler";

export function DemoMyBoiler({ boiler }: { boiler: MyBoiler }) {
  return (
    <div className="flex flex-col gap-4">
      <MyBoilerView boiler={boiler} title="Maya’s boiler" headingLevel={2} />
    </div>
  );
}
