"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MAX_CHAT_MESSAGE, type PipMessage } from "@/lib/pip/contracts";
import type { StudyContext } from "@/lib/pip/study";
import { PipThinking } from "./PipThinking";
import { usePipConversation } from "./PipConversation";
import { PipStudyPlan } from "./PipStudyPlan";
import type { StudyProposal } from "@/lib/pip/planning";

const EMPTY_MESSAGES: PipMessage[] = [];
const SUGGESTIONS = [
  { label: "What’s due next?", question: "What’s due next?" },
  { label: "Plan study time", question: "When should I study?" },
];

export function PipChat({ header, autoFocus = false, studyContext, draftRequest, enabled = true, remindersReady = false, replacing = false, onAcceptProposal }: { header?: ReactNode; autoFocus?: boolean; studyContext?: StudyContext; draftRequest?: { question: string; key: number } | null; enabled?: boolean; remindersReady?: boolean; replacing?: boolean; onAcceptProposal?: (proposal: StudyProposal) => void }) {
  const session = usePipConversation();
  const { setDraft, send: request, dismissProposal } = session;
  const messages = enabled ? session.messages : EMPTY_MESSAGES;
  const draft = enabled ? session.draft : "";
  const busy = enabled && session.busy;
  const streamingReply = enabled ? session.streamingReply : "";
  const error = enabled ? session.error : null;
  const proposal = enabled ? session.proposal : null;
  const replyIndex = !busy && messages.at(-1)?.role === "assistant" ? messages.length - 1 : -1;
  const reply = streamingReply || (replyIndex >= 0 ? messages[replyIndex].content : "");
  const hasReply = Boolean(reply.trim());
  const field = useId();
  const conversationId = useId();
  const [expanded, setExpanded] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const followHistory = useRef(true);
  const followReply = useRef(true);
  const submitted = useRef(false);
  const send = (question?: string) => {
    submitted.current = true;
    followReply.current = true;
    followHistory.current = true;
    return enabled ? request(question, studyContext) : Promise.resolve();
  };

  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);
  useEffect(() => { if (draftRequest) { setDraft(draftRequest.question.slice(0, MAX_CHAT_MESSAGE)); input.current?.focus(); } }, [draftRequest, setDraft]);
  useEffect(() => { if (!busy && submitted.current) input.current?.focus(); }, [busy]);
  useEffect(() => {
    const viewport = log.current;
    if (viewport && followReply.current) viewport.scrollTop = viewport.scrollHeight;
    if (expanded && transcript.current && followHistory.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [messages, busy, streamingReply, expanded]);

  return <div className="pip-chat-body flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto overscroll-contain">
    <div className="pip-chat-window shrink-0 overflow-hidden rounded-xl border border-line bg-surface">
      {header}
      <div className="flex flex-col gap-2 px-2 pb-1">
        <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="flex shrink-0 flex-col gap-2">
          <label htmlFor={field} className="sr-only">Message Pip</label>
          <div className="flex items-end gap-1 rounded-lg border border-control bg-field p-1 focus-within:border-brass">
            <textarea ref={input} id={field} value={draft} maxLength={MAX_CHAT_MESSAGE} rows={1} placeholder={enabled ? "Ask Pip…" : "Sign in to chat"} disabled={busy || !enabled}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}
              className="min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-base leading-normal text-fg placeholder:text-muted focus-visible:outline-none disabled:opacity-70" />
            <button type="submit" aria-label="Send message" disabled={busy || !enabled || !draft.trim()} className="bp-button inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-brass text-soot hover:bg-brass-light disabled:cursor-not-allowed disabled:opacity-40">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>
            </button>
          </div>
          {error && <p role="alert" className="m-0 px-1 text-xs leading-relaxed text-hot-ink">{error}</p>}
        </form>
        {enabled && <div role="group" aria-label="Pip shortcuts" className="flex shrink-0 items-center gap-1.5">{SUGGESTIONS.map((suggestion) => <button key={suggestion.label} type="button" onClick={() => void send(suggestion.question)} disabled={busy} className="bp-control inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-full border border-line bg-transparent px-2 py-1 text-[11px] font-medium leading-none text-body hover:border-rivet hover:text-fg disabled:cursor-wait disabled:opacity-50">{suggestion.label}</button>)}</div>}
        <div ref={transcript} id={conversationId} hidden={!expanded} role="log" aria-label="Conversation with Pip" aria-live="off" aria-busy={busy} tabIndex={0}
          onScroll={(event) => { const view = event.currentTarget; followHistory.current = view.scrollHeight - view.scrollTop - view.clientHeight < 24; }}
          className="h-24 shrink-0 overflow-y-auto overscroll-contain rounded-lg border border-line bg-field p-2">
          {messages.length === 0 ? <p className="m-0 text-xs text-muted">No messages yet.</p> : messages.map((message, index) => <p key={index} className={`mt-0 mb-2 last:mb-0 text-xs leading-relaxed whitespace-pre-wrap wrap-anywhere ${message.role === "user" ? "text-fg" : "text-body"}`}>
            <span className="font-semibold">{message.role === "user" ? "You: " : "Pip: "}</span>{message.content}
          </p>)}
          {hasReply && busy && <p className="m-0 text-xs leading-relaxed whitespace-pre-wrap wrap-anywhere text-body"><span className="font-semibold">Pip: </span>{streamingReply}</p>}
        </div>
        <button type="button" aria-label={expanded ? "Collapse conversation" : "Expand conversation"} aria-controls={conversationId} aria-expanded={expanded}
          onClick={() => { followHistory.current = true; setExpanded((value) => !value); }}
          className="bp-control flex min-h-11 w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-0 bg-transparent text-[11px] leading-none text-muted hover:bg-surface-2 hover:text-fg">
          <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={expanded ? "rotate-180" : undefined}><path d="m3 7 5-5 5 5" /></svg>
          <span>{expanded ? "Collapse" : "Expand"}</span>
        </button>
      </div>
    </div>
    {proposal && <div className="rounded-xl bg-surface p-3"><PipStudyPlan key={`${proposal.taskId}:${proposal.startAt}`} proposal={proposal} ready={remindersReady} replacing={replacing} onAccept={onAcceptProposal} onDismiss={dismissProposal} /></div>}
    {(hasReply || busy) && <div role="status" aria-label="Pip's reply" aria-live="polite" aria-atomic="true" className="pip-speech-bubble">
      <svg className="pip-cloud-shape" viewBox="0 0 300 180" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M37 56C17 34 44 12 68 26C78 0 116 0 132 20C156 0 189 7 197 29C223 13 254 29 253 53C283 48 302 73 286 96C307 121 287 148 259 145C253 170 219 181 200 162C179 184 143 178 132 161C107 181 74 172 70 152C41 164 15 143 24 121C0 114 0 80 20 70C14 55 26 46 37 56Z" />
      </svg>
      <div ref={log} onScroll={(event) => { const view = event.currentTarget; followReply.current = view.scrollHeight - view.scrollTop - view.clientHeight < 40; }} className="pip-speech-content max-h-24 overflow-y-auto overscroll-contain">
        {hasReply ? <p className="m-0 text-[13px] leading-relaxed whitespace-pre-wrap wrap-anywhere"><span className="sr-only">Pip: </span>{reply}{busy && <span aria-hidden="true" className="ml-1 inline-block h-3 w-1 rounded-sm bg-soot motion-safe:animate-pulse" />}</p> : <PipThinking />}
      </div>
    </div>}
  </div>;
}
