/** Task size and timing share the same badges in the forecast and pressure breakdown. */
export function ContributionReason({ reason }: { reason: string }) {
  const task = /^([SML] task), (.+)$/.exec(reason);

  if (!task) return <div className="text-[13px] text-muted">{reason}</div>;

  const pill = "inline-flex max-w-full items-center rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[13px] leading-5 text-body";

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <span className={pill}>{task[1]}</span>
      <span className="sr-only">, </span>
      <span className={pill}>{task[2]}</span>
    </div>
  );
}
