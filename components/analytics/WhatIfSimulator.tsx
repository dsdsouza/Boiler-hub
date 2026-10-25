"use client";

import { useMemo, useState } from "react";
import type { LoadItem } from "@/lib/types";
import {
  NO_SCENARIO,
  changeFromScenario,
  currentSize,
  isOpenTask,
  simulateWhatIf,
  type WhatIfScenario,
} from "@/lib/analytics";
import { Card } from "@/components/ui/Card";
import { ForecastComparison } from "./ForecastComparison";
import { PipWhatIf } from "./PipWhatIf";
import { PressureComparison } from "./PressureComparison";
import { WhatIfControls, type OpenTaskOption } from "./WhatIfControls";
import { WhatIfNotes } from "./WhatIfNotes";

/**
 * Personal what-if simulator. Holds only a task choice and one scenario in memory. It reads the items
 * it is given, never writes them, and has no save, apply or network path.
 */
export function WhatIfSimulator({ items, now, timeZone }: { items: readonly Readonly<LoadItem>[]; now: Date; timeZone: string }) {
  const [taskId, setTaskId] = useState("");
  const [scenario, setScenario] = useState<WhatIfScenario>(NO_SCENARIO);

  const tasks = useMemo<OpenTaskOption[]>(
    () =>
      items
        .filter((i) => isOpenTask(i, now))
        .map((i) => ({ id: i.id, title: i.title, size: currentSize(i), due: i.due, imported: i.source === "ics" || i.source === "github" }))
        .sort((a, b) => (a.due ? Date.parse(a.due) : Infinity) - (b.due ? Date.parse(b.due) : Infinity) || a.title.localeCompare(b.title)),
    [items, now],
  );
  const task = tasks.find((t) => t.id === taskId);
  const change = useMemo(() => changeFromScenario(task, scenario, now, timeZone), [task, scenario, now, timeZone]);
  const result = useMemo(() => simulateWhatIf({ items, now, timeZone, change }), [items, now, timeZone, change]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <Card className="flex flex-col gap-4 p-5 lg:self-start">
        <h2 className="m-0 font-display text-[26px] leading-none font-normal tracking-[0.03em]">Try a change</h2>
        <WhatIfControls
          tasks={tasks}
          task={task}
          taskId={taskId}
          scenario={scenario}
          now={now}
          timeZone={timeZone}
          onTask={(id) => {
            setTaskId(id);
            setScenario(NO_SCENARIO);
          }}
          onScenario={setScenario}
          onReset={() => {
            setTaskId("");
            setScenario(NO_SCENARIO);
          }}
        />
        {result.status === "invalid" && (
          <p role="alert" className="m-0 text-sm text-redline-ink">
            {result.invalid?.message}
          </p>
        )}
      </Card>

      <div className="flex min-w-0 flex-col gap-6">
        <Card className="flex flex-col gap-6 p-5">
          <PressureComparison result={result} />
          <PipWhatIf result={result} />
        </Card>
        <Card className="p-5">
          <ForecastComparison result={result} />
        </Card>
        <WhatIfNotes result={result} />
      </div>
    </div>
  );
}
