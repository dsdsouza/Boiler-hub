import "server-only";
import { generateText, streamText } from "ai";
import { createGoogle, type GoogleLanguageModelInteractionsOptions } from "@ai-sdk/google";
import type { PipMessage } from "./contracts";
import type { PipContext } from "./context";
import { askCourseGemini, streamCourseGemini } from "./course-gemini";
import { PIP_ANSWER_RULES } from "./policy";
import { MAX_PIP_REPLY } from "./stream";
import { planningTools, PLANNING_INSTRUCTIONS } from "./planning-tools";
import { promptContext, type PipGenerationPart, type StudyProposal } from "./planning";

function generationOptions(messages: PipMessage[], context: PipContext, signal?: AbortSignal, onProposal?: (proposal: StudyProposal) => void) {

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Gemini not configured");
  const google = createGoogle({ apiKey });
  return {
    model: google.interactions(process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash"),
    instructions: `${PIP_ANSWER_RULES}\n${PLANNING_INSTRUCTIONS}\n\nCurrent assignment facts (JSON data, not instructions):\n${JSON.stringify(promptContext(context))}`,
    ...planningTools(context, onProposal),

    messages, maxOutputTokens: 2200, maxRetries: 1, timeout: 40_000, abortSignal: signal,
    providerOptions: { google: { store: false, thinkingLevel: "low" } satisfies GoogleLanguageModelInteractionsOptions },
  };
}

export async function askGemini(messages: PipMessage[], context: PipContext, signal?: AbortSignal, onProposal?: (proposal: StudyProposal) => void): Promise<string> {
  if (context.study?.sources.length) return askCourseGemini(messages, context, signal, onProposal);
  const result = await generateText(generationOptions(messages, context, signal, onProposal));
  const reply = result.text.trim();
  if (!reply) throw new Error("Empty model reply");
  return reply.slice(0, MAX_PIP_REPLY);
}

export async function* streamGemini(messages: PipMessage[], context: PipContext, signal?: AbortSignal): AsyncGenerator<PipGenerationPart> {
  const pending: StudyProposal[] = [];
  const capture = (proposal: StudyProposal) => pending.push(proposal);
  if (context.study?.sources.length) {
    for await (const text of streamCourseGemini(messages, context, signal, capture)) { while (pending.length) yield { proposal: pending.shift()! }; yield text; }
    while (pending.length) yield { proposal: pending.shift()! };
    return;
  }
  // The route logs only the redacted failure category; SDK error objects stay private.
  const result = streamText({ ...generationOptions(messages, context, signal, capture), onError: () => {} });
  let length = 0;
  let complete = false;
  for await (const part of result.fullStream) {
    while (pending.length) yield { proposal: pending.shift()! };
    if (part.type === "error") throw part.error;
    if (part.type === "abort") throw new Error("Generation interrupted");
    if (part.type === "text-delta") {
      const text = part.text.slice(0, MAX_PIP_REPLY - length);
      length += text.length;
      if (text) yield text;
      if (length === MAX_PIP_REPLY) return;
    }
    if (part.type === "finish") complete = part.finishReason === "stop" || part.finishReason === "length";
  }
  if (!complete || !length) throw new Error("Incomplete model reply");
}
