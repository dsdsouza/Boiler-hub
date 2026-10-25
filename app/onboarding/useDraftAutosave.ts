"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OnboardingDraft } from "./model";
import { clearDraftBackup, rememberDraftBackup } from "./draft-backup";

interface SaveOptions {
  autosave?: boolean;
  extensionVersion?: string | null;
  reviewReceipt?: string | null;
  deadlinesReviewed?: boolean;
  deadlineAt?: string | null;
}
type SaveState = "idle" | "saving" | "saved" | "error";

/** One ordered writer for background answers, Continue and final completion. */
export function useDraftAutosave(draft: OnboardingDraft, enabled: boolean) {
  const [state, setState] = useState<SaveState>("idle");
  const active = useRef({ draft, enabled });
  const confirmed = useRef<string | null>(null);
  const pending = useRef<string | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const queuedCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedOwner = useRef<string | null>(null);
  const cooldown = useRef({ ownerId: null as string | null, until: 0 });
  active.current = { draft, enabled };

  const track = useCallback((next: OnboardingDraft) => {
    // A pagehide can happen before React renders the last input event.
    active.current.draft = next;
    // Some engines can discard pagehide as well as its keepalive request.
    // Back up the input event itself before any navigation can leave the page.
    if (active.current.enabled && next.ownerId && !next.finished) rememberDraftBackup(next);
  }, []);

  const cancelTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const acknowledge = useCallback((saved: OnboardingDraft) => {
    confirmed.current = JSON.stringify(saved);
    setState("saved");
  }, []);

  const save = useCallback((next: OnboardingDraft, options: SaveOptions = {}) => {
    cancelTimer();
    const key = JSON.stringify(next);
    pending.current = key;
    setState("saving");
    // Failed requests do not poison later retries. Every write stays behind the
    // previous write, so a late draft cannot undo Continue or Finish setup.
    const waiting = queuedCount.current++ > 0;
    const run = async () => {
      try {
        if (cooldown.current.ownerId === next.ownerId && cooldown.current.until > Date.now())
          throw new Error("Too many requests. Please wait a minute, then try again.");
        const response = await fetch("/api/me/onboarding", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ draft: next, expectedUserId: next.ownerId, ...options }),
          cache: "no-store",
          keepalive: true,
        });
        if (!response.ok) {
          if (response.status === 429) {
            const seconds = Number(response.headers.get("Retry-After") || 60);
            cooldown.current = { ownerId: next.ownerId, until: Date.now() + (Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 3600) : 60) * 1000 };
          }
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "Your answers could not be saved. Try again.");
        }
        confirmed.current = key;
        if (cooldown.current.ownerId === next.ownerId) cooldown.current.until = 0;
        clearDraftBackup(next);
        if (pending.current === key) pending.current = null;
        if (active.current.enabled && active.current.draft.ownerId === next.ownerId) {
          setState(!pending.current && JSON.stringify(active.current.draft) === key ? "saved" : "saving");
        }
        if (!options.autosave) window.dispatchEvent(new Event("boiler:data-changed"));
      } finally { queuedCount.current--; }
    };
    // Start an idle keepalive fetch in the pagehide handler itself. A queued
    // microtask may never run once the departing document is discarded.
    const request = (waiting ? queue.current.catch(() => {}).then(run) : run()).catch((error: unknown) => {
      if (pending.current === key) {
        pending.current = null;
        if (active.current.enabled && active.current.draft.ownerId === next.ownerId) setState("error");
      }
      throw error;
    });
    queue.current = request;
    return request;
  }, [cancelTimer]);

  const flush = useCallback(() => {
    cancelTimer();
    const { draft: latest, enabled: allowed } = active.current;
    if (!allowed || !latest.ownerId || latest.finished) return;
    const key = JSON.stringify(latest);
    if (pending.current === key || (!pending.current && confirmed.current === key)) return;
    rememberDraftBackup(latest);
    void save(latest, { autosave: true }).catch(() => {});
  }, [cancelTimer, save]);

  useEffect(() => {
    cancelTimer();
    if (!enabled || !draft.ownerId) return;
    const key = JSON.stringify(draft);
    const immediate = initializedOwner.current !== draft.ownerId;
    initializedOwner.current = draft.ownerId;
    if (!pending.current && confirmed.current === key) { clearDraftBackup(draft); setState("saved"); return; }
    if (draft.finished) return;
    if (pending.current === key) return;
    const remaining = cooldown.current.ownerId === draft.ownerId ? Math.max(0, cooldown.current.until - Date.now()) : 0;
    setState(remaining ? "error" : "saving");
    // The first account-bound draft (including the pre-signup answers) goes
    // straight to Supabase. Only subsequent typing is briefly coalesced.
    timer.current = setTimeout(flush, Math.max(remaining, immediate ? 0 : 400));
    return cancelTimer;
  }, [draft, enabled, cancelTimer, flush]);

  useEffect(() => {
    const hidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      flush();
      cancelTimer();
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [cancelTimer, flush]);

  const currentState = draft.finished && confirmed.current ? "saved"
    : state === "saved" && (pending.current || confirmed.current !== JSON.stringify(draft)) ? "saving" : state;
  return { state: currentState, save, acknowledge, track, retry: flush };
}
