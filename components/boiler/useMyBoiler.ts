"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Size, Status, Weight } from "@/lib/types";
import type { BoilerResponse } from "@/lib/pressure/api-types";
import * as S from "./boilerState";
import type { MyBoilerData, NewTask } from "./boilerState";
import { mayaBoiler } from "./fixture";
import { ownerMutations } from "./owner-mutations";
import { clearItemsBody, eventWeightBody, newTaskBody, sourceItemBody, statusBody, taskDoneBody, toMyBoilerData } from "./fromApi";
import { useBoilerSession } from "./BoilerSession";

export type DataSource = "fixture" | "api";

const SOURCE: DataSource = "api";

export interface VentEvent {
  key: number;
  amount: number;
}

class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `${init?.method ?? "GET"} ${path} failed (${res.status})`, res.status);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/**
 * The one data hook for My Boiler. Every action updates the local state optimistically with the
 * lib/pressure formulas; in "api" mode it then calls the engine route, and the BoilerResponse that
 * route returns replaces the local guess, so the server result always wins.
 */
export function useMyBoiler(source: DataSource = SOURCE, userId?: string) {
  const session = useBoilerSession();
  // Fixture data is dated relative to the viewer's clock and timezone, so it is
  // built after mount; building it during a static render would not hydrate.
  const [data, setData] = useState<MyBoilerData | null>(() => source === "api" && userId ? session.read(userId) : null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [vent, setVent] = useState<VentEvent>({ key: 0, amount: 0 });
  const seq = useRef(0);
  const dataRef = useRef(data);
  dataRef.current = data;
  const mutations = useMemo(() => source === "api" && userId
    ? ownerMutations(session, userId, async () => toMyBoilerData(await api<BoilerResponse>("/api/me/boiler")))
    : null, [session, source, userId]);

  const load = useCallback(async (force = false) => {
    if (source === "fixture") {
      setData((d) => d ?? mayaBoiler());
      return;
    }
    if (!userId) return;
    try {
      const fresh = await session.load(userId, async () => toMyBoilerData(await api<BoilerResponse>("/api/me/boiler")), force);
      if (fresh) { setData(session.read(userId)); setError(null); }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { session.clear(); setData(null); }
      setError(e instanceof Error ? e.message : "Could not load your boiler");
    }
  }, [source, userId, session]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (source !== "api" || !userId) return;
    return session.subscribe(() => {
      const fresh = session.read(userId);
      dataRef.current = fresh;
      setData(fresh);
    });
  }, [source, userId, session]);

  useEffect(() => mutations?.subscribe(setError), [mutations]);

  useEffect(() => {
    if (source !== "api") return;
    const focus = () => { void load(); };
    const changed = (event: Event) => {
      if ((event as CustomEvent).detail?.origin !== "boiler") queueMicrotask(() => { void load(true); });
    };
    window.addEventListener("focus", focus);
    window.addEventListener("boiler:data-changed", changed);
    return () => {
      window.removeEventListener("focus", focus);
      window.removeEventListener("boiler:data-changed", changed);
    };
  }, [load, source]);

  /** Optimistic local update, then the remote call. A returned BoilerResponse replaces local state. */
  const mutate = useCallback(
    async (local: (d: MyBoilerData) => MyBoilerData, remote?: () => Promise<BoilerResponse | null>) => {
      if (source === "fixture" || !remote) {
        setData((d) => (d ? local(d) : d));
        return true;
      }
      if (!mutations) return false;
      const saved = await mutations.enqueue(local, async () => {
        const fresh = await remote();
        return fresh ? toMyBoilerData(fresh) : null;
      });
      if (saved) window.dispatchEvent(new CustomEvent("boiler:data-changed", { detail: { origin: "boiler" } }));
      return saved;
    },
    [source, mutations],
  );

  const addTask = useCallback(
    (task: NewTask) => {
      const id = `local-${Date.now()}-${seq.current++}`;
      return mutate(
        (d) => S.addTask(d, task, id, new Date()),
        async () =>
          (await api<{ boiler: BoilerResponse }>("/api/tasks", { method: "POST", body: JSON.stringify(newTaskBody(task)) })).boiler,
      );
    },
    [mutate],
  );

  // Demo team posts share the same owner state as manual tasks. No server write.
  const addDemoAssignment = useCallback((task: NewTask) => {
    if (source !== "fixture") return;
    const id = `demo-assignment-${Date.now()}-${seq.current++}`;
    setData((d) => d ? S.addTask(d, task, id, new Date(), "team") : d);
  }, [source]);

  const setTaskDone = useCallback(
    (id: string, done: boolean) => {
      const current = dataRef.current;
      if (!current) return Promise.resolve();
      const { vented } = S.setTaskDone(current, id, done, new Date());
      if (done) setVent((v) => ({ key: v.key + 1, amount: vented }));
      // Source items (ICS, GitHub) keep their done mark in source_item_state, not in tasks.
      const meta = current.taskMeta?.[id];
      return mutate(
        (d) => S.setTaskDone(d, id, done, new Date()).data,
        async () =>
          (
            await api<{ boiler: BoilerResponse }>(meta ? "/api/sources/items" : `/api/tasks/${encodeURIComponent(id)}`, {
              method: "PATCH",
              body: JSON.stringify(meta ? sourceItemBody(meta, { done }) : taskDoneBody(done)),
            })
          ).boiler,
      );
    },
    [mutate],
  );

  const setTaskSize = useCallback(
    (id: string, size: Size) => {
      const meta = dataRef.current?.taskMeta?.[id];
      return mutate(
        (d) => S.setTaskSize(d, id, size, new Date()),
        async () =>
          (
            await api<{ boiler: BoilerResponse }>(meta ? "/api/sources/items" : `/api/tasks/${encodeURIComponent(id)}`, {
              method: "PATCH",
              body: JSON.stringify(meta ? sourceItemBody(meta, { size }) : { size }),
            })
          ).boiler,
      );
    },
    [mutate],
  );

  /** Remove a manual task (stale ones, mostly). */
  const removeTask = useCallback(
    (id: string) =>
      mutate(
        (d) => S.clearTasks(d, new Set([id])),
        async () => (await api<{ boiler: BoilerResponse }>(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" })).boiler,
      ),
    [mutate],
  );

  /** Mark reviewed overdue source tasks complete, retaining them for restoration. */
  const clearOverdue = useCallback(() => {
    const current = dataRef.current;
    if (!current) return Promise.resolve();
    const overdue = S.overdueSourceTasks(current, new Date());
    if (overdue.length === 0) return Promise.resolve();
    const ids = new Set(overdue.map((i) => i.id));
    const metas = overdue.map((i) => current.taskMeta![i.id]!);
    return mutate(
      (d) => S.clearTasks(d, ids),
      async () =>
        (await api<{ boiler: BoilerResponse }>("/api/sources/items", { method: "PATCH", body: JSON.stringify(clearItemsBody(metas)) }))
          .boiler,
    );
  }, [mutate]);

  const setEventWeight = useCallback(
    (id: string, weight: Weight, series: boolean, clearIds: string[] = []) => {
      const item = dataRef.current?.items.find((i) => i.id === id);
      return mutate(
        (d) => S.setEventWeight(d, id, weight, series, clearIds),
        () =>
          api<BoilerResponse>("/api/event-weights", {
            method: "PUT",
            body: JSON.stringify(eventWeightBody(item ?? { id }, weight, series, clearIds)),
          }),
      );
    },
    [mutate],
  );

  const setStatus = useCallback(
    (status: Status, note: string) =>
      mutate(
        (d) => S.setStatus(d, status, note),
        // Status never changes the score, so there is no boiler to refresh.
        async () => {
          await api("/api/me/status", { method: "PATCH", body: JSON.stringify(statusBody(status, note)) });
          return null;
        },
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
        if (!mutations) return;
        const saved = await mutations.enqueue((d) => d, async () => toMyBoilerData(await api<BoilerResponse>("/api/sync", { method: "POST" })));
        if (saved) window.dispatchEvent(new CustomEvent("boiler:data-changed", { detail: { origin: "boiler" } }));
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { session.clear(); setData(null); }
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [source, mutations, session]);

  return { source, data, error, syncing, vent, addTask, addDemoAssignment, setTaskDone, setTaskSize, removeTask, clearOverdue, setEventWeight, setStatus, refresh };
}

export type MyBoiler = ReturnType<typeof useMyBoiler>;
