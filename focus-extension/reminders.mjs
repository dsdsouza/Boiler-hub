/** One relevant nudge per phase, including when Chrome wakes after a missed alarm. */
export function reminderPhase(session, now = Date.now()) {
  if (!session || session.outcome) return null;
  if (now < session.startAt) return now >= session.startAt - 5 * 60000 ? "heads-up" : null;
  if (now < session.endAt) return now >= session.startAt + Math.min(10 * 60000, (session.endAt - session.startAt) / 2) ? "check-in" : "start";
  return now >= session.endAt + 5 * 60000 ? "follow-up" : "finish";
}

export function nextReminderAt(session, now = Date.now()) {
  if (!session || session.outcome) return null;
  return [session.startAt - 5 * 60000, session.startAt, session.startAt + Math.min(10 * 60000, (session.endAt - session.startAt) / 2), session.endAt, session.endAt + 5 * 60000].find((at) => at > now + 250) ?? null;
}

export function reminderCopy(phase, session) {
  const labels = { "heads-up": "Pip: your study time is coming up", start: "Pip: time to come back", "check-in": "Pip: still with me?", finish: "Pip: what did you finish?", "follow-up": "Pip is waiting for your check-in" };
  return { title: labels[phase], message: phase === "finish" || phase === "follow-up" ? `Your focus block for ${session.title} ended. Come back to Pip and tell me what got done.` : `${session.title}\n${session.goal || "One small step is enough to start."}` };
}
