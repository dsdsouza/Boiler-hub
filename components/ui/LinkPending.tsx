"use client";

import { useLinkStatus } from "next/link";
import { FlameLoader } from "./FlameLoader";

export function LinkPending({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <>
    <span className="absolute inset-0 grid place-items-center rounded-[inherit] bg-bg-2" aria-hidden="true"><FlameLoader size="sm" decorative /></span>
    <span role="status" className="sr-only">Opening {label}…</span>
  </>;
}
