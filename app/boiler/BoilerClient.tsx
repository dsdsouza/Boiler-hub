"use client";

import { MyBoilerView } from "@/components/boiler/MyBoilerView";
import { useMyBoiler } from "@/components/boiler/useMyBoiler";

export function BoilerClient() {
  const boiler = useMyBoiler();
  return <MyBoilerView boiler={boiler} />;
}
