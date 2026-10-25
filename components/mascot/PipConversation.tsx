"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createClient } from "@/lib/supabase/browser";
import { MAX_CHAT_BODY, MAX_CHAT_MESSAGE, type PipMessage } from "@/lib/pip/contracts";
import { PIP_STREAM_TYPE, PipChatError, readPipReply } from "@/lib/pip/stream";
import type { CourseMaterial, StudyContext } from "@/lib/pip/study";
import type { StudyProposal } from "@/lib/pip/planning";
import { observePipUser } from "./pip-auth";

type Conversation = { messages: PipMessage[]; draft: string; busy: boolean; streamingReply: string; error: string | null; proposal: StudyProposal | null };
const empty = (): Conversation => ({ messages: [], draft: "", busy: false, streamingReply: "", error: null, proposal: null });
type Session = Conversation & { userId: string | null; openRequest: number; openChat: (question: string) => void; sources: CourseMaterial[]; setSources: Dispatch<SetStateAction<CourseMaterial[]>>; setDraft: (value: string) => void; send: (question?: string, study?: StudyContext) => Promise<void>; clear: () => void; dismissProposal: () => void };
const Context = createContext<Session | null>(null);

/** One in-memory conversation across pages and dock/inline views. Sign-out or a different account clears it. */
export function PipConversationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Conversation>(empty);
  const [userId, setUserId] = useState<string | null>(null);
  const [sources, setSources] = useState<CourseMaterial[]>([]);
  const [openRequest, setOpenRequest] = useState(0);
  const current = useRef(state);
  current.current = state;
  const material = useRef(sources);
  material.current = sources;
  const active = useRef<AbortController | null>(null);
  const identity = useRef<string | null | undefined>(undefined);
  const clear = useCallback(() => { active.current?.abort(); active.current = null; setState(empty()); }, []);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const client = createClient();
    const identify = (id: string | null) => {
      if (identity.current === id) return;
      identity.current = id;
      setUserId(id);
      clear(); setSources([]); setOpenRequest(0);
    };
    const stop = observePipUser(client.auth, identify);
    return () => { stop(); active.current?.abort(); };
  }, [clear]);
  const setDraft = useCallback((draft: string) => setState((s) => ({ ...s, draft: draft.slice(0, MAX_CHAT_MESSAGE) })), []);
  const openChat = useCallback((question: string) => { if (!identity.current) return; setDraft(question); setOpenRequest((value) => value + 1); }, [setDraft]);
  const dismissProposal = useCallback(() => setState((s) => ({ ...s, proposal: null })), []);
  const send = useCallback(async (question?: string, supplied?: StudyContext) => {
    const text = (question ?? current.current.draft).trim();
    if (!identity.current || !text || text.length > MAX_CHAT_MESSAGE || active.current) return;
    const study = supplied ?? { sources: material.current };
    const history: PipMessage[] = [...current.current.messages.slice(-10), { role: "user", content: text }];
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const payload = () => JSON.stringify({ messages: history, timeZone, study });
    while (history.length > 1 && new TextEncoder().encode(payload()).length > MAX_CHAT_BODY - 2000) history.splice(0, 2);
    if (new TextEncoder().encode(payload()).length > MAX_CHAT_BODY) { setState((s) => ({ ...s, error: "Shorten a course excerpt and try again." })); return; }
    const controller = new AbortController();
    active.current = controller;
    setState((s) => ({ ...s, messages: [...s.messages, { role: "user", content: text }], draft: "", busy: true, streamingReply: "", error: null, proposal: null }));
    let proposal: StudyProposal | null = null;
    try {
      const response = await fetch("/api/pip/chat", { method: "POST", headers: { "Content-Type": "application/json", Accept: PIP_STREAM_TYPE }, body: payload(), signal: controller.signal });
      const reply = await readPipReply(response, (streamingReply) => { if (!controller.signal.aborted) setState((s) => ({ ...s, streamingReply })); }, (value) => { proposal = value; });
      if (!controller.signal.aborted) setState((s) => ({ ...s, messages: [...s.messages, { role: "assistant", content: reply }].slice(-40) as PipMessage[], proposal }));
    } catch (error) {
      if (!controller.signal.aborted) setState((s) => ({ ...s, messages: s.messages.slice(0, -1), draft: text, error: error instanceof PipChatError ? error.message : "Pip couldn’t connect. Please try again." }));
    } finally {
      if (active.current === controller) { active.current = null; setState((s) => ({ ...s, busy: false, streamingReply: "" })); }
    }
  }, []);
  return <Context.Provider value={{ ...state, userId, openRequest, openChat, sources, setSources, setDraft, send, clear, dismissProposal }}>{children}</Context.Provider>;
}

export function usePipConversation() {
  const session = useContext(Context);
  if (!session) throw new Error("Pip chat needs its conversation provider");
  return session;
}

/** Null while signed out or while the saved session is being verified. */
export function usePipUser() { return useContext(Context)?.userId ?? null; }
