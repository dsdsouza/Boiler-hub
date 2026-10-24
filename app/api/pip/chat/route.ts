import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/me/_lib/http";
import { MAX_CHAT_BODY, parseChatBody } from "@/lib/pip/contracts";
import { assignmentContext } from "@/lib/pip/context";
import { askGemini } from "@/lib/pip/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
const error = (message: string, status: number, extra?: Record<string, string>) => NextResponse.json({ error: message }, { status, headers: { ...headers, ...extra } });

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
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return error("This request could not be verified.", 403);
    const auth = await requireUser();
    if (auth instanceof NextResponse) return error("Sign in to chat with Pip about your assignments.", 401);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return error("Send a text message to Pip.", 400);
    const raw = await boundedBody(request);
    if (raw === null) return error("This conversation is too long. Start a new chat.", 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return error("That message could not be read.", 400); }
    const chat = parseChatBody(body);
    if (!chat) return error("Keep your message under 1,000 characters and try again.", 400);
    if (!process.env.GEMINI_API_KEY?.trim()) return error("Pip chat is getting ready. Please try again later.", 503);
    const { data: quota, error: quotaError } = await auth.supabase.rpc("pip_chat_take_quota");
    if (quotaError || !quota || typeof quota.allowed !== "boolean") return error("Pip chat is temporarily unavailable. Please try again later.", 503);
    if (!quota.allowed) return error("You’ve reached Pip’s chat limit. Please try again later.", 429, { "Retry-After": String(Math.max(1, Math.min(86400, Number(quota.retryAfter) || 60))) });
    const context = await assignmentContext(auth.supabase, auth.user.id, chat.timeZone);
    const reply = await askGemini(chat.messages, context, request.signal);
    return NextResponse.json({ reply, asOf: context.asOf }, { headers });
  } catch {
    // Do not log provider errors: they can include prompts, assignment data, or credentials.
    return error("Pip couldn’t answer right now. Your assignments are unchanged. Please try again.", 503);
  }
}
