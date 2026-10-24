import type { BoilerResponse, SourceInfo } from "@/lib/pressure/api-types";

// Client calls to /api/sources. Types only from the engine; safe in client components.

export interface AddedSource {
  source: SourceInfo;
  itemCount: number;
  tasks: number;
  events: number;
  /** null when the source was saved but the resync after it failed (see `warning`). */
  boiler: BoilerResponse | null;
  warning?: string;
}

export interface TestResult {
  ok: boolean;
  error: string | null;
  itemCount: number;
  tasks: number;
  events: number;
  source: SourceInfo;
}

export async function sourcesCall<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(json?.error ?? `${method} ${path} failed (${res.status})`);
  if (method !== "GET" && typeof window !== "undefined") window.dispatchEvent(new Event("boiler:data-changed"));
  return json as T;
}

export function foundLine(r: { tasks: number; events: number }) {
  const t = `${r.tasks} ${r.tasks === 1 ? "deadline" : "deadlines"}`;
  const e = `${r.events} ${r.events === 1 ? "event" : "events"}`;
  return `Found ${t} and ${e} in this feed`;
}
