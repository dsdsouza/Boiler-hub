"use client";

import { useLinkStatus } from "next/link";

export function LinkPending({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <>
    <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 animate-pulse rounded-full bg-brass motion-reduce:animate-none" />
    <span role="status" className="sr-only">Opening {label}…</span>
  </>;
}
