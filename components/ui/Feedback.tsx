"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/** Announced, readable feedback; motion supports the message rather than carrying it. */
export function Feedback({ message, tone = "success", id }: { message?: string | null; tone?: "success" | "error"; id?: string }) {
  const reduced = useReducedMotion();
  return (
    <div aria-live="polite" aria-atomic="true">
      <AnimatePresence initial={false} mode="wait">
        {message && <motion.div
          key={`${tone}:${message}`}
          id={id}
          initial={{ opacity: 0, y: reduced ? 0 : 12, filter: reduced ? "blur(0px)" : "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: reduced ? 0 : -12, filter: reduced ? "blur(0px)" : "blur(4px)", transition: { duration: 0.15, ease: "easeOut" } }}
          transition={{ duration: reduced ? 0.12 : 0.3, ease: "easeOut" }}
          className={`flex items-start gap-2 py-1 text-sm leading-relaxed ${tone === "error" ? "text-redline-ink" : "text-cool-ink"}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
            {tone === "error" ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 4h.01" /></> : <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>}
          </svg>
          <span className="min-w-0 wrap-anywhere">{message}</span>
        </motion.div>}
      </AnimatePresence>
    </div>
  );
}
