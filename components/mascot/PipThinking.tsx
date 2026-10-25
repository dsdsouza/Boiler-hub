"use client";

import { useEffect, useRef, useState } from "react";
import { ValveLoader } from "@/components/ui/ValveLoader";

const STEAM_THOUGHTS = [
  "Steeping on it",
  "Brewing a bright idea",
  "Full steam a-thought",
  "Whistling up an answer",
  "Letting that thought simmer",
  "A little puff of inspiration",
  "Warming up the thought boiler",
  "Putting the kettle on",
];

export function PipThinking() {
  const [thought, setThought] = useState(() => Math.floor(Math.random() * STEAM_THOUGHTS.length));
  const [paused, setPaused] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const line = STEAM_THOUGHTS[thought];
  const lastWord = line.lastIndexOf(" ") + 1;

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
    <ValveLoader size="sm" decorative />
    <span className="min-w-0" aria-hidden="true">
      <span key={`${thought}-start`} className="bp-pip-thought">{line.slice(0, lastWord)}</span>
      <span className="inline-block whitespace-nowrap">
        <span key={`${thought}-end`} className="bp-pip-thought">{line.slice(lastWord)}</span>
        {/* Keep the dots mounted when the thought changes so their wave stays continuous. */}
        <svg className="bp-pip-dots" viewBox="0 0 18 12" width="18" height="12" fill="currentColor" aria-hidden="true" focusable="false">
          <circle className="bp-pip-dot" cx="3" cy="10" r="1.5" />
          <circle className="bp-pip-dot" cx="9" cy="10" r="1.5" />
          <circle className="bp-pip-dot" cx="15" cy="10" r="1.5" />
        </svg>
      </span>
    </span>
  </div>;
}
