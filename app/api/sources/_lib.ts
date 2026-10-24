import "server-only";
import { NextResponse } from "next/server";
import type { SourceItem } from "@/lib/sources/types";

// Shared helpers for /api/sources. Auth helpers come from app/api/me/_lib/http.ts.

export const MAX_SOURCES = 5;
export const ITEM_KEY_RE = /^[0-9a-f]{64}$/;

export function notFound() {
  return NextResponse.json({ error: "Source not found" }, { status: 404 });
}

/** "Found 5 deadlines and 4 events" counts. */
export function itemCounts(items: SourceItem[]) {
  const tasks = items.filter((i) => i.kind === "task").length;
  return { itemCount: items.length, tasks, events: items.length - tasks };
}
