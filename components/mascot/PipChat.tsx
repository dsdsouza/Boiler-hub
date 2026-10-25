"use client";

import { useEffect, useId, useRef } from "react";
import { MAX_CHAT_MESSAGE, type PipMessage } from "@/lib/pip/contracts";
import type { StudyContext } from "@/lib/pip/study";
import { PipThinking } from "./PipThinking";
import { usePipConversation } from "./PipConversation";
import { PipStudyPlan } from "./PipStudyPlan";
import type { StudyProposal } from "@/lib/pip/planning";

const EMPTY_MESSAGES: PipMessage[] = [];
const SUGGESTIONS = ["What’s due next?", "What should I prioritize?", "When should I study?", "Keep me accountable"];

export function PipChat({ autoFocus = false, studyContext, draftRequest, enabled = true, remindersReady = false, replacing = false, onAcceptProposal }: { autoFocus?: boolean; studyContext?: StudyContext; draftRequest?: { question: string; key: number } | null; enabled?: boolean; remindersReady?: boolean; replacing?: boolean; onAcceptProposal?: (proposal: StudyProposal) => void }) {
  const session = usePipConversation();
  const { setDraft, send: request, dismissProposal } = session;
  const messages = enabled ? session.messages : EMPTY_MESSAGES;
  const draft = enabled ? session.draft : "";
  const busy = enabled && session.busy;
  const streamingReply = enabled ? session.streamingReply : "";
  const error = enabled ? session.error : null;
  const proposal = enabled ? session.proposal : null;
  const hasReply = Boolean(streamingReply.trim());
  const send = (question?: string) => enabled ? request(question, studyContext) : Promise.resolve();
  const field = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const followReply = useRef(true);
  const submitted = useRef(false);

  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);
  useEffect(() => { if (draftRequest) { setDraft(draftRequest.question.slice(0, MAX_CHAT_MESSAGE)); input.current?.focus(); } }, [draftRequest, setDraft]);
  useEffect(() => { if (!busy && submitted.current) input.current?.focus(); }, [busy]);
  useEffect(() => {
    const viewport = log.current;
    if (!viewport) return;
    if (followReply.current) viewport.scrollTop = viewport.scrollHeight;
  }, [messages, busy, streamingReply]);

  return <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
    <div ref={log} role="log" aria-label="Conversation with Pip" aria-live="polite" aria-busy={busy} aria-relevant="additions text" onScroll={(event) => { const view = event.currentTarget; followReply.current = view.scrollHeight - view.scrollTop - view.clientHeight < 40; }} className="flex min-h-0 max-h-[320px] flex-col gap-3 overflow-y-auto overscroll-contain pr-1">
      <p className="m-0 max-w-[95%] rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-2 text-sm leading-relaxed text-body">Hi, I’m Pip. Tell me what’s on your mind. I can help you prioritize, find time to study, and follow through with the Pip extension.</p>
      {messages.map((message, index) => <p key={index} className={`m-0 max-w-[95%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere ${message.role === "user" ? "self-end rounded-br-sm bg-brass/15 text-fg" : "self-start rounded-bl-sm bg-surface-2 text-body"}`}>
        <span className="sr-only">{message.role === "user" ? "You: " : "Pip: "}</span>{message.content}
      </p>)}
      {hasReply && <p className="m-0 max-w-[95%] self-start rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere text-body"><span className="sr-only">Pip: </span>{streamingReply}<span aria-hidden="true" className="ml-1 inline-block h-3 w-1 rounded-sm bg-brass-ink motion-safe:animate-pulse" /></p>}
      {busy && !hasReply && <PipThinking />}
    </div>
    <form onSubmit={(event) => { event.preventDefault(); submitted.current = true; followReply.current = true; void send(); }} className="flex shrink-0 flex-col gap-2">
      <label htmlFor={field} className="sr-only">Message Pip</label>
      <div className="flex items-end gap-2 rounded-xl border border-control bg-field p-2 focus-within:border-brass">
        <textarea ref={input} id={field} value={draft} maxLength={MAX_CHAT_MESSAGE} rows={2} placeholder={enabled ? "Ask Pip about deadlines, priorities, or study time…" : "Sign in to chat with Pip"} disabled={busy || !enabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submitted.current = true; followReply.current = true; void send(); } }}
          className="min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-1 text-base leading-normal text-fg placeholder:text-muted focus-visible:outline-none disabled:opacity-70" />
        <button type="submit" aria-label="Send message" disabled={busy || !enabled || !draft.trim()} className="bp-button inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-brass text-soot hover:bg-brass-light disabled:cursor-not-allowed disabled:opacity-40">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>
        </button>
      </div>
      {error && <p role="alert" className="m-0 text-sm leading-relaxed text-hot-ink">{error}</p>}
    </form>
    {enabled && <div aria-label="Pip shortcuts" className="grid shrink-0 grid-cols-2 gap-1.5">{SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => { submitted.current = true; followReply.current = true; void send(suggestion); }} disabled={busy} className="bp-control min-h-8 min-w-0 cursor-pointer rounded-md border border-line bg-transparent px-2 py-1 text-left text-[11px] leading-snug text-body hover:border-rivet hover:text-fg disabled:cursor-wait disabled:opacity-50">{suggestion}</button>)}</div>}
    {proposal && <PipStudyPlan key={`${proposal.taskId}:${proposal.startAt}`} proposal={proposal} ready={remindersReady} replacing={replacing} onAccept={onAcceptProposal} onDismiss={dismissProposal} />}
  </div>;
}
