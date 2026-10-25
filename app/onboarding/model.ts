import type { Status } from "@/lib/types";

export const DRAFT_KEY = "boiler:onboarding:v1";
export const ROLES = ["student", "professional", "lead", "other"] as const;
export type Role = (typeof ROLES)[number];
export type Goal = "deadlines" | "balance" | "focus" | "team" | "recommend";
export type StepId =
  | "identity"
  | "name"
  | "goal"
  | "starting"
  | "reassurance"
  | "account"
  | "extension"
  | "calendar"
  | "reading"
  | "review"
  | "milestone"
  | "deadline"
  | "status"
  | "team"
  | "recommendation";
export interface OnboardingDraft {
  version: 2;
  ownerId: string | null;
  role: Role | "";
  name: string;
  goal: Goal | "";
  starting: string;
  milestone: string;
  deadline: string;
  status: Status;
  note: string;
  inviteCode: string;
  joinedTeam: string;
  extensionDeferred: boolean;
  courseworkDeferred: boolean;
  current: StepId;
  completed: StepId[];
  finished: boolean;
}
export const EMPTY_DRAFT: OnboardingDraft = {
  version: 2,
  ownerId: null,
  role: "",
  name: "",
  goal: "",
  starting: "",
  milestone: "",
  deadline: "",
  status: "open",
  note: "",
  inviteCode: "",
  joinedTeam: "",
  extensionDeferred: false,
  courseworkDeferred: false,
  current: "identity",
  completed: [],
  finished: false,
};
const GOALS: Goal[] = ["deadlines", "balance", "focus", "team", "recommend"];
const STATUSES: Status[] = ["open", "heads_down", "running_hot", "away"];
export const STARTING = ["calendar", "overwhelmed", "fresh", "unsure"];
export function resolvedGoal(
  draft: OnboardingDraft,
): Exclude<Goal, "recommend"> {
  return draft.goal && draft.goal !== "recommend"
    ? draft.goal
    : draft.role === "lead"
      ? "team"
      : draft.role === "student"
        ? "deadlines"
        : "balance";
}
export function goalOptions(role: Role | "") {
  return [
    {
      value: "deadlines",
      label:
        role === "student"
          ? "Stay ahead of coursework"
          : "Keep deadlines under control",
      detail:
        role === "student"
          ? "Classes, assignments and exams in one place."
          : "See what is due before the week fills up.",
    },
    {
      value: "balance",
      label: "Understand my workload",
      detail: "Spot a heavy week while there is time to adjust.",
    },
    {
      value: "focus",
      label: "Make room to focus",
      detail: "Protect time and make a start on important work.",
    },
    ...(role === "lead"
      ? [
          {
            value: "team",
            label: "Support my team",
            detail: "Understand capacity before assigning more work.",
          },
        ]
      : []),
    {
      value: "recommend",
      label: "I’m not sure yet",
      detail: "Let Pip recommend a starting point.",
    },
  ] as { value: Goal; label: string; detail: string }[];
}
export function stepsFor(draft: OnboardingDraft): StepId[] {
  const goal = resolvedGoal(draft);
  return [
    "identity",
    "name",
    "goal",
    "starting",
    "reassurance",
    "account",
    "extension",
    "calendar",
    ...(!draft.extensionDeferred ? ["reading" as const] : []),
    ...(draft.role === "student" && !draft.courseworkDeferred ? ["review" as const] : []),
    ...(goal === "deadlines" && !draft.extensionDeferred
      ? [
          "milestone" as const,
          ...(draft.milestone.trim() ? ["deadline" as const] : []),
        ]
      : []),
    "status",
    "team",
    "recommendation",
  ];
}
export function needsManualTask(draft: OnboardingDraft): boolean {
  return draft.role !== "lead" && draft.extensionDeferred;
}
export function isStepValid(
  step: StepId,
  draft: OnboardingDraft,
  signedIn: boolean,
): boolean {
  switch (step) {
    case "identity":
      return ROLES.includes(draft.role as Role);
    case "name":
      return draft.name.trim().length > 0 && draft.name.trim().length <= 60;
    case "goal":
      return goalOptions(draft.role).some((g) => g.value === draft.goal);
    case "starting":
      return STARTING.includes(draft.starting);
    case "account":
      return signedIn;
    case "deadline":
      return !draft.deadline || isDate(draft.deadline);
    case "team":
      return !draft.inviteCode || /^[A-Z0-9]{6}$/.test(draft.inviteCode);
    case "recommendation":
      return !needsManualTask(draft) || (draft.milestone.trim().length > 0 &&
        (!draft.deadline || isDate(draft.deadline)));
    default:
      return true;
  }
}
export function unlockedIndex(
  draft: OnboardingDraft,
  signedIn: boolean,
): number {
  const steps = stepsFor(draft);
  const first = steps.findIndex(
    (step) =>
      !draft.completed.includes(step) || !isStepValid(step, draft, signedIn),
  );
  return first === -1 ? steps.length - 1 : first;
}
export function isDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime()) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
/** Treat cached and account metadata as untrusted input; never accept secrets here. */
export function parseDraft(value: unknown): OnboardingDraft {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { ...EMPTY_DRAFT, completed: [] };
  const v = value as Record<string, unknown>;
  const str = (key: string, max: number) =>
    typeof v[key] === "string" ? (v[key] as string).slice(0, max) : "";
  const draft: OnboardingDraft = {
    ...EMPTY_DRAFT,
    ownerId: str("ownerId", 80) || null,
    role: v.role === "helping" ? "other" : ROLES.includes(v.role as Role) ? (v.role as Role) : "",
    name: str("name", 60),
    goal: GOALS.includes(v.goal as Goal) ? (v.goal as Goal) : "",
    starting: STARTING.includes(str("starting", 30)) ? str("starting", 30) : "",
    milestone: str("milestone", 200),
    deadline: isDate(str("deadline", 10)) ? str("deadline", 10) : "",
    status: STATUSES.includes(v.status as Status)
      ? (v.status as Status)
      : "open",
    note: str("note", 80),
    inviteCode: str("inviteCode", 6)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, ""),
    joinedTeam: str("joinedTeam", 80),
    extensionDeferred: v.extensionDeferred === true,
    courseworkDeferred: v.courseworkDeferred === true,
    completed: [],
    current: "identity",
    finished: v.finished === true,
  };
  const all: StepId[] = [
    ...stepsFor(draft),
    "reading",
    "milestone",
    "deadline",
  ];
  draft.current = v.current === "sources" ? "calendar"
    : v.current === "ready" ? "recommendation"
    : all.includes(v.current as StepId) ? (v.current as StepId) : "identity";
  draft.completed = Array.isArray(v.completed)
    ? [
        ...new Set(
          v.completed.filter((s): s is StepId => all.includes(s as StepId)),
        ),
      ]
    : [];
  // Completed journeys predate the separate reading page; keep them complete.
  if (
    v.version === 2 && draft.finished && !draft.extensionDeferred &&
    draft.completed.includes("calendar") && !draft.completed.includes("reading")
  )
    draft.completed.push("reading");
  if (v.version === 1) {
    draft.finished = false;
    draft.completed = draft.completed.filter((s) => !["extension", "calendar", "review", "recommendation", "ready"].includes(s));
    if (v.current === "focus-extension" || ["extension", "calendar", "review", "recommendation", "ready"].includes(draft.current)) draft.current = "extension";
  }
  return draft;
}
export function recommendation(draft: OnboardingDraft) {
  const goal = resolvedGoal(draft);
  if (needsManualTask(draft))
    return {
      body: draft.finished ? "Your tasks are ready in My Boiler." : "Add your first task to start your boiler.",
      href: "/boiler",
      action: "Open my boiler",
    };
  if (goal === "team")
    return {
      body: "Start in Teams. Invite people to share their capacity, then preview how assignments affect their pressure. Everyone joins hidden and chooses what to share.",
      href: "/teams",
      action: "Open my teams",
    };
  if (goal === "focus")
    return {
      body: "Add a task in My Boiler, then open Focus with Pip in Connect to protect a study session. If you installed the extension, distracting sites pause while you work.",
      href: "/settings/sources#study-accountability",
      action: "Open my focus setup",
    };
  if (goal === "deadlines")
    return {
      body: draft.milestone
        ? `Keep “${draft.milestone}” in view alongside your classes and other deadlines. Your forecast helps you see where the work is building up.`
        : "Bring your calendar and deadlines together in My Boiler. Your forecast shows where work is building up, and completing tasks releases their pressure.",
      href: "/boiler",
      action: "Open my boiler",
    };
  return {
    body:
      draft.starting === "overwhelmed"
        ? "Start with what is already on your plate. My Boiler brings your calendar and tasks together so you can choose one manageable next step."
        : "Your calendar and tasks become one view of the week ahead. Use the forecast to spot busy days and make room before new work arrives.",
    href: "/boiler",
    action: "Open my boiler",
  };
}
