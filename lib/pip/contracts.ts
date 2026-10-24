export const MAX_CHAT_MESSAGE = 1000;
export const MAX_CHAT_HISTORY = 11;
export const MAX_CHAT_BODY = 24_000;

export type PipMessage = { role: "user" | "assistant"; content: string };

export function parseChatBody(body: unknown): { messages: PipMessage[]; timeZone: string } | null {
  if (!body || typeof body !== "object") return null;
  const { messages, timeZone } = body as Record<string, unknown>;
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_CHAT_HISTORY || messages.length % 2 !== 1) return null;
  const parsed: PipMessage[] = [];
  for (const [i, item] of messages.entries()) {
    if (!item || typeof item !== "object") return null;
    const { role, content } = item;
    if (role !== (i % 2 === 0 ? "user" : "assistant") || typeof content !== "string" || !content.trim() || content.length > (role === "user" ? MAX_CHAT_MESSAGE : 6000)) return null;
    parsed.push({ role, content: content.trim() });
  }
  if (typeof timeZone !== "string" || timeZone.length > 100) return null;
  try { new Intl.DateTimeFormat("en", { timeZone }); } catch { return null; }
  return { messages: parsed, timeZone };
}
