"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Status, Weight } from "@/lib/types";
import * as S from "./boilerState";
import type { MyBoilerData, NewTask } from "./boilerState";
import { mayaBoiler } from "./fixture";

export type DataSource = "fixture" | "api";

// TODO(merge): flip to "api" once the engine track's /api/me/boiler is merged.
const SOURCE: DataSource = "fixture";

export interface VentEvent {
  key: number;
  amount: number;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} failed (${res.status})`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/**
 * The one data hook for My Boiler. Every action updates the local state
 * optimistically with the same formula as the engine; in "api" mode it then
 * calls the route and reloads, so the server result always wins.
 */
export function useMyBoiler(source: DataSource = SOURCE) {
  // Fixture data is dated relative to the viewer's clock and timezone, so it is
  // built after mount; building it during a static render would not hydrate.
  const [data, setData] = useState<MyBoilerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [vent, setVent] = useState<VentEvent>({ key: 0, amount: 0 });
  const seq = useRef(0);
  const dataRef = useRef(data);
  dataRef.current = data;

  const load = useCallback(async () => {
    if (source === "fixture") {
      setData((d) => d ?? mayaBoiler());
      return;
    }
    try {
      // TODO(merge): map the engine's response if it differs from MyBoilerData.
      setData(await api<MyBoilerData>("/api/me/boiler"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your boiler");
    }
  }, [source]);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = useCallback(
    async (local: (d: MyBoilerData) => MyBoilerData, remote?: () => Promise<unknown>) => {
      setData((d) => (d ? local(d) : d));
      if (source === "fixture" || !remote) return;
      try {
        await remote();
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        await load();
      }
    },
    [source, load],
  );

  const addTask = useCallback(
    (task: NewTask) => {
      const id = `local-${Date.now()}-${seq.current++}`;
      return mutate(
        (d) => S.addTask(d, task, id, new Date()),
        () => api("/api/tasks", { method: "POST", body: JSON.stringify(task) }),
      );
    },
    [mutate],
  );

  const setTaskDone = useCallback(
    (id: string, done: boolean) => {
      const current = dataRef.current;
      if (!current) return Promise.resolve();
      const { vented } = S.setTaskDone(current, id, done, new Date());
      if (done) setVent((v) => ({ key: v.key + 1, amount: vented }));
      return mutate(
        (d) => S.setTaskDone(d, id, done, new Date()).data,
        // TODO(merge): confirm the PATCH body with the engine track.
        () => api(`/api/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ done }) }),
      );
    },
    [mutate],
  );

  const setEventWeight = useCallback(
    (id: string, weight: Weight, series: boolean) => {
      return mutate(
        (d) => S.setEventWeight(d, id, weight, series),
        () => {
          const item = dataRef.current?.items.find((i) => i.id === id);
          const body = series && item?.seriesKey ? { seriesKey: item.seriesKey, weight } : { eventId: id, weight };
          return api("/api/event-weights", { method: "PUT", body: JSON.stringify(body) });
        },
      );
    },
    [mutate],
  );

  const setStatus = useCallback(
    (status: Status, note: string) =>
      mutate(
        (d) => S.setStatus(d, status, note),
        () => api("/api/me/status", { method: "PATCH", body: JSON.stringify({ status, note }) }),
      ),
    [mutate],
  );

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      if (source === "fixture") {
        await new Promise((r) => setTimeout(r, 600));
        setData((d) => (d ? { ...d, syncedAt: new Date().toISOString() } : d));
      } else {
        await api("/api/sync", { method: "POST" });
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [source, load]);

  return { source, data, error, syncing, vent, addTask, setTaskDone, setEventWeight, setStatus, refresh };
}

export type MyBoiler = ReturnType<typeof useMyBoiler>;
