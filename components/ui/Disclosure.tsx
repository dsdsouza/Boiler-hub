import type { ComponentPropsWithoutRef, ReactNode } from "react";

type DisclosureProps = ComponentPropsWithoutRef<"details"> & {
  label: ReactNode;
  children: ReactNode;
  flush?: boolean;
};

/** Native disclosure behavior with the same header and spacing throughout the app. */
export function Disclosure({ label, children, className = "", flush = false, ...props }: DisclosureProps) {
  return (
    <details {...props} className={`bp-disclosure ${className}`}>
      <summary className="bp-disclosure-trigger">
        <span className="bp-disclosure-label">{label}</span>
        <svg
          className="bp-disclosure-chevron"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className={`bp-disclosure-content ${flush ? "bp-disclosure-content-flush" : ""}`}>{children}</div>
    </details>
  );
}
