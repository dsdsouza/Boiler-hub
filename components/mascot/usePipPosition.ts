"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { readStorage, writeStorage } from "@/components/ui/storage";
import { clampPip, fromPipRatio, pipBounds, pipRatio, PIP_POSITION_KEY, readPipRatio, type PipFrame, type Point } from "./pip-position";

type Grab = { id: number; start: Point; previousX: number; origin: Point; moved: boolean };
const gripHeight = 22 / 156; // The raised hands in Mascot's viewBox

export function usePipPosition(button: RefObject<HTMLButtonElement | null>, raised: boolean, onPickUp: () => void) {
  const x = useMotionValue(0), y = useMotionValue(0);
  const rotate = useSpring(0, { stiffness: 360, damping: 26, mass: 0.65 });
  const liftX = useSpring(0, { stiffness: 650, damping: 44 });
  const liftY = useSpring(0, { stiffness: 650, damping: 44 });
  const reduced = useReducedMotion();
  const [frame, setFrame] = useState<PipFrame | null>(null);
  const [dragging, setDragging] = useState(false);
  const [point, setPoint] = useState<Point>({ x: 0, y: 0 });
  const previousFrame = useRef<PipFrame | null>(null);
  const grab = useRef<Grab | null>(null);
  const suppressClick = useRef(false);
  const defaultRaised = useRef(raised);

  useEffect(() => {
    const measure = () => {
      if (!button.current) return;
      const next = { width: window.innerWidth, height: window.innerHeight, pipWidth: button.current.offsetWidth, pipHeight: button.current.offsetHeight, bottom: window.innerWidth < 640 ? 80 : 16 };
      const saved = previousFrame.current ? pipRatio({ x: x.get(), y: y.get() }, previousFrame.current) : readPipRatio(readStorage(PIP_POSITION_KEY));
      const b = pipBounds(next);
      const position = saved ? fromPipRatio(saved, next) : clampPip({ x: b.maxX, y: b.maxY - (defaultRaised.current ? 64 : 0) }, next);
      x.set(position.x); y.set(position.y); setPoint(position);
      previousFrame.current = next; setFrame(next);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [button, x, y]);

  const place = useCallback((next: Point, save = true) => {
    if (!frame) return;
    const p = clampPip(next, frame);
    x.set(p.x); y.set(p.y); setPoint(p);
    if (save) writeStorage(PIP_POSITION_KEY, JSON.stringify(pipRatio(p, frame)));
  }, [frame, x, y]);
  const finish = useCallback((cancel = false) => {
    const held = grab.current;
    if (!held) return;
    grab.current = null;
    if (button.current?.hasPointerCapture(held.id)) button.current.releasePointerCapture(held.id);
    if (held.moved) {
      suppressClick.current = true;
      place(cancel ? held.origin : { x: x.get(), y: y.get() }, !cancel);
    }
    setDragging(false); rotate.set(0); liftX.set(0); liftY.set(0);
  }, [button, liftX, liftY, place, rotate, x, y]);
  useEffect(() => {
    const release = () => finish();
    const cancel = () => finish(true);
    window.addEventListener("pointerup", release);
    window.addEventListener("blur", cancel);
    return () => { window.removeEventListener("pointerup", release); window.removeEventListener("blur", cancel); };
  }, [finish]);
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!frame || !event.isPrimary || event.button !== 0) return;
    suppressClick.current = false;
    grab.current = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, previousX: event.clientX, origin: { x: x.get(), y: y.get() }, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const held = grab.current;
    if (!held || held.id !== event.pointerId || !frame) return;
    // Firefox can miss the release outside the browser window. Retire that
    // capture before the next hover/click so it cannot steal a chat control.
    if (event.buttons === 0) { finish(); return; }
    if (!held.moved && Math.hypot(event.clientX - held.start.x, event.clientY - held.start.y) < 6) return;
    const next = clampPip({ x: event.clientX - frame.pipWidth / 2, y: event.clientY - frame.pipHeight * gripHeight }, frame);
    if (!held.moved) {
      held.moved = true; setDragging(true); onPickUp();
      // Ease into the hanging pose without a jump at the drag threshold.
      if (!reduced) { liftX.jump(x.get() - next.x); liftY.jump(y.get() - next.y); liftX.set(0); liftY.set(0); }
    }
    x.set(next.x); y.set(next.y);
    rotate.set(reduced ? 0 : Math.max(-12, Math.min(12, (held.previousX - event.clientX) * 0.7)));
    held.previousX = event.clientX;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!frame) return;
    if (event.key === "Escape" && grab.current) { event.preventDefault(); finish(true); return; }
    if (grab.current) finish();
    const step = event.shiftKey ? 32 : 12;
    const delta: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    if (delta[event.key]) { event.preventDefault(); onPickUp(); place({ x: x.get() + delta[event.key].x, y: y.get() + delta[event.key].y }); }
    if (event.key === "Home") { event.preventDefault(); const b = pipBounds(frame); place({ x: b.maxX, y: b.maxY - (raised ? 64 : 0) }); }
  };
  return { x, y, rotate, liftX, liftY, frame, point, dragging, suppressClick, onKeyDown, onPointerDown, onPointerMove,
    onPointerUp: () => finish(), onPointerCancel: () => finish(true), onLostPointerCapture: () => finish(true) };
}
