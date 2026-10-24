import type { ComponentProps, ReactNode } from "react";

const fieldClass = "bp-field block h-11 w-full min-w-0 rounded-[10px] border border-control bg-field px-3 text-base leading-normal text-fg placeholder:text-muted";

export function Field({ htmlFor, label, children, className = "" }: {
  htmlFor: string;
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-body">{label}</label>
      {children}
    </div>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${fieldClass} ${className}`} {...props} />;
}

/** Keeps native keyboard and touch selection, with room for a consistent chevron. */
export function Select({ compact = false, className = "", ...props }: ComponentProps<"select"> & { compact?: boolean }) {
  return (
    <span className={`relative block min-w-0 ${compact ? "w-14 shrink-0" : "w-full"}`}>
      <select className={`${fieldClass} cursor-pointer appearance-none ${compact ? "pr-6 pl-2 font-mono font-bold text-body" : "pr-10"} ${className}`} {...props} />
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-body ${compact ? "right-1" : "right-3"}`}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}
