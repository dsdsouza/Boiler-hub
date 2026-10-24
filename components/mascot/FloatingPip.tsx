"use client";

import { motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { LinkButton } from "@/components/ui/Button";
import { dockMessage, type Snapshot } from "./dockMessage";
import { Mascot } from "./Mascot";
import { PipChat } from "./PipChat";
import { usePipAccessory } from "./useAccessory";
import { usePipPosition } from "./usePipPosition";
import { pipPanel } from "./pip-position";

export function FloatingPip({ snapshot, now, pathname }: { snapshot: Snapshot | null; now: number; pathname: string }) {
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const panelId = useId(), headingId = useId(), instructionsId = useId();
  const previousPath = useRef(pathname);
  const position = usePipPosition(button, /^\/teams\/[^/]+/.test(pathname), () => setOpen(false));
  const accessory = usePipAccessory();
  const message = dockMessage(snapshot, now);

  useEffect(() => {
    if (previousPath.current !== pathname) { setOpen(false); previousPath.current = pathname; }
  }, [pathname]);
  useEffect(() => {
    const visibility = () => setPaused(document.hidden);
    visibility(); document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  useEffect(() => { if (open) heading.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", pointer); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", pointer); document.removeEventListener("keydown", key); };
  }, [open]);

  return <div ref={root} data-pip-companion data-paused={paused ? "" : undefined} className="pointer-events-none fixed inset-0 z-40 print:hidden">
    <p id={instructionsId} className="sr-only">Drag Pip to move him, or use the arrow keys while focused, Home returns him to his corner, Enter opens chat</p>
    <span className="sr-only" role="status">{position.dragging ? "Pip picked up" : ""}</span>
    <motion.div className="pointer-events-auto absolute top-0 left-0" style={{ x: position.x, y: position.y, visibility: position.frame ? "visible" : "hidden" }}>
      <button ref={button} type="button" aria-label={open ? "Close Pip" : "Chat with Pip"} aria-expanded={open} aria-controls={open ? panelId : undefined}
        aria-describedby={instructionsId} aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home" title="Drag Pip to move · click to chat"
        onPointerDown={position.onPointerDown} onPointerMove={position.onPointerMove} onPointerUp={position.onPointerUp}
        onPointerCancel={position.onPointerCancel} onLostPointerCapture={position.onLostPointerCapture} onKeyDown={position.onKeyDown}
        onClick={(event) => { if (event.detail !== 0 && position.suppressClick.current) { position.suppressClick.current = false; return; } setOpen((value) => !value); }}
        data-dragging={position.dragging ? "true" : "false"}
        className="pip-grab relative flex h-[128px] w-[112px] touch-none items-center justify-center border-0 bg-transparent p-0 select-none sm:h-[156px] sm:w-[136px]">
        <motion.span className="pointer-events-none block w-full" style={{ rotate: position.rotate, x: position.liftX, y: position.liftY, transformOrigin: "50% 14.1%" }}>
          <Mascot score={snapshot?.score ?? 0} size={136} className="h-auto w-full" reaction={message.reaction} empty={message.empty} accessory={accessory} carried={position.dragging} />
        </motion.span>
        {message.attention && !open && <span aria-hidden="true" className="absolute top-1/3 right-2 h-2.5 w-2.5 rounded-full bg-hot-ink" />}
      </button>
    </motion.div>
    {open && position.frame && <section id={panelId} role="dialog" aria-modal="false" aria-labelledby={headingId}
      style={pipPanel(position.point, position.frame)}
      className="mp-pop pointer-events-auto absolute flex flex-col overflow-y-auto overscroll-contain rounded-[14px] bg-surface px-4 pt-3 pb-4 shadow-xl ring-1 ring-rivet">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 ref={heading} id={headingId} tabIndex={-1} className="m-0 text-base leading-snug font-semibold text-fg outline-none">Chat with Pip</h2>
        <button type="button" onClick={() => { setOpen(false); button.current?.focus(); }} aria-label="Close Pip chat"
          className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted hover:text-fg">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <PipChat />
      <div className="mt-3 shrink-0"><LinkButton href={message.action.href} variant={message.action.href === "/boiler" ? "primary" : "ghost"}
        className={message.action.href === "/boiler" ? "bp-button-striped" : undefined} onClick={() => setOpen(false)}>{message.action.label}</LinkButton></div>
    </section>}
  </div>;
}
