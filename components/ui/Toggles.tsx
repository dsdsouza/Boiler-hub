"use client";

import { useEffect, useState } from "react";
import { unlockAudio } from "@/components/boiler/Whistle";
import { useSound } from "./Providers";
import { THEME_KEY, readStorage, writeStorage, type ThemePref } from "./theme";

const iconBtn =
  "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-transparent px-3 text-sm font-medium text-body hover:border-rivet hover:text-fg";

export function SoundToggle({ compact }: { compact?: boolean }) {
  const { soundOn, toggleSound } = useSound();
  const label = soundOn ? "Sound on" : "Sound off";
  return (
    <button
      type="button"
      onClick={() => {
        if (!soundOn) unlockAudio();
        toggleSound();
      }}
      aria-pressed={soundOn}
      aria-label={compact ? "Whistle sound" : undefined}
      title={label}
      className={iconBtn}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H3v6h3l5 4z" />
        {soundOn ? <path d="M16 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" /> : <path d="M16 10l4 4M20 10l-4 4" />}
      </svg>
      {!compact && <span>{label}</span>}
    </button>
  );
}

function currentTheme(): ThemePref {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePref | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!readStorage(THEME_KEY)) setTheme(currentTheme());
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const flip = () => {
    const next: ThemePref = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    writeStorage(THEME_KEY, next);
    setTheme(next);
  };

  const dark = theme !== "light";
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className={iconBtn}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        )}
      </svg>
    </button>
  );
}
