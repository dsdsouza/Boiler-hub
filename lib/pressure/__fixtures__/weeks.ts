import type { LoadItem, Size } from "@/lib/types";

// Realistic weeks for tuning and tests. `NOW` is Monday 8:00 UTC; days 0..6 are Mon..Sun.
export const NOW = new Date("2026-10-26T08:00:00Z");

const at = (day: number, hour: number) => new Date(Date.UTC(2026, 9, 26 + day, Math.floor(hour), (hour % 1) * 60));

let seq = 0;
export function event(
  day: number,
  hour: number,
  hours: number,
  title: string,
  extra: Partial<LoadItem> = {},
): LoadItem {
  return {
    id: `e${++seq}`,
    kind: "event",
    source: "google",
    title,
    start: at(day, hour).toISOString(),
    end: at(day, hour + hours).toISOString(),
    ...extra,
  };
}

export function task(title: string, size: Size, dueDay: number, dueHour = 23.5, extra: Partial<LoadItem> = {}): LoadItem {
  return { id: `t${++seq}`, kind: "task", source: "manual", title, size, due: at(dueDay, dueHour).toISOString(), ...extra };
}

const recurring = (attendees: number, extra: Partial<LoadItem> = {}): Partial<LoadItem> => ({
  isRecurring: true,
  attendees,
  ...extra,
});

/**
 * College student: 5 courses (about 15 class hours across the week, recurring, ~25 people, not organizer)
 * and 3 assignments (problem set S due Tue, lab report M due Thu, essay L due Sun).
 */
export function studentWeek(): LoadItem[] {
  const items: LoadItem[] = [];
  // Mon/Wed/Fri: Calc, Chem, Writing (1h each)
  for (const day of [0, 2, 4]) {
    items.push(event(day, 9, 1, "Calculus II", recurring(30)));
    items.push(event(day, 11, 1, "General Chemistry", recurring(60)));
    items.push(event(day, 14, 1, "Writing Seminar", recurring(15)));
  }
  // Tue/Thu: Bio + Psych (1.5h each), Chem lab Thu (3h)
  for (const day of [1, 3]) {
    items.push(event(day, 10, 1.5, "Intro Biology", recurring(40)));
    items.push(event(day, 13, 1.5, "Intro Psychology", recurring(80)));
  }
  items.push(event(3, 15, 3, "Chem Lab", recurring(20)));
  items.push(task("Calc problem set", "S", 1));
  items.push(task("Bio lab report", "M", 3));
  items.push(task("Writing essay draft", "L", 6));
  return items;
}

/**
 * Engineering manager: 25 meeting hours. Recurring rituals plus one-off planning, reviews and interviews.
 * Organizes 1:1s, staff and planning. Two tasks (S and M).
 */
export function managerWeek(): LoadItem[] {
  const items: LoadItem[] = [];
  for (let day = 0; day < 5; day++) {
    items.push(event(day, 9.5, 0.25, "Standup", recurring(8))); // 1.25h
    items.push(event(day, 13, 0.5, "1:1", recurring(2, { isOrganizer: true }))); // 2.5h
    items.push(event(day, 15.5, 0.5, "1:1", recurring(2, { isOrganizer: true }))); // 2.5h
  }
  items.push(event(0, 10, 1, "Staff meeting", recurring(10, { isOrganizer: true }))); // 1h
  items.push(event(0, 11, 1.5, "Sprint planning", recurring(9, { isOrganizer: true }))); // 1.5h
  items.push(event(1, 10, 1, "Skip-level", recurring(6))); // 1h
  items.push(event(1, 14, 2, "Q4 roadmap review", { attendees: 12 })); // 2h
  items.push(event(1, 16.5, 1, "Interview: backend", { attendees: 2 })); // 1h
  items.push(event(2, 10, 1.5, "Design review", { attendees: 7 })); // 1.5h
  items.push(event(2, 14, 1, "Hiring sync", { attendees: 5, isOrganizer: true })); // 1h
  items.push(event(2, 16.5, 1, "Interview: frontend", { attendees: 2 })); // 1h
  items.push(event(3, 10, 1, "Incident postmortem", { attendees: 10 })); // 1h
  items.push(event(3, 11, 1.5, "Architecture sync", { attendees: 6 })); // 1.5h
  items.push(event(3, 14, 1, "Vendor call", { attendees: 4 })); // 1h
  items.push(event(3, 16.5, 1, "Interview: manager", { attendees: 3 })); // 1h
  items.push(event(4, 10, 1, "Sprint review", recurring(15))); // 1h
  items.push(event(4, 11, 1, "Retro", recurring(9, { isOrganizer: true }))); // 1h
  items.push(event(4, 14, 1.5, "Exec update", { attendees: 8 })); // 1.5h
  items.push(event(4, 16, 0.75, "Budget review", { attendees: 4 })); // 0.75h
  items.push(task("Perf review drafts", "M", 3));
  items.push(task("Approve PTO + expenses", "S", 4));
  return items;
}
