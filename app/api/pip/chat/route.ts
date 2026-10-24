import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/me/_lib/http";
import { MAX_CHAT_BODY, parseChatBody } from "@/lib/pip/contracts";
import { assignmentContext } from "@/lib/pip/context";
import { askGemini, streamGemini } from "@/lib/pip/gemini";
import { pipFailure, type PipStage } from "@/lib/pip/failure";
import { checkPipScope } from "@/lib/pip/scope";
import { PIP_REFUSAL } from "@/lib/pip/policy";
import { MAX_PIP_REPLY, PIP_STREAM_TYPE } from "@/lib/pip/stream";
import { pipStreamResponse } from "@/lib/pip/stream-response";
import type { StudyProposal } from "@/lib/pip/planning";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
const error = (message: string, status: number, extra?: Record<string, string>) => NextResponse.json({ error: message }, { status, headers: { ...headers, ...extra } });

function failureMessage(stage: PipStage, failure: unknown) {
  const diagnostic = pipFailure(stage, failure);
  console.warn("[pip] chat failed", diagnostic);
  const busy = (stage === "gemini" || stage === "scope" || stage === "review") && (diagnostic.status === 503 || diagnostic.kind === "timeout");
  return { busy, message: busy ? "Gemini is temporarily busy. Please try again in a moment. Your assignments are unchanged." : "Pip couldn’t answer right now. Your assignments are unchanged. Please try again." };
}

async function boundedBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_CHAT_BODY) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, length).toString("utf8");
}

export async function POST(request: Request) {
  let stage: PipStage = "setup";
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return error("This request could not be verified.", 403);
    const auth = await requireUser();
    if (auth instanceof NextResponse) return error("Sign in to chat with Pip about your assignments.", 401);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return error("Send a text message to Pip.", 400);
    const raw = await boundedBody(request);
    if (raw === null) return error("This conversation or course material is too long. Shorten an excerpt or start a new chat.", 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return error("That message could not be read.", 400); }
    const chat = parseChatBody(body);
    if (!chat) return error("Keep your message under 1,000 characters and try again.", 400);
    if (!process.env.GEMINI_API_KEY?.trim()) return error("Pip chat is getting ready. Please try again later.", 503);
    const { data: quota, error: quotaError } = await auth.supabase.rpc("pip_chat_take_quota");
    if (quotaError || !quota || typeof quota.allowed !== "boolean") return error("Pip chat is temporarily unavailable. Please try again later.", 503);
    if (!quota.allowed) return error("You’ve reached Pip’s chat limit. Please try again later.", 429, { "Retry-After": String(Math.max(1, Math.min(86400, Number(quota.retryAfter) || 60))) });
    // One budget includes both scope checks, source loading, and answer generation.
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(50_000)]);
    stage = "scope";
    const scope = await checkPipScope(chat.messages, signal);
    if (!scope.allowed) {
      return NextResponse.json({ reply: PIP_REFUSAL, asOf: new Date().toISOString() }, { headers });
    }
    stage = "assignments";
    const context = await assignmentContext(auth.supabase, auth.user.id, scope.timeZone ?? chat.timeZone);
    if (chat.study) context.study = chat.study;
    stage = "gemini";
    if (request.headers.get("accept")?.includes(PIP_STREAM_TYPE)) {
      return pipStreamResponse(async function* (streamSignal) {
        // Never display provider deltas before reviewing the entire bounded reply.
        let draft = "";
        let proposal: StudyProposal | undefined;
        for await (const part of streamGemini(chat.messages, context, streamSignal)) {
          if (typeof part !== "string") { proposal = part.proposal; continue; }
          draft += part;
          if (draft.length > MAX_PIP_REPLY) throw new Error("Oversized model reply");
        }
        if (!draft.trim()) throw new Error("Empty model reply");
        stage = "review";
        const approved = (await checkPipScope(chat.messages, streamSignal, proposal ? JSON.stringify({ reply: draft, proposal }) : draft)).allowed;
        if (approved && proposal) yield { proposal };
        yield approved ? draft : PIP_REFUSAL;
      }, {
        signal, asOf: context.asOf,
        onError: (failure) => failureMessage(stage, failure).message,
      });
    }
    let proposal: StudyProposal | undefined;
    const draft = await askGemini(chat.messages, context, signal, (value) => { proposal = value; });
    stage = "review";
    const approved = (await checkPipScope(chat.messages, signal, proposal ? JSON.stringify({ reply: draft, proposal }) : draft)).allowed;
    const reply = approved ? draft : PIP_REFUSAL;
    return NextResponse.json({ reply, asOf: context.asOf, ...(approved && proposal ? { proposal } : {}) }, { headers: { ...headers, Vary: "Accept" } });
  } catch (failure) {
    // Provider error objects can include prompts, assignment data, or credentials.
    const failureInfo = failureMessage(stage, failure);
    return error(failureInfo.message, 503, failureInfo.busy ? { "Retry-After": "30" } : undefined);
  }
}
