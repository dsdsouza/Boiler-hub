"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const SHAPES = {
  flame: "M34 4C36 19 23 24 24 37C18 34 17 28 18 23C8 33 5 42 6 51C7 65 18 76 32 76C47 76 58 65 58 50C58 35 49 25 45 22C46 34 40 39 37 40C42 25 41 14 34 4Z",
  valve: "M13 10H51A9 9 0 0 1 51 28H40V74H24V28H13A9 9 0 0 1 13 10Z",
} as const;

export type FillLoaderProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  decorative?: boolean;
};

/** Shared indeterminate fill, never a claim about actual progress. */
export function FillLoader({ shape, label = "Loading…", size = "md", decorative = false, motionSeconds }: FillLoaderProps & { shape: keyof typeof SHAPES; motionSeconds?: number }) {
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
    data-fill-loader={shape} data-flame-loader={shape === "flame" ? "" : undefined} data-paused={paused || undefined} className={`bp-fill-loader bp-fill-loader-${size}`}
    style={motionSeconds ? { "--bp-loader-motion-duration": `${motionSeconds}s` } as CSSProperties : undefined}>
    <svg viewBox="0 0 64 80" width="64" height="80" fill="currentColor" aria-hidden="true" focusable="false">
      <g className={`bp-fill-loader-shape bp-fill-loader-${shape}`}>
        <path d={SHAPES[shape]} />
        <path d={SHAPES[shape]} className="bp-fill-loader-fill" />
      </g>
    </svg>
    {!decorative && <span className="sr-only">{label}</span>}
  </span>;
}
