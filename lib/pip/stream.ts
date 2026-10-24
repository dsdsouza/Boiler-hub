export const PIP_STREAM_TYPE = "application/x-ndjson";
export const MAX_PIP_REPLY = 6000;
export type PipStreamEvent = { type: "delta"; text: string } | { type: "proposal"; proposal: StudyProposal } | { type: "done"; asOf: string } | { type: "error"; message: string };
export class PipChatError extends Error {}

/** Decode complete events, even when UTF-8 characters or JSON lines cross network chunks. */
export async function readPipReply(response: Response, onText: (text: string) => void, onProposal?: (proposal: StudyProposal) => void): Promise<string> {
  if (!response.ok || !response.headers.get("content-type")?.includes(PIP_STREAM_TYPE)) {
    // Keep already-open clients and rolling deployments compatible with JSON replies.
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new PipChatError(typeof body?.error === "string" ? body.error : "Pip couldn’t answer. Please try again.");
    if (typeof body?.reply !== "string" || !body.reply.trim() || body.reply.length > MAX_PIP_REPLY) throw new PipChatError("Pip couldn’t answer. Please try again.");
    onText(body.reply);
    const proposal = parseStudyProposal(body.proposal);
    if (proposal) onProposal?.(proposal);
    return body.reply;
  }
  if (!response.body) throw new PipChatError("Pip couldn’t connect. Please try again.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  let reply = "";
  let proposal: StudyProposal | null = null;
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      let newline: number;
      while ((newline = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        if (line.length > 40_000) throw new Error("Oversized Pip stream event");
        if (!line.trim()) continue;
        const event: unknown = JSON.parse(line);
        if (!event || typeof event !== "object") throw new Error("Invalid Pip stream event");
        const part = event as Record<string, unknown>;
        if (part.type === "proposal") {
          proposal = parseStudyProposal(part.proposal);
          if (!proposal) throw new Error("Invalid study proposal");
          continue;
        }
        if (part.type === "error" && typeof part.message === "string") throw new PipChatError(part.message);
        if (part.type === "done") {
          if (!reply.trim()) throw new PipChatError("Pip couldn’t answer. Please try again.");
          if (proposal) onProposal?.(proposal);
          return reply;
        }
        if (part.type !== "delta" || typeof part.text !== "string" || reply.length + part.text.length > MAX_PIP_REPLY) throw new Error("Invalid Pip stream delta");
        reply += part.text;
        onText(reply);
      }
      if (pending.length > 40_000) throw new Error("Oversized Pip stream event");
      if (done) throw new PipChatError("Pip’s reply was interrupted. Please try again.");
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
import { parseStudyProposal, type StudyProposal } from "./planning";
