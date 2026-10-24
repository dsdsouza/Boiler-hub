"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { SOUND_KEY, readStorage, writeStorage } from "./theme";

interface SoundState {
  soundOn: boolean;
  toggleSound: () => void;
}

const SoundContext = createContext<SoundState>({ soundOn: false, toggleSound: () => {} });

/** Whistle sound preference. Off by default, remembered per browser. */
export function useSound() {
  return useContext(SoundContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    if (readStorage(SOUND_KEY) === "on") setSoundOn(true);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      writeStorage(SOUND_KEY, on ? "off" : "on");
      return !on;
    });
  }, []);

  return <SoundContext.Provider value={{ soundOn, toggleSound }}>{children}</SoundContext.Provider>;
}
