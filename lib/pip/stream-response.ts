import "server-only";
import { MAX_PIP_REPLY, PIP_STREAM_TYPE, type PipStreamEvent } from "./stream";
import type { PipGenerationPart } from "./planning";

/** Backpressure and cancellation stay connected to the provider, without buffering a reply. */
export function pipStreamResponse(source: (signal: AbortSignal) => AsyncGenerator<PipGenerationPart>, options: {
  signal: AbortSignal;
  asOf: string;
  onError: (failure: unknown) => string;
}) {
  const abort = new AbortController();
  const signal = AbortSignal.any([options.signal, abort.signal]);
  const iterator = source(signal);
  const encoder = new TextEncoder();
  const encode = (event: PipStreamEvent) => encoder.encode(JSON.stringify(event) + "\n");
  let closed = false;
  let length = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (!closed) {
          const next = await iterator.next();
          if (closed) return;
          if (next.done) {
            if (!length) throw new Error("Empty model reply");
            controller.enqueue(encode({ type: "done", asOf: options.asOf }));
            closed = true;
            abort.abort();
            controller.close();
            return;
          }
          if (!next.value) continue;
          if (typeof next.value !== "string") {
            controller.enqueue(encode({ type: "proposal", proposal: next.value.proposal }));
            return;
          }
          length += next.value.length;
          if (length > MAX_PIP_REPLY) throw new Error("Oversized model reply");
          controller.enqueue(encode({ type: "delta", text: next.value }));
          return;
        }
      } catch (failure) {
        if (closed) return;
        closed = true;
        if (!signal.aborted) controller.enqueue(encode({ type: "error", message: options.onError(failure) }));
        abort.abort();
        controller.close();
        await iterator.return(undefined);
      }
    },
    async cancel() {
      closed = true;
      abort.abort();
      await iterator.return(undefined);
    },
  }, { highWaterMark: 0 });
  return new Response(body, { headers: {
    "Content-Type": `${PIP_STREAM_TYPE}; charset=utf-8`,
    "Cache-Control": "private, no-store, no-transform",
    "X-Content-Type-Options": "nosniff",
    Vary: "Accept",
  } });
}
