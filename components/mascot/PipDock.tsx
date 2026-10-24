"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { Counts, ForecastDay, Zone } from "@/lib/types";
import { createClient } from "@/lib/supabase/browser";
import { LinkButton } from "@/components/ui/Button";
import { readStorage } from "@/components/ui/storage";
import { ZONE_LABEL } from "@/components/ui/zones";
import { dockMessage, type Snapshot } from "./dockMessage";
import { Mascot } from "./Mascot";
import { PipChat } from "./PipChat";
import { usePipAccessory } from "./useAccessory";
import { MASCOT_NAME, PIP_HIDDEN_KEY } from "./voice";

// Pip in the corner of signed-in pages. Reads the caller's own stored snapshot
// (owner-only RLS), so moving between pages never triggers a calendar fetch.
// My Boiler keeps chat in this dock alongside its hero and inline wardrobe.
// The demo and onboarding provide their own Pip.

const HIDE_ON = ["/demo", "/onboarding", "/mascot-preview", "/auth"];

type Load = { kind: "none" } | { kind: "ready"; snapshot: Snapshot | null };

export function PipDock() {
  const pathname = usePathname() ?? "/";
  const routeHidden = HIDE_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  // The Engine Room has a lead-only sticky "New assignment" button in this corner (EngineRoom.tsx): sit above it.
  const raised = /^\/teams\/[^/]+/.test(pathname);
  const [load, setLoad] = useState<Load>({ kind: "none" });
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const accessory = usePipAccessory();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelId = useId();
  const headingId = useId();

  useEffect(() => {
    setOpen(false);
    setHidden(readStorage(PIP_HIDDEN_KEY) === "1");
    if (routeHidden || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    let cancelled = false;
    const supabase = createClient();
    void (async () => {
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      if (!user) {
        if (!cancelled) setLoad({ kind: "none" });
        return;
      }
      const { data, error } = await supabase
        .from("pressure_snapshots")
        .select("score, zone, counts, forecast, computed_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setLoad({ kind: "none" });
        return;
      }
      setNow(Date.now());
      setLoad({
        kind: "ready",
        snapshot: data
          ? { score: data.score as number, zone: data.zone as Zone, counts: data.counts as Counts, forecast: (data.forecast ?? []) as ForecastDay[], computedAt: data.computed_at as string }
          : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, routeHidden]);

  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (routeHidden || hidden || load.kind !== "ready") return null;

  const snap = load.snapshot;
  const message = dockMessage(snap, now);

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  return (
    // On phones, sit above the bottom tab bar (MobileTabBar: 56px + safe-area padding).
    <div
      ref={rootRef}
      className={`fixed right-4 z-40 flex flex-col items-end gap-3 sm:right-6 print:hidden ${
        raised
          ? "bottom-[calc(env(safe-area-inset-bottom)_+_136px)] sm:bottom-[84px]"
          : "bottom-[calc(max(env(safe-area-inset-bottom),8px)_+_68px)] sm:bottom-6"
      }`}
    >
      {open && (
        <section
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={headingId}
          className={`mp-pop flex w-[min(380px,calc(100vw-32px))] flex-col overflow-hidden rounded-[14px] border border-rivet bg-surface px-4 pt-3 pb-4 shadow-xl ${raised ? "max-h-[calc(100dvh-240px)] sm:max-h-[calc(100dvh-176px)]" : "max-h-[calc(100dvh-176px)] sm:max-h-[calc(100dvh-124px)]"}`}
        >
          <div className="flex shrink-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id={headingId} ref={headingRef} tabIndex={-1} className="m-0 text-base leading-snug font-semibold text-fg outline-none">Chat with {MASCOT_NAME}</h2>
              {snap && (
                <span className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
                  {ZONE_LABEL[snap.zone]} {snap.score}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={`Close ${MASCOT_NAME}`}
              className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted hover:text-fg"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <PipChat />
          <div className="mt-3 shrink-0">
            <LinkButton href={message.action.href} variant={message.action.href === "/boiler" ? "primary" : "ghost"} onClick={() => setOpen(false)}>
              {message.action.label}
            </LinkButton>
          </div>
        </section>
      )}
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? `Close ${MASCOT_NAME}` : `Chat with ${MASCOT_NAME}`}
        className="relative flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border border-rivet bg-surface shadow-lg hover:border-brass"
      >
        <Mascot score={snap?.score ?? 0} size={44} reaction={message.reaction} empty={message.empty} accessory={accessory} />
        {message.attention && !open && <span aria-hidden="true" className="absolute top-1 right-1 h-3 w-3 rounded-full bg-hot-ink ring-2 ring-bg" />}
      </button>
    </div>
  );
}
