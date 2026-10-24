"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/** Calm, interruptible UI motion. Individual illustrations keep their own timing. */
export function AppMotion({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}>{children}</MotionConfig>;
}
