"use client";

import { MyBoilerView } from "@/components/boiler/MyBoilerView";
import { useMyBoiler } from "@/components/boiler/useMyBoiler";

export function DemoMyBoiler() {
  const boiler = useMyBoiler("fixture");
  return <MyBoilerView boiler={boiler} title="Maya’s boiler" sourceLabel="Demo calendar" headingLevel={2} />;
}
