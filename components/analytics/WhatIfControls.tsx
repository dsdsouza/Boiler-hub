"use client";

import type { Size } from "@/lib/types";
import { SIZE_POINTS } from "@/lib/pressure";
import { MAX_DEADLINE_SHIFT_DAYS, clampShift, formatLocal, shiftedDeadline, type WhatIfScenario } from "@/lib/analytics";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";

const SIZES = Object.keys(SIZE_POINTS) as Size[];
const KINDS: { kind: Exclude<WhatIfScenario["kind"], "none">; label: string }[] = [
  { kind: "size", label: "Change size" },
  { kind: "deadline", label: "Move deadline" },
  { kind: "complete", label: "Mark complete" },
];

const chip =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border border-control px-3.5 text-sm font-semibold text-body has-[:checked]:border-brass has-[:checked]:bg-surface-2 has-[:checked]:text-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brass";

export interface OpenTaskOption {
  id: string;
  title: string;
  size: Size;
  due: string | undefined;
  imported: boolean;
}

export function WhatIfControls({
  tasks,
  task,
  taskId,
  scenario,
  now,
  timeZone,
  onTask,
  onScenario,
  onReset,
}: {
  tasks: OpenTaskOption[];
  task: OpenTaskOption | undefined;
  taskId: string;
  scenario: WhatIfScenario;
  now: Date;
  timeZone: string;
  onTask: (id: string) => void;
  onScenario: (s: WhatIfScenario) => void;
  onReset: () => void;
}) {
  const pick = (kind: Exclude<WhatIfScenario["kind"], "none">) => {
    if (!task) return;
    onScenario(kind === "size" ? { kind, size: task.size } : kind === "deadline" ? { kind, days: 0 } : { kind });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()} aria-label="Hypothetical change">
      <Field htmlFor="whatif-task" label="Task to change (one at a time)">
        <Select id="whatif-task" value={taskId} onChange={(e) => onTask(e.target.value)}>
          <option value="">Choose a task…</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </Select>
      </Field>
      {task && (
        <p className="m-0 -mt-2 text-sm text-body" data-testid="task-details">
          Size {task.size} · {task.due ? `due ${formatLocal(task.due, timeZone)}` : "no deadline"}
          {task.imported ? " · imported" : ""}
        </p>
      )}

      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" disabled={!task}>
        <legend className="mb-1.5 p-0 text-[13px] font-medium text-body">Hypothetical change</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map(({ kind, label }) => (
            <label key={kind} className={chip}>
              <input type="radio" name="whatif-kind" value={kind} checked={scenario.kind === kind} onChange={() => pick(kind)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {task && scenario.kind === "size" && (
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-1.5 p-0 text-[13px] font-medium text-body">New size (points from the engine)</legend>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((s) => (
              <label key={s} className={chip}>
                <input type="radio" name="whatif-size" value={s} checked={scenario.size === s} onChange={() => onScenario({ kind: "size", size: s })} className="sr-only" />
                {s} · {SIZE_POINTS[s]} pts{s === task.size ? " (current)" : ""}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {task && scenario.kind === "deadline" && (
        <div className="flex flex-col gap-2">
          <label htmlFor="whatif-shift" className="text-[13px] font-medium text-body">
            Move deadline by days ({-MAX_DEADLINE_SHIFT_DAYS} to +{MAX_DEADLINE_SHIFT_DAYS})
          </label>
          <div className="flex items-center gap-2">
            <Button variant="secondary" aria-label="Move one day earlier" onClick={() => onScenario({ kind: "deadline", days: clampShift(scenario.days - 1) })} disabled={scenario.days <= -MAX_DEADLINE_SHIFT_DAYS}>
              −1
            </Button>
            <input
              id="whatif-shift"
              type="range"
              min={-MAX_DEADLINE_SHIFT_DAYS}
              max={MAX_DEADLINE_SHIFT_DAYS}
              step={1}
              value={scenario.days}
              onChange={(e) => onScenario({ kind: "deadline", days: clampShift(Number(e.target.value)) })}
              aria-valuetext={`${scenario.days > 0 ? "+" : ""}${scenario.days} days`}
              className="min-w-0 flex-1 accent-[#D1A85A]"
            />
            <Button variant="secondary" aria-label="Move one day later" onClick={() => onScenario({ kind: "deadline", days: clampShift(scenario.days + 1) })} disabled={scenario.days >= MAX_DEADLINE_SHIFT_DAYS}>
              +1
            </Button>
          </div>
          <p className="m-0 text-sm text-body" data-testid="deadline-readout">
            {task.due ? `Current: ${formatLocal(task.due, timeZone)}. ` : "No deadline today, so this starts from the evaluation time. "}
            New: <strong className="text-fg">{formatLocal(shiftedDeadline(task, scenario.days, now, timeZone), timeZone)}</strong> ({scenario.days > 0 ? "+" : ""}
            {scenario.days} days)
          </p>
          {task.imported && <p className="m-0 text-sm text-body">Imported task: this is hypothetical and does not change the school’s deadline.</p>}
        </div>
      )}

      {task && scenario.kind === "complete" && <p className="m-0 text-sm text-body">Removes only this task’s load, today and in the forecast.</p>}

      <div>
        <Button variant="ghost" onClick={onReset} disabled={!taskId && scenario.kind === "none"}>
          Reset
        </Button>
      </div>
    </form>
  );
}
