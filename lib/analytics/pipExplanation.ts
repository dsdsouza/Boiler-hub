import type { Zone } from "@/lib/types";
import { taskHorizonDays } from "@/lib/pressure";
import type { WhatIfChange, WhatIfResult } from "./whatIf";
import { formatLocal, weekdayOfDate } from "./time";

// Pip's what-if explanation: a deterministic template over the computed difference.
// No model call. Every number in the text comes from the WhatIfResult.

const zoneName = (z: Zone) => z[0].toUpperCase() + z.slice(1);
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

function changePhrase(result: WhatIfResult, change: WhatIfChange): string {
  const task = result.task;
  if (!task) return "That change";
  const name = `“${task.title}”`;
  switch (change.type) {
    case "complete":
      return `Marking ${name} done`;
    case "size":
      return `Making ${name} ${change.size} instead of ${task.before.size}`;
    case "deadline":
      return `Moving ${name} to ${formatLocal(change.due, result.timeZone)}`;
  }
}

export function pipWhatIfMessage(result: WhatIfResult): string {
  const { change, status, task, baseline, simulated, delta } = result;
  if (status === "baseline" || !change) return "This is your baseline. Pick a task and one change, and I'll show what moves.";
  if (status === "invalid") return `I can't model that. ${result.invalid?.message ?? ""}`.trim();
  if (status === "unchanged" || !task) return "That matches how the task already is, so nothing moves.";

  const lead = changePhrase(result, change);
  let first: string;
  if (task.before.state === "outside-window" && task.after.state === "outside-window") {
    first = `${lead} wouldn't change today's score of ${baseline.score}, because the task stays more than ${taskHorizonDays(task.title)} days out.`;
  } else if (delta.score !== 0) {
    const zone = delta.zoneChanged ? `, ${zoneName(baseline.zone)} to ${zoneName(simulated.zone)}` : "";
    const why = task.before.state === "counted" && task.after.state === "outside-window" ? `, because the task would sit outside its ${taskHorizonDays(task.title)}-day preparation window` : "";
    first = `${lead} would ${delta.score < 0 ? "lower" : "raise"} today's score from ${baseline.score} to ${simulated.score} (${signed(delta.score)}${zone})${why}.`;
  } else if (Math.abs(delta.raw) > 1e-9) {
    first = `${lead} would shift the load by ${Math.abs(Math.round(delta.raw * 100) / 100)} points, but today's score stays ${baseline.score}.`;
  } else {
    first = `${lead} wouldn't change today's score of ${baseline.score}.`;
  }

  const peak = result.forecast.reduce((best, d) => (Math.abs(d.delta) > Math.abs(best.delta) ? d : best), result.forecast[0]);
  const second =
    peak && peak.delta !== 0
      ? `The forecast changes most on ${weekdayOfDate(peak.date)}: ${peak.baseline.score} to ${peak.simulated.score}.`
      : "The seven-day forecast stays the same.";

  const note = task.imported && change.type === "deadline" ? " This only changes your view; the school's deadline stays as it is." : "";
  return `${first} ${second}${note}`;
}
