"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Reaction } from "./voice";

// The corner Pip's body language while its chat is open: it listens while you type, nods when you
// send, gives a small bounce when its reply lands, and dozes when the chat sits quiet.

export type ChatPose = Extract<Reaction, "listen" | "nod" | "bounce" | "doze">;

/** Typing keeps Pip listening until this long after the last keystroke. */
export const LISTEN_MS = 1500;
/** mp-nod: 0.35 s × 2. */
export const NOD_MS = 700;
/** mp-bop: 0.6 s × 1. */
export const BOUNCE_MS = 600;
/** An open, untouched chat sends Pip to sleep after this long. */
export const DOZE_AFTER_MS = 45_000;

/** Which face the corner Pip shows, most urgent first. */
export function chatReaction({
  thinking,
  talking,
  pose,
  cue,
  greeting,
  base,
}: {
  thinking: boolean;
  talking: boolean;
  pose: ChatPose | null;
  cue: Reaction | null;
  greeting: boolean;
  base: Reaction;
}): Reaction {
  // Sending starts the wait at once, so the brief nod plays first and thinking follows it.
  if (pose === "nod") return "nod";
  if (thinking) return "think";
  if (talking) return "talk";
  if (pose && pose !== "doze") return pose;
  if (cue) return cue;
  if (greeting) return "greet";
  return pose ?? base;
}

interface Turn {
  role: string;
}

/**
 * The chat pose for the open companion, or null. `root` holds the chat panel: any input inside it
 * counts as typing, and any input or pointer activity there wakes a dozing Pip.
 */
export function usePipChatPose({
  open,
  root,
  messages,
  streaming,
  busy,
}: {
  open: boolean;
  root: RefObject<HTMLElement | null>;
  messages: readonly Turn[];
  streaming: boolean;
  busy: boolean;
}): ChatPose | null {
  const [listening, setListening] = useState(false);
  const [brief, setBrief] = useState<"nod" | "bounce" | null>(null);
  const [dozing, setDozing] = useState(false);
  const [activity, setActivity] = useState(0);
  const lastCount = useRef(messages.length);
  const wasStreaming = useRef(streaming);
  const briefTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Typing: listen while keys are going, and count it as activity.
  useEffect(() => {
    const el = root.current;
    if (!open || !el) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const onInput = () => {
      setListening(true);
      setActivity((n) => n + 1);
      clearTimeout(t);
      t = setTimeout(() => setListening(false), LISTEN_MS);
    };
    const onPointer = () => setActivity((n) => n + 1);
    el.addEventListener("input", onInput);
    el.addEventListener("pointerdown", onPointer);
    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("pointerdown", onPointer);
      clearTimeout(t);
      setListening(false);
    };
  }, [open, root]);

  // Sending: a new user turn gets a nod. A reply that finishes streaming gets a bounce.
  useEffect(() => {
    const grew = messages.length > lastCount.current;
    lastCount.current = messages.length;
    const finished = wasStreaming.current && !streaming;
    wasStreaming.current = streaming;
    const next = grew && messages.at(-1)?.role === "user" ? "nod" : finished ? "bounce" : null;
    if (!next) return;
    setActivity((n) => n + 1);
    setBrief(next);
    // Held in a ref so a later message update cannot cancel the timer and leave the pose stuck.
    clearTimeout(briefTimer.current);
    briefTimer.current = setTimeout(() => setBrief(null), next === "nod" ? NOD_MS : BOUNCE_MS);
  }, [messages, streaming]);
  useEffect(() => () => clearTimeout(briefTimer.current), []);

  // Dozing: an open chat with nothing happening for a while.
  useEffect(() => {
    setDozing(false);
    if (!open || busy || streaming) return;
    const t = setTimeout(() => setDozing(true), DOZE_AFTER_MS);
    return () => clearTimeout(t);
  }, [open, busy, streaming, activity]);

  if (!open) return null;
  return brief ?? (listening ? "listen" : dozing ? "doze" : null);
}
