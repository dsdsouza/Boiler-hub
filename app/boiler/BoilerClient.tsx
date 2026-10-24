"use client";

import { MyBoilerView } from "@/components/boiler/MyBoilerView";
import { useMyBoiler } from "@/components/boiler/useMyBoiler";

export function BoilerClient({ userId }: { userId: string }) {
  const boiler = useMyBoiler("api", userId);
  return (
    <div className="flex flex-col gap-4">
      <MyBoilerView boiler={boiler} />
    </div>
  );
}
