import type { Status } from "@/lib/types";
import { STATUS_META } from "./zones";

export function StatusDot({ status, size = 9 }: { status: Status; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block flex-none rounded-full"
      style={{ width: size, height: size, backgroundColor: STATUS_META[status].color }}
    />
  );
}

/** Dot plus label. `boxed` draws the pill outline for use outside cards. */
export function StatusPill({ status, boxed, className = "" }: { status: Status; boxed?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[13px] font-semibold text-body ${boxed ? "rounded-full border border-line px-2.5 py-1" : ""} ${className}`}
    >
      <StatusDot status={status} />
      {STATUS_META[status].label}
    </span>
  );
}
