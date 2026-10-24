export interface CalendarDeadline {
  id: string;
  title: string;
  dueAt: string;
}

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

/** RFC 5545: fold at 75 octets, keeping UTF-8 code points intact. Continuations include a space. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) {
      parts.push(current);
      current = " ";
      bytes = 1;
    }
    current += character;
    bytes += length;
  }
  return [...parts, current].join("\r\n");
}

const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

/** Dated tasks become transparent one-minute deadline markers, with stable IDs across refreshes. */
export function deadlineCalendar(tasks: CalendarDeadline[], now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Boilerplate//Deadlines//EN", "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH", "X-WR-CALNAME:Boilerplate deadlines", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  for (const task of tasks) {
    const due = new Date(task.dueAt);
    if (!Number.isFinite(due.getTime())) continue;
    lines.push(
      "BEGIN:VEVENT", `UID:${escapeText(task.id)}@deadlines.boilerhub.work`, `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(due)}`, `DTEND:${stamp(new Date(due.getTime() + 60_000))}`,
      `SUMMARY:${escapeText(task.title)}`, "DESCRIPTION:Edit or complete this deadline in Boilerplate.",
      "STATUS:CONFIRMED", "TRANSP:TRANSPARENT", "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
