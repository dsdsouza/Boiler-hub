"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 5_000;

export function SignInToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {visible && (
        <div className="bp-signin-toast fixed z-50 flex w-[380px] max-w-[calc(100vw-32px)] items-center gap-3 overflow-hidden rounded-xl border border-rivet bg-surface-2 py-2.5 pr-2.5 pb-[13px] pl-[18px] text-fg">
          <svg className="shrink-0 text-brass-ink" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
          </svg>
          <span className="min-w-0 flex-1 text-sm leading-relaxed font-medium">Sign in to open that page.</span>
          <button type="button" className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-muted hover:bg-surface hover:text-fg" aria-label="Dismiss notification" onClick={() => setVisible(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-line" aria-hidden="true">
            <div className="bp-signin-toast-progress h-full origin-left bg-brass-ink" style={{ animationDuration: `${DURATION_MS}ms` }} />
          </div>
        </div>
      )}
    </div>
  );
}
