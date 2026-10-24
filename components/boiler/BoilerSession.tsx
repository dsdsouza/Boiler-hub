"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { MyBoilerData } from "./boilerState";
import { OwnerCache } from "./session-cache";

const BoilerSession = createContext<OwnerCache<MyBoilerData> | null>(null);

export function BoilerSessionProvider({ children }: { children: ReactNode }) {
  const [session] = useState(() => new OwnerCache<MyBoilerData>());
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent).detail?.origin !== "boiler") session.invalidate();
    };
    window.addEventListener("boiler:data-changed", changed);
    return () => window.removeEventListener("boiler:data-changed", changed);
  }, [session]);
  return <BoilerSession.Provider value={session}>{children}</BoilerSession.Provider>;
}

export function useBoilerSession() {
  const session = useContext(BoilerSession);
  // Demo/isolated component renders keep their own cache.
  const [local] = useState(() => new OwnerCache<MyBoilerData>());
  return session ?? local;
}
