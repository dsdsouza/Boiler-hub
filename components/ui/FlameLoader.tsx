"use client";

import { useEffect, useRef, useState } from "react";

const FLAME = "M34 4C36 19 23 24 24 37C18 34 17 28 18 23C8 33 5 42 6 51C7 65 18 76 32 76C47 76 58 65 58 50C58 35 49 25 45 22C46 34 40 39 37 40C42 25 41 14 34 4Z";

/** An indeterminate fill, never a claim about actual download progress. */
export function FlameLoader({
  label = "Loading…",
  size = "md",
  decorative = false,
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
  decorative?: boolean;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let visible = true;
    const sync = () => setPaused(document.hidden || !visible);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    if (root.current) observer.observe(root.current);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return <span ref={root} role={decorative ? undefined : "status"} aria-hidden={decorative || undefined}
    data-flame-loader="" data-paused={paused || undefined} className={`bp-loading-flame bp-loading-flame-${size}`}>
    <svg viewBox="0 0 64 80" width="64" height="80" fill="currentColor" aria-hidden="true" focusable="false">
      <path d={FLAME} />
      <path d={FLAME} className="bp-loading-flame-fill" />
    </svg>
    {!decorative && <span className="sr-only">{label}</span>}
  </span>;
}
