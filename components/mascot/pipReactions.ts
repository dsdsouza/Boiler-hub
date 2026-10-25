"use client";

import { useEffect, useState } from "react";
import { ZONE_MIN } from "@/lib/pressure";
import type { Reaction } from "./voice";

// Moments elsewhere in the app ask Pip for a brief reaction (a dance when work is done,
// boiling over at Redline). A window event keeps callers free of the floating companion.

export type Cue = Extract<Reaction, "dance" | "boil" | "celebrate">;

export const PIP_CUE_EVENT = "pip:cue";

/** How long each cue holds before Pip returns to its usual expression; matches mascot.css. */
export const CUE_MS: Record<Cue, number> = { dance: 3000, boil: 2000, celebrate: 1400 };

/** An idle dance comes back every one to two and a half minutes. */
export const IDLE_DANCE_MIN_MS = 60_000;
export const IDLE_DANCE_SPREAD_MS = 90_000;

export function cuePip(cue: Cue) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Cue>(PIP_CUE_EVENT, { detail: cue }));
}

/** True when a score moves into Redline. The first reading (no previous score) never counts. */
export function crossedIntoRedline(previous: number | null | undefined, next: number): boolean {
  return previous != null && previous < ZONE_MIN.redline && next >= ZONE_MIN.redline;
}

export function idleDanceDelay(random: () => number = Math.random): number {
  return IDLE_DANCE_MIN_MS + Math.floor(random() * IDLE_DANCE_SPREAD_MS);
}

/**
 * The cue Pip is showing now, or null. With `idle`, Pip also dances now and then while the page is
 * visible. Nothing is cued under prefers-reduced-motion: the reactions are motion.
 */
export function usePipCue({ idle = false }: { idle?: boolean } = {}): Cue | null {
  const [cue, setCue] = useState<Cue | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let clear: ReturnType<typeof setTimeout> | undefined;
    const show = (next: Cue) => {
      if (reduce?.matches) return;
      clearTimeout(clear);
      setCue(next);
      clear = setTimeout(() => setCue(null), CUE_MS[next]);
    };
    const onCue = (event: Event) => show((event as CustomEvent<Cue>).detail);
    window.addEventListener(PIP_CUE_EVENT, onCue);

    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      idleTimer = setTimeout(() => {
        if (!document.hidden) show("dance");
        schedule();
      }, idleDanceDelay());
    };
    if (idle) schedule();

    return () => {
      window.removeEventListener(PIP_CUE_EVENT, onCue);
      clearTimeout(clear);
      clearTimeout(idleTimer);
    };
  }, [idle]);

  return cue;
}
