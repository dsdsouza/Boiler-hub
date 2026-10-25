"use client";

import { useEffect, useRef, useState } from "react";
import { FlameLoader } from "@/components/ui/FlameLoader";

const STEAM_THOUGHTS = [
  "Steeping on it…",
  "Brewing a bright idea…",
  "Full steam a-thought…",
  "Whistling up an answer…",
  "Letting that thought simmer…",
  "A little puff of inspiration…",
  "Warming up the thought boiler…",
  "Putting the kettle on…",
];

export function PipThinking() {
  const [thought, setThought] = useState(() => Math.floor(Math.random() * STEAM_THOUGHTS.length));
  const [paused, setPaused] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let visible = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      const pause = document.hidden || !visible;
      setPaused(pause);
      clearInterval(timer);
      if (!pause && !reducedMotion.matches) {
        timer = setInterval(() => {
          // Choose a different line without repeating the previous one.
          setThought((current) => (current + 1 + Math.floor(Math.random() * (STEAM_THOUGHTS.length - 1))) % STEAM_THOUGHTS.length);
        }, 4500);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    if (root.current) observer.observe(root.current);
    document.addEventListener("visibilitychange", sync);
    reducedMotion.addEventListener("change", sync);
    sync();
    return () => {
      clearInterval(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reducedMotion.removeEventListener("change", sync);
    };
  }, []);

  return <div ref={root} role="status" data-paused={paused || undefined} className="bp-pip-thinking flex max-w-[95%] items-center gap-2.5 self-start rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-2 text-sm leading-relaxed text-body">
    <span className="sr-only">Pip is preparing a reply.</span>
    <FlameLoader size="sm" decorative />
    <span key={thought} className="bp-pip-thought" aria-hidden="true">{STEAM_THOUGHTS[thought]}</span>
  </div>;
}
