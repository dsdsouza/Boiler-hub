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
  const replyIndex = !busy && messages.at(-1)?.role === "assistant" ? messages.length - 1 : -1;
  const reply = streamingReply || (replyIndex >= 0 ? messages[replyIndex].content : "");
  const history = messages.filter((_, index) => index !== replyIndex);
  const hasReply = Boolean(reply.trim());
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

  return <div className="pip-chat-body flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto overscroll-contain">
    <div className="flex shrink-0 flex-col gap-1 rounded-b-xl border border-t-0 border-line bg-surface px-2 pb-2">
      <form onSubmit={(event) => { event.preventDefault(); submitted.current = true; followReply.current = true; void send(); }} className="flex shrink-0 flex-col gap-2">
        <label htmlFor={field} className="sr-only">Message Pip</label>
        <div className="flex items-end gap-1 rounded-lg border border-control bg-field p-1 focus-within:border-brass">
          <textarea ref={input} id={field} value={draft} maxLength={MAX_CHAT_MESSAGE} rows={1} placeholder={enabled ? "Ask Pip…" : "Sign in to chat"} disabled={busy || !enabled}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submitted.current = true; followReply.current = true; void send(); } }}
            className="min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-base leading-normal text-fg placeholder:text-muted focus-visible:outline-none disabled:opacity-70" />
          <button type="submit" aria-label="Send message" disabled={busy || !enabled || !draft.trim()} className="bp-button inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-brass text-soot hover:bg-brass-light disabled:cursor-not-allowed disabled:opacity-40">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>
          </button>
        </div>
        {error && <p role="alert" className="m-0 px-1 text-xs leading-relaxed text-hot-ink">{error}</p>}
      </form>
      {enabled && <details>
        <summary className="bp-summary flex min-h-11 cursor-pointer items-center px-1 text-xs text-muted">Quick questions</summary>
        <div aria-label="Pip shortcuts" className="grid grid-cols-2 gap-1">{SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => { submitted.current = true; followReply.current = true; void send(suggestion); }} disabled={busy} className="bp-control min-h-11 min-w-0 cursor-pointer rounded-md border border-line bg-transparent px-2 py-1 text-left text-xs leading-snug text-body hover:border-rivet hover:text-fg disabled:cursor-wait disabled:opacity-50">{suggestion}</button>)}</div>
      </details>}
    </div>
    {proposal && <div className="rounded-xl bg-surface p-3"><PipStudyPlan key={`${proposal.taskId}:${proposal.startAt}`} proposal={proposal} ready={remindersReady} replacing={replacing} onAccept={onAcceptProposal} onDismiss={dismissProposal} /></div>}
    <div role="log" aria-label="Conversation with Pip" aria-live="polite" aria-busy={busy} aria-relevant="additions text" className="flex min-h-0 flex-col gap-3 empty:hidden">
      {history.length > 0 && <details className="rounded-lg bg-surface px-3">
        <summary className="bp-summary flex min-h-11 cursor-pointer items-center text-xs text-muted">Conversation</summary>
        <div className="flex max-h-32 flex-col gap-2 overflow-y-auto overscroll-contain pb-2">
          {history.map((message, index) => <p key={index} className={`m-0 text-xs leading-relaxed whitespace-pre-wrap wrap-anywhere ${message.role === "user" ? "text-fg" : "text-body"}`}>
            <span className="font-semibold">{message.role === "user" ? "You: " : "Pip: "}</span>{message.content}
          </p>)}
        </div>
      </details>}
      {(hasReply || busy) && <div className="pip-speech-bubble">
        <div ref={log} onScroll={(event) => { const view = event.currentTarget; followReply.current = view.scrollHeight - view.scrollTop - view.clientHeight < 40; }} className="max-h-40 overflow-y-auto overscroll-contain">
          {hasReply ? <p className="m-0 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere"><span className="sr-only">Pip: </span>{reply}{busy && <span aria-hidden="true" className="ml-1 inline-block h-3 w-1 rounded-sm bg-soot motion-safe:animate-pulse" />}</p> : <PipThinking />}
        </div>
      </div>}
    </div>
  </div>;
}
