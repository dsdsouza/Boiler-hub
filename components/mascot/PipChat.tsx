"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MAX_CHAT_BODY, MAX_CHAT_MESSAGE, type PipMessage } from "@/lib/pip/contracts";
import type { StudyContext } from "@/lib/pip/study";
import { PipThinking } from "./PipThinking";
import { PIP_STREAM_TYPE, PipChatError, readPipReply } from "@/lib/pip/stream";

const SUGGESTIONS = ["What’s due next?", "Help me plan today"];

export function PipChat({ autoFocus = false, studyContext, draftRequest }: { autoFocus?: boolean; studyContext?: StudyContext; draftRequest?: { question: string; key: number } | null }) {
  const [messages, setMessages] = useState<PipMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingReply, setStreamingReply] = useState("");
  const hasReply = Boolean(streamingReply.trim());
  const [error, setError] = useState<string | null>(null);
  const field = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const followReply = useRef(true);
  const active = useRef<AbortController | null>(null);
  const submitted = useRef(false);

  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);
  useEffect(() => { if (draftRequest) { setDraft(draftRequest.question.slice(0, MAX_CHAT_MESSAGE)); input.current?.focus(); } }, [draftRequest]);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => { if (!busy && submitted.current) input.current?.focus(); }, [busy]);
  useEffect(() => {
    const viewport = log.current;
    if (!viewport) return;
    if (followReply.current) viewport.scrollTop = viewport.scrollHeight;
  }, [messages, busy, streamingReply]);

  async function send(question = draft) {
    const text = question.trim();
    if (!text || text.length > MAX_CHAT_MESSAGE || active.current) return;
    const history: PipMessage[] = [...messages.slice(-10), { role: "user", content: text }];
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const payload = () => JSON.stringify({ messages: history, timeZone, ...(studyContext ? { study: studyContext } : {}) });
    while (history.length > 1 && new TextEncoder().encode(payload()).length > MAX_CHAT_BODY - 2000) history.splice(0, 2);
    if (new TextEncoder().encode(payload()).length > MAX_CHAT_BODY) { setError("The course material is too long to send. Shorten an excerpt and try again."); return; }
    const controller = new AbortController();
    active.current = controller;
    submitted.current = true;
    followReply.current = true;
    setMessages((previous) => [...previous, { role: "user", content: text }]);
    setDraft(""); setError(null); setStreamingReply(""); setBusy(true);
    try {
      const response = await fetch("/api/pip/chat", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: PIP_STREAM_TYPE },
        body: payload(),
        signal: controller.signal,
      });
      const reply = await readPipReply(response, (text) => { if (!controller.signal.aborted) setStreamingReply(text); });
      if (controller.signal.aborted) return;
      setMessages((previous) => [...previous, { role: "assistant", content: reply }].slice(-40) as PipMessage[]);
    } catch (failure) {
      if (controller.signal.aborted) return;
      setMessages((previous) => previous.slice(0, -1));
      setDraft(text);
      setError(failure instanceof PipChatError ? failure.message : "Pip couldn’t connect. Please try again.");
    } finally {
      if (!controller.signal.aborted) { setStreamingReply(""); setBusy(false); active.current = null; }
    }
  }

  return <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
    <div ref={log} role="log" aria-label="Conversation with Pip" aria-live="polite" aria-busy={busy} aria-relevant="additions text" onScroll={(event) => { const view = event.currentTarget; followReply.current = view.scrollHeight - view.scrollTop - view.clientHeight < 40; }} className="flex min-h-0 max-h-[320px] flex-col gap-3 overflow-y-auto overscroll-contain pr-1">
      <p className="m-0 max-w-[95%] rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-2 text-sm leading-relaxed text-body">Hi, I’m Pip. Ask me what’s due next or what to work on today.</p>
      {messages.map((message, index) => <p key={index} className={`m-0 max-w-[95%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere ${message.role === "user" ? "self-end rounded-br-sm bg-brass/15 text-fg" : "self-start rounded-bl-sm bg-surface-2 text-body"}`}>
        <span className="sr-only">{message.role === "user" ? "You: " : "Pip: "}</span>{message.content}
      </p>)}
      {hasReply && <p className="m-0 max-w-[95%] self-start rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere text-body"><span className="sr-only">Pip: </span>{streamingReply}<span aria-hidden="true" className="ml-1 inline-block h-3 w-1 rounded-sm bg-brass-ink motion-safe:animate-pulse" /></p>}
      {busy && !hasReply && <PipThinking />}
    </div>
    {!messages.length && <div className="flex shrink-0 flex-wrap gap-2 [@media(max-height:600px)]:hidden">{SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => void send(suggestion)} disabled={busy} className="bp-button min-h-11 cursor-pointer rounded-lg border border-line bg-transparent px-3 py-2 text-left text-xs text-body hover:border-rivet hover:text-fg">{suggestion}</button>)}</div>}
    <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="flex shrink-0 flex-col gap-2">
      <label htmlFor={field} className="sr-only">Message Pip</label>
      <div className="flex items-end gap-2 rounded-xl border border-control bg-field p-2 focus-within:border-brass">
        <textarea ref={input} id={field} value={draft} maxLength={MAX_CHAT_MESSAGE} rows={2} placeholder="Ask about your assignments…" disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}
          className="min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-1 text-base leading-normal text-fg placeholder:text-muted focus-visible:outline-none disabled:opacity-70" />
        <button type="submit" aria-label="Send message" disabled={busy || !draft.trim()} className="bp-button inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-brass text-soot hover:bg-brass-light disabled:cursor-not-allowed disabled:opacity-40">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>
        </button>
      </div>
      {error && <p role="alert" className="m-0 text-sm leading-relaxed text-hot-ink">{error}</p>}
    </form>
  </div>;
}
