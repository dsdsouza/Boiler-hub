"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MyBoiler } from "./useMyBoiler";
import {
  focusPhase,
  type CourseMaterial,
  type FocusSession,
  type StudyContext,
} from "@/lib/pip/study";

export type BlockerStatus = {
  connected: boolean;
  enforced: boolean;
  session: FocusSession | null;
  error?: string;
};

export function useStudyAccountability(boiler: MyBoiler) {
  const [session, setSession] = useState<FocusSession | null>(null);
  const [sources, setSources] = useState<CourseMaterial[]>([]);
  const [blocker, setBlocker] = useState<BlockerStatus>({
    connected: false,
    enforced: false,
    session: null,
  });
  const [now, setNow] = useState(0);
  const lastStatus = useRef(0);
  const ownerTasks = useRef(boiler.data?.items);
  ownerTasks.current = boiler.data?.items;
  const scope: "demo" | "account" =
    boiler.source === "fixture" ? "demo" : "account";
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.origin !== location.origin ||
        event.data?.type !== "bp-focus:status"
      )
        return;
      const status = event.data.status;
      if (
        typeof status?.enforced !== "boolean" ||
        typeof status?.connected !== "boolean"
      )
        return;
      lastStatus.current = Date.now();
      setBlocker({
        ...status,
        error:
          typeof event.data.error === "string" ? event.data.error : undefined,
      });
      const incoming = status.session as FocusSession | null;
      setSession((current) => {
        if (!incoming) return current;
        if (
          incoming.scope !== scope ||
          !ownerTasks.current?.some((task) => task.id === incoming.taskId)
        )
          return current;
        if (current && incoming.id !== current.id && !current.outcome)
          return current;
        if (current?.id === incoming.id && current.outcome && !incoming.outcome)
          return current;
        return incoming;
      });
    };
    window.addEventListener("message", receive);
    const tick = () => {
      setNow(Date.now());
      if (Date.now() - lastStatus.current > 7000)
        setBlocker((current) =>
          current.connected
            ? { ...current, connected: false, enforced: false }
            : current,
        );
      window.postMessage({ type: "bp-focus:read" }, location.origin);
    };
    tick();
    const interval = setInterval(tick, 2000);
    return () => {
      window.removeEventListener("message", receive);
      clearInterval(interval);
    };
  }, [scope]);
  const phase = session ? focusPhase(session, now) : null;
  const send = useCallback((next: FocusSession) => {
    setSession(next);
    setNow(Date.now());
    window.postMessage(
      { type: "bp-focus:set", session: next },
      location.origin,
    );
  }, []);
  const end = useCallback(() => {
    if (session) send({ ...session, outcome: "cancelled" });
  }, [send, session]);
  // Optional native browser notification; permission is requested only by its own button.
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (
      phase === "active" &&
      previous.current === "scheduled" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification("Pip: time to come back", {
        body: session?.goal || session?.title,
        tag: "boilerplate-focus",
      });
    }
    previous.current = phase;
  }, [phase, session?.goal, session?.title]);
  const context: StudyContext = useMemo(
    () => ({
      sources,
      ...(session && !session.outcome
        ? {
            commitment: {
              title: session.title,
              goal: session.goal,
              startsAt: new Date(session.startAt).toISOString(),
              endsAt: new Date(session.endAt).toISOString(),
            },
          }
        : {}),
    }),
    [session, sources],
  );
  return {
    session,
    phase,
    sources,
    setSources,
    blocker,
    now,
    send,
    end,
    context,
    scope,
  };
}
export type StudyAccountability = ReturnType<typeof useStudyAccountability>;
