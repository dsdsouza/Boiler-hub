"use client";

import { Disclosure } from "@/components/ui/Disclosure";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { FlameLoader } from "@/components/ui/FlameLoader";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/SiteHeader";
import { Mascot } from "@/components/mascot/Mascot";
import { usePipUser } from "@/components/mascot/PipConversation";
import {
  OnboardingPip,
  FirstReadingPip,
} from "@/components/mascot/OnboardingPip";
import { Boiler } from "@/components/boiler/Boiler";
import { CountBadges } from "@/components/boiler/CountBadges";
import { ZoneBadge } from "@/components/ui/ZoneBadge";
import {
  ReconnectBanner,
  CalendarUnavailableBanner,
} from "@/components/boiler/ReconnectBanner";
import { StatusPicker } from "@/components/boiler/StatusPicker";
import {
  CalendarFeedForm,
} from "@/components/sources/SourceForms";
import type { AddedSource } from "@/components/sources/api";
import type { BoilerResponse } from "@/lib/pressure/api-types";
import { readHandoff } from "@/browser-helper/protocol.js";
import {
  readHelperFeed,
  rememberHelperFeed,
  forgetHelperFeed,
} from "@/lib/sources/helper-handoff";
import { ExtensionStep } from "./ExtensionStep";
import { useExtension } from "./useExtension";
import { useDraftAutosave } from "./useDraftAutosave";
import { clearDraftBackup, readDraftBackup, rememberDraftBackup } from "./draft-backup";
import { DeadlineReview } from "./DeadlineReview";
import { courseworkReady, courseworkSources, type SetupCheck } from "./setup";
import {
  DRAFT_KEY,
  goalOptions,
  isStepValid,
  needsManualTask,
  parseDraft,
  recommendation,
  resolvedGoal,
  stepsFor,
  unlockedIndex,
  type OnboardingDraft,
  type StepId,
} from "./model";
import styles from "./onboarding.module.css";

const TITLES: Record<StepId, string> = {
  identity: "Who are we setting up for?",
  name: "What should Pip call you?",
  goal: "What would you like a hand with?",
  starting: "Where are you starting from?",
  reassurance: "You don’t have to hold it all in your head.",
  account: "Keep your progress. Connect your calendar.",
  extension: "Meet Pip in your browser.",
  review: "Review your imported deadlines.",
  calendar: "Bring your week into view",
  reading: "Your first reading",
  milestone: "What’s one thing you want to finish?",
  deadline: "When would you like to finish it?",
  status: "How are you showing up today?",
  team: "Have a team invite?",
  recommendation: "A starting point, just for you.",
};
const OPTIONAL: StepId[] = [
  "calendar",
  "milestone",
  "deadline",
  "team",
];
const field =
  "bp-field min-h-14 w-full rounded-[10px] border border-control bg-field px-4 text-lg text-fg placeholder:text-muted";
const SAVE_LABELS = { idle: "Autosave on", saving: "Saving answers…", saved: null, error: "Answers not saved yet" };
async function call<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok)
    throw new Error(json?.error ?? "That didn’t finish. Please try again.");
  if (method !== "GET") window.dispatchEvent(new Event("boiler:data-changed"));
  return json as T;
}
function readLocal(): OnboardingDraft {
  try {
    return parseDraft(JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null"));
  } catch {
    return parseDraft(null);
  }
}
export function OnboardingClient({
  signedIn,
  accountName,
}: {
  signedIn: boolean;
  accountName: string;
}) {
  const pipUserId = usePipUser();
  const showPip = signedIn && !!pipUserId;
  const [draft, setDraft] = useState<OnboardingDraft>(() => parseDraft(null));
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sourceBusy, setSourceBusy] = useState(false);
  const { state: saveState, save, acknowledge, track, retry: retrySave } = useDraftAutosave(draft, signedIn && loaded && !loadFailed && !busy);
  const [boiler, setBoiler] = useState<BoilerResponse | null>(null);
  const [syncError, setSyncError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [pendingFeed, setPendingFeed] = useState<string | null>(null);
  const [joined, setJoined] = useState("");
  const pip = useExtension("focus");
  const [reviewReceipt, setReviewReceipt] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const loadRequest = useRef(0);
  const skipDialog = useRef<HTMLDialogElement>(null);
  const persist = useCallback((next: OnboardingDraft) => {
    track(next);
    setDraft(next);
    rememberDraftBackup(next);
    if (next.finished) clearDraftBackup(next);
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {
      /* Keep the active in-memory journey. Sign-in checks storage separately. */
    }
  }, [track]);
  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    setLoadFailed(false);
    setError("");
    let next = readLocal();
    const incoming = readHandoff(location.hash);
    try {
      if (incoming) rememberHelperFeed(sessionStorage, incoming);
      setPendingFeed(incoming || readHelperFeed(sessionStorage));
    } catch {
      setPendingFeed(incoming);
    }
    if (location.hash.startsWith("#feed="))
      history.replaceState(
        history.state,
        "",
        location.pathname + location.search,
      );
    if (signedIn) {
      try {
        const saved = await call<{ userId: string; draft: unknown }>(
          "/api/me/onboarding",
        );
        // A superseded account read must not overwrite a newer save acknowledgment.
        if (request !== loadRequest.current) return;
        const backup = readDraftBackup(saved.userId);
        const beforeSignIn = next.ownerId === null && (next.name || next.role);
        if (!beforeSignIn) {
          // Once a tab's edits are acknowledged, the account is authoritative.
          // An older tab must not overwrite answers saved from another device.
          next = backup ?? (saved.draft ? parseDraft(saved.draft)
            : next.ownerId === saved.userId ? next : parseDraft(null));
        }
        if (saved.draft) acknowledge(parseDraft(saved.draft));
        next.ownerId = saved.userId;
        if (!next.name) next.name = accountName.split(" ")[0].slice(0, 60);
      } catch {
        if (request !== loadRequest.current) return;
        setError(
          "Your saved setup could not be loaded. Try again to keep this account’s answers together.",
        );
        setLoadFailed(true);
        setLoaded(true);
        return;
      }
    } else if (next.ownerId) next = parseDraft(null);
    const list = stepsFor(next);
    if (
      !list.includes(next.current) ||
      list.indexOf(next.current) > unlockedIndex(next, signedIn)
    )
      next.current = list[unlockedIndex(next, signedIn)];
    persist(next);
    setLoaded(true);
    if (new URLSearchParams(location.search).has("error"))
      setError(
        "Google sign-in didn’t finish. Your answers are still here. Try again when you’re ready.",
      );
  }, [accountName, acknowledge, persist, signedIn]);
  useEffect(() => {
    void load();
  }, [load]);
  const steps = stepsFor(draft);
  const index = Math.max(0, steps.indexOf(draft.current));
  const step = steps[index];
  const unlocked = unlockedIndex(draft, signedIn);
  const plan = recommendation(draft);
  const goal = resolvedGoal(draft);
  const patch = (values: Partial<OnboardingDraft>) =>
    persist({
      ...draft,
      ...values,
      finished: false,
      completed: draft.completed.filter(
        (s) => s !== "recommendation",
      ),
    });
  const sync = useCallback(async () => {
    setSyncError("");
    setReviewReceipt(null);
    setReviewed(false);
    setSyncing(true);
    try {
      const result = await call<SetupCheck>("/api/me/onboarding/check", "POST");
      setBoiler(result.boiler);
      setReviewReceipt(result.reviewReceipt);
      setReviewed(false);
    } catch {
      setSyncError(
        "Your calendar could not be refreshed. Try again, or connect it later from Connect.",
      );
    } finally {
      setSyncing(false);
    }
  }, []);
  useEffect(() => {
    if (
      signedIn &&
      loaded &&
      (step === "calendar" || step === "reading" || step === "review" || step === "recommendation") &&
      !boiler &&
      !syncError &&
      !syncing
    )
      void sync();
  }, [boiler, loaded, signedIn, step, sync, syncError, syncing]);
  const navigate = useCallback(
    (target: StepId) => {
      if (
        busy ||
        sourceBusy ||
        !steps.includes(target) ||
        steps.indexOf(target) > unlocked
      )
        return;
      setError("");
      persist({ ...draft, current: target });
    },
    [busy, draft, persist, sourceBusy, steps, unlocked],
  );
  useEffect(() => {
    if (!loaded || loadFailed) return;
    viewport.current?.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [loaded, loadFailed, step]);
  function revealPanel(e: SyntheticEvent<HTMLDetailsElement>) {
    const panel = e.currentTarget;
    if (!panel.open) return;
    requestAnimationFrame(() => {
      const el = viewport.current;
      if (!el?.contains(panel)) return;
      const bounds = panel.getBoundingClientRect();
      const frame = el.getBoundingClientRect();
      if (bounds.bottom <= frame.bottom && bounds.top >= frame.top) return;
      el.scrollTo({
        top: Math.max(0, el.scrollTop + bounds.top - frame.top - 4),
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
    });
  }
  function signIn() {
    const next = { ...draft, current: "account" as const };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      if (sessionStorage.getItem(DRAFT_KEY) !== JSON.stringify(next))
        throw new Error("storage");
      location.assign("/auth/signin?next=%2Fonboarding");
    } catch {
      setError(
        "Your browser is blocking saved progress. Allow site storage, then try Google sign-in again so your answers can come with you.",
      );
    }
  }
  const setupReady = (draft.role === "lead" || pip.state === "installed" || draft.extensionDeferred) &&
    (draft.role !== "student" || draft.courseworkDeferred || (courseworkReady(boiler) && !!reviewReceipt && reviewed));
  const valid = (step === "recommendation" && draft.finished) || (
    isStepValid(step, draft, signedIn) &&
    (step !== "extension" || pip.state === "installed") &&
    (step !== "calendar" || draft.role !== "student" || (courseworkReady(boiler) && !!reviewReceipt)) &&
    (step !== "review" || (!!reviewReceipt && reviewed)) &&
    (step !== "recommendation" || setupReady));
  const canSkip = OPTIONAL.includes(step) && !(draft.role === "student" && step === "calendar");
  async function finishLater() {
    if (!loaded || loadFailed || busy || sourceBusy) return;
    if (draft.finished) { location.assign(plan.href); return; }
    setBusy(true); setError("");
    const next = { ...draft, finished: false };
    try {
      if (signedIn) await save(next);
      persist(next);
      location.assign(signedIn ? "/boiler" : "/");
    } catch { setError("Your progress could not be saved. Try Finish later again before leaving."); }
    finally { setBusy(false); }
  }
  const canDeferExtension = step === "extension" && ["missing", "outdated"].includes(pip.state);
  const canDeferCoursework = draft.role === "student" && (step === "calendar" || step === "review");
  const canDeferSetup = canDeferExtension || (canDeferCoursework && !valid);
  async function advance(skip = false) {
    if (
      busy ||
      sourceBusy ||
      (skip && !canSkip && !canDeferExtension && !canDeferCoursework) ||
      (!skip && !valid)
    )
      return;
    if (step === "recommendation" && draft.finished) {
      location.assign(plan.href);
      return;
    }
    let next = {
      ...draft,
      completed: [...new Set([...draft.completed, step])],
      finished: false,
    };
    if (step === "extension") next = { ...next, extensionDeferred: skip };
    if (draft.role === "student" && (step === "calendar" || step === "review"))
      next = { ...next, courseworkDeferred: skip };
    if (skip && step === "team") next = { ...next, inviteCode: "" };
    if (skip && step === "milestone")
      next = { ...next, milestone: "", deadline: "" };
    if (skip && step === "deadline") next = { ...next, deadline: "" };
    setBusy(true);
    setError("");
    try {
      if (step === "team" && !skip && draft.inviteCode && !draft.joinedTeam) {
        const result = await call<{ teamId: string }>(
          "/api/teams/join",
          "POST",
          { code: draft.inviteCode },
        );
        next.joinedTeam = result.teamId;
        setJoined(draft.inviteCode);
      }
      const nextSteps = stepsFor(next);
      next.current = steps.slice(index + 1).find((s) => nextSteps.includes(s)) ?? nextSteps[nextSteps.length - 1];
      if (step === "recommendation")
        next = {
          ...next,
          finished: true,
        };
      if (signedIn)
        await save(next, {
          extensionVersion: pip.state === "installed" ? pip.version : null,
          reviewReceipt,
          deadlinesReviewed: reviewed,
          deadlineAt: next.deadline
            ? new Date(`${next.deadline}T23:59:00`).toISOString()
            : null,
        });
      persist(next);
      if (next.finished) location.assign(plan.href);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const sourceAdded = (r: AddedSource) => {
    if (r.boiler) setBoiler(r.boiler);
    setReviewReceipt(null); setReviewed(false);
    void sync();
    setPendingFeed(null);
    try {
      forgetHelperFeed(sessionStorage);
    } catch {
      /* No cached handoff. */
    }
  };
  function titleFor(target: StepId) {
    return target === "goal" ? `Heyo ${draft.name.trim()}! What would you like a hand with?` : TITLES[target];
  }
  function renderContent(currentStep: StepId): ReactNode {
    let content: ReactNode;
    switch (currentStep) {
      case "identity":
        content = (
          <>
            <Choices
              label={TITLES.identity}
              value={draft.role}
              onChange={(role) =>
                patch({ role: role as OnboardingDraft["role"] })
              }
              options={[
                {
                  value: "student",
                  label: "I’m a student",
                  detail: "Bring classes, coursework and life together.",
                },
                {
                  value: "professional",
                  label: "I’m working",
                  detail: "Find room between meetings and deadlines.",
                },
                {
                  value: "lead",
                  label: "I’m a teacher or team lead",
                  detail: "Keep an eye on my workload and my team’s capacity.",
                },
                {
                  value: "other",
                  label: "Other",
                  detail: "Organizing my life!",
                },
              ]}
            />
          </>
        );
        break;
      case "name":
        content = (
          <>
            <p className={styles.intro}>
              First name, nickname—whatever feels like you.
            </p>
            <label htmlFor="onboarding-name" className={styles.label}>
              Your name
            </label>
            <input
              id="onboarding-name"
              name="given-name"
              autoComplete="given-name"
              maxLength={60}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              className={field}
              placeholder="e.g. Josh"
            />
          </>
        );
        break;
      case "goal":
        content = (
          <>
            <Choices
              label={titleFor("goal")}
              showDetails={false}
              value={draft.goal}
              onChange={(value) =>
                patch({ goal: value as OnboardingDraft["goal"] })
              }
              options={goalOptions(draft.role)}
            />
          </>
        );
        break;
      case "starting":
        content = (
          <>
            <Choices
              label={TITLES.starting}
              showDetails={false}
              value={draft.starting}
              onChange={(starting) => patch({ starting })}
              options={[
                {
                  value: "calendar",
                  label: "I already use a calendar",
                  detail: "Help me see the workload behind my schedule.",
                },
                {
                  value: "overwhelmed",
                  label:
                    goal === "focus"
                      ? "I get distracted when I try to start"
                      : "A lot is competing for my attention",
                  detail: "I’d like a more manageable starting point.",
                },
                {
                  value: "fresh",
                  label: "I’m starting fresh",
                  detail: "Let’s build this up one step at a time.",
                },
                {
                  value: "unsure",
                  label: "I’m not sure",
                  detail: "Start simple. I can add more later.",
                },
              ]}
            />
          </>
        );
        break;
      case "reassurance":
        content = (
          <>
            {showPip && (<OnboardingPip />)}
          </>
        );
        break;
      case "account":
        content = (
          <>
            {signedIn ? (
              <div className={`${styles.connection} ${styles.connectionSuccess}`} role="status">
                <Check />
                <strong>Sign in complete, {draft.name.trim()}!</strong>
              </div>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={signIn}
                  className="w-full sm:w-auto"
                >
                  <GoogleIcon />
                  Continue with Google
                </Button>
              </>
            )}
          </>
        );
        break;
      case "extension":
        content = (
          <>
            {pendingFeed && (
              <p className="mb-4 text-cool-ink" role="status">
                Your calendar link is ready to review in the next step.
              </p>
            )}
            <ExtensionStep extension={pip} onToggle={revealPanel} />
          </>
        );
        break;
      case "review":
        content = <DeadlineReview boiler={boiler} checked={reviewed} onChange={setReviewed} ready={!!reviewReceipt && courseworkReady(boiler)} busy={syncing} onRefresh={() => void sync()} />;
        break;
      case "calendar":
        content = (
          <>
            <p className={styles.intro}>
              {draft.role === "student"
                ? "Use Pip on your school calendar to find its subscription link. Choose All Calendars and Tasks in Brightspace, then Use in onboarding in Pip. You can also paste the feed below."
                : "Google Calendar connects when you sign in. Add coursework or another calendar feed here to bring the rest of your schedule into view."}
            </p>
            {syncing && (
              <FlameLoader label="Reading your week…" />
            )}
            {syncError && (
              <div role="alert">
                <p className="text-redline-ink">{syncError}</p>
                <Button onClick={() => void sync()}>Try calendar again</Button>
              </div>
            )}
            {boiler?.calendar === "ok" && (
              <div className={`${styles.connection} ${styles.connectionSuccess}`}>
                <Check />
                <span>Google Calendar connected</span>
              </div>
            )}
            {boiler?.calendar === "reconnect" && (
              <ReconnectBanner next="/onboarding" />
            )}
            {boiler?.calendar === "unavailable" && (
              <CalendarUnavailableBanner />
            )}
            {!!boiler?.sources?.length && (
              <p className="text-cool-ink">
                Connected: {boiler.sources.map((s) => s.label).join(", ")}.
              </p>
            )}
            <Disclosure
              onToggle={revealPanel}
              open={pendingFeed ? true : undefined}
              className="mt-5"
              label={draft.role === "student" ? "Add my school calendar or another feed" : "Add a calendar feed"}
            >
              <CalendarFeedForm
                key={pendingFeed ?? "manual"}
                initialUrl={pendingFeed ?? undefined}
                idPrefix="ob-calendar"
                initialProvider={
                  draft.role === "student" && !pendingFeed ? "brightspace" : undefined
                }
                onBusyChange={setSourceBusy}
                onAdded={sourceAdded}
              />
            </Disclosure>
            {draft.role === "student" && (
              <div className="mt-5 border-t border-line pt-4">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Button className="shrink-0" variant="secondary" disabled={syncing || sourceBusy} onClick={() => void sync()}>{syncing ? "Checking coursework…" : "Check coursework again"}</Button>
                <p role="status" className="m-0 text-sm leading-relaxed text-body">
                  {courseworkReady(boiler) && reviewReceipt
                    ? `Coursework verified: ${courseworkSources(boiler).map((s) => s.label).join(", ")}. Review its deadlines next.`
                    : "Connect a readable school calendar with Coursework enabled to import your courses. Google Calendar alone does not confirm a course import."}
                </p>
                </div>
                {courseworkSources(boiler).filter((s) => s.status !== "ok").map((s) => <p key={s.id} className="text-sm text-redline-ink">{s.label}: {s.error || "This feed could not be read. Check the link and try again."}</p>)}
              </div>
            )}
          </>
        );
        break;
      case "reading":
        content = (
          <>
            {syncing && <FlameLoader label="Reading your week…" />}
            {syncError && (
              <div role="alert">
                <p className="text-redline-ink">{syncError}</p>
                <Button onClick={() => void sync()}>Try calendar again</Button>
              </div>
            )}
            {boiler && (
              <div>
                <div className="flex items-center gap-5">
                  <Boiler
                    score={boiler.result.score}
                    zone={boiler.result.zone}
                    size="sm"
                    width={72}
                  />
                  <div className="flex flex-col gap-3">
                    <ZoneBadge zone={boiler.result.zone} />
                    <CountBadges counts={boiler.result.counts} />
                  </div>
                </div>
                <div className="mt-4">
                  {showPip && (<FirstReadingPip
                    score={boiler.result.score}
                    zone={boiler.result.zone}
                  />)}
                </div>
              </div>
            )}
          </>
        );
        break;
      case "milestone":
        content = (
          <>
            <p className={styles.intro}>
              {draft.role === "student"
                ? "An assignment, exam or project—choose one thing to put on your radar."
                : "Choose one deadline or project to start with."}{" "}
              We’ll add it to your tasks.
            </p>
            <label htmlFor="milestone" className={styles.label}>
              Your first task
            </label>
            <input
              id="milestone"
              maxLength={200}
              value={draft.milestone}
              onChange={(e) => patch({ milestone: e.target.value })}
              className={field}
              placeholder={
                draft.role === "student"
                  ? "e.g. Finish my biology lab report"
                  : "e.g. Send the project proposal"
              }
            />
          </>
        );
        break;
      case "deadline":
        content = (
          <>
            <p className={styles.intro}>
              {draft.milestone
                ? `Give “${draft.milestone}” a little breathing room.`
                : "You can choose a date now, or add one when you have a task."}{" "}
              Leave this blank if you’re not sure yet.
            </p>
            <label htmlFor="deadline" className={styles.label}>
              Target date (optional)
            </label>
            <input
              id="deadline"
              type="date"
              value={draft.deadline}
              onChange={(e) => patch({ deadline: e.target.value })}
              onInput={(e) => patch({ deadline: e.currentTarget.value })}
              className={field}
            />
          </>
        );
        break;
      case "status":
        content = (
          <>
            <StatusPicker
              status={draft.status}
              note={draft.note}
              labelledBy="onboarding-title-status"
              savedLabel="Ready to save"
              onChange={(status, note) => patch({ status, note })}
              onNoteChange={(note) => patch({ note })}
            />
          </>
        );
        break;
      case "team":
        content = (
          <>
            <p className={styles.intro}>
              {goal === "team"
                ? "Join an existing team here, or create your own from Teams after setup."
                : "If a teacher or lead gave you a code, enter it here. Going solo is fine too."}{" "}
              You join as <strong>Hidden</strong> until you choose to share.
            </p>
            {draft.joinedTeam ? (
              <div className={styles.connection}>
                <Check />
                <span>
                  Team joined{joined ? ` · ${joined}` : ""}. Your boiler is
                  hidden.
                </span>
              </div>
            ) : (
              <>
                <label htmlFor="invite-code" className={styles.label}>
                  Invite code (optional)
                </label>
                <input
                  id="invite-code"
                  autoComplete="off"
                  maxLength={6}
                  value={draft.inviteCode}
                  onChange={(e) =>
                    patch({
                      inviteCode: e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, ""),
                    })
                  }
                  className={`${field} font-mono tracking-[0.2em]`}
                  placeholder="ABC123"
                />
              </>
            )}
          </>
        );
        break;
      case "recommendation":
        content = (
          <>
            <div className="mb-6 flex items-center gap-4">
              {showPip && <Mascot size={96} score={boiler?.result.score ?? 20} reaction="wave" />}
              <p className="m-0 leading-relaxed text-body">{plan.body}</p>
            </div>
            {needsManualTask(draft) && !draft.finished && (
              <div className="flex flex-col gap-5">
                <div>
                  <label htmlFor="first-task" className={styles.label}>Your first task</label>
                  <input id="first-task" required maxLength={200} value={draft.milestone}
                    onChange={(e) => patch({ milestone: e.target.value })}
                    className={field} placeholder="e.g. Finish my project outline" />
                </div>
                <div>
                  <label htmlFor="first-task-due" className={styles.label}>Due date (optional)</label>
                  <input id="first-task-due" type="date" value={draft.deadline}
                    onChange={(e) => patch({ deadline: e.target.value })}
                    onInput={(e) => patch({ deadline: e.currentTarget.value })}
                    className={field} />
                </div>
              </div>
            )}
            {!draft.finished && (!draft.extensionDeferred || draft.role === "student") && (
              <div className="mt-5" aria-label="Setup checks">
                {!draft.extensionDeferred && <>
                  <p className="mt-0 text-sm">{pip.state === "installed" ? "Pip connected" : "Pip connection needs checking"}</p>
                  <Button variant="ghost" onClick={() => navigate("extension")}>Check Pip</Button>
                </>}
                {draft.role === "student" && (draft.courseworkDeferred ? <>
                <p className="text-sm">Coursework setup saved for later</p>
                <Button variant="ghost" onClick={() => navigate("calendar")}>Connect coursework</Button>
                </> : <>
                <p className="text-sm">{courseworkReady(boiler) && reviewReceipt ? "Coursework import verified" : "Coursework import needs checking"}</p>
                <Button variant="ghost" onClick={() => navigate("calendar")}>Check coursework</Button>
                <p className="text-sm">{reviewed && reviewReceipt ? "Deadlines reviewed" : "Deadline review still needed"}</p>
                <Button variant="ghost" onClick={() => navigate("review")}>Review deadlines</Button>
                </>)}
              </div>
            )}
            {draft.milestone && (goal === "deadlines" || draft.extensionDeferred) &&
              (!draft.extensionDeferred || draft.finished) && (
              <p className="mt-4 mb-0 text-sm text-brass-ink">
                First task: {draft.milestone}
                {draft.deadline
                  ? ` · ${new Date(`${draft.deadline}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                  : " · no deadline yet"}
              </p>
            )}
          </>
        );
        break;
    }
    return content;
  }
  return (
    <div className={styles.shell} data-onboarding>
      <header className={styles.header}>
        <Logo />
        <Button variant="ghost" disabled={!loaded || loadFailed || busy || sourceBusy} onClick={() => void finishLater()}>
          Finish later
        </Button>
      </header>
      <main className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className="hidden lg:block">
            {showPip && (<Mascot size={92} score={20} reaction="wave" />)}
            <h2 className="mt-5 mb-3 font-display text-[40px] leading-none font-normal">
              Make room
              <br />
              for your week.
            </h2>
          </div>
        </aside>
        <div className={styles.journey}>
          <div className={styles.progress}>
            <div
              role="progressbar"
              aria-label="Onboarding progress"
              aria-valuenow={index + 1}
              aria-valuemin={1}
              aria-valuemax={steps.length}
              className={styles.progressTrack}
            >
              <span
                style={{ width: `${((index + 1) / steps.length) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-3 text-[11px] text-muted">
              <strong className="font-bold tabular-nums">
                {loaded ? `${index + 1} of ${steps.length}` : "Preparing your setup…"}
              </strong>
              {signedIn && SAVE_LABELS[saveState] && <span role="status">{SAVE_LABELS[saveState]}</span>}
            </div>
          </div>
          {!loaded || loadFailed ? (
            <div className={styles.loading}>
              {loadFailed ? <p role="alert">{error}</p> : <FlameLoader label="Getting your setup ready…" />}
              {loadFailed && (
                <Button onClick={() => void load()}>Try loading again</Button>
              )}
            </div>
          ) : (
            <>
              <div
                ref={viewport}
                className={styles.viewport}
              >
                <section
                  key={step}
                  className={styles.step}
                  aria-label={titleFor(step)}
                >
                  <div className={styles.stepContent}>
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <h1
                        ref={heading}
                        tabIndex={-1}
                        id={`onboarding-title-${step}`}
                        className={styles.title}
                      >
                        {titleFor(step)}
                      </h1>
                      {!["reassurance", "recommendation"].includes(step) && (
                        <div className="hidden shrink-0 sm:block">
                          {showPip && (<Mascot
                            size={64}
                            score={20}
                            reaction={step === "identity" ? "wave" : "idle"}
                          />)}
                        </div>
                      )}
                    </div>
                    <div
                      onKeyDown={(e) => {
                        const target = e.target as HTMLElement;
                        if (
                          e.key === "Enter" &&
                          target.tagName === "INPUT" &&
                          [
                            "name",
                            "milestone",
                            "deadline",
                            "team",
                          ].includes(step)
                        ) {
                          e.preventDefault();
                          void advance();
                        }
                      }}
                    >
                      <fieldset disabled={busy || sourceBusy} className="m-0 min-w-0 border-0 p-0">
                        <div className={styles.body}>{renderContent(step)}</div>
                      </fieldset>
                    </div>
                  </div>
                </section>
              </div>
              <div className={styles.controls}>
                {saveState === "error" && (
                  <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 text-sm text-redline-ink">
                    <span>Your latest answers haven’t saved to your account yet.</span>
                    <Button variant="ghost" disabled={busy || sourceBusy} onClick={retrySave}>Retry saving</Button>
                  </div>
                )}
                {error && (
                  <p
                    role="alert"
                    className="mt-0 mb-4 text-sm leading-relaxed text-redline-ink"
                  >
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button
                    variant="ghost"
                    disabled={index === 0 || busy || sourceBusy}
                    onClick={() => navigate(steps[index - 1])}
                  >
                    <Arrow direction="back" />
                    Back
                  </Button>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {canSkip && (
                      <Button
                        variant="ghost"
                        disabled={busy || sourceBusy}
                        onClick={() => void advance(true)}
                      >
                        Skip for now
                      </Button>
                    )}
                    {!(step === "account" && !signedIn) && (
                      <Button
                        variant="primary"
                        disabled={(!valid && !canDeferSetup) || busy || sourceBusy}
                        onClick={() => canDeferSetup ? skipDialog.current?.showModal() : void advance()}
                      >
                        {busy
                          ? "Saving…"
                          : canDeferSetup
                            ? "Skip"
                          : step === "recommendation"
                              ? draft.finished ? plan.action : "Finish setup"
                              : step === "team" &&
                                  draft.inviteCode &&
                                  !draft.joinedTeam
                                ? "Join and continue"
                                : "Continue"}
                        <Arrow />
                      </Button>
                    )}
                  </div>
                </div>
                <nav
                  aria-label="Revisit an unlocked question"
                  className={styles.stepNav}
                >
                  {steps.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      className={styles.stepDot}
                      aria-label={`Step ${i + 1}: ${titleFor(s)}`}
                      aria-current={s === step ? "step" : undefined}
                      disabled={i > unlocked || busy || sourceBusy}
                      onClick={() => navigate(s)}
                    >
                      <span />
                    </button>
                  ))}
                </nav>
              </div>
            </>
          )}
        </div>
        <dialog ref={skipDialog} className={styles.skipDialog} aria-labelledby="pip-later-title" aria-describedby="pip-later-description">
          <h2 id="pip-later-title" className="mt-0 mb-3 font-display text-[32px] font-normal">{step === "extension" ? "Complete Pip setup later?" : step === "review" ? "Review deadlines later?" : "Connect coursework later?"}</h2>
          <p id="pip-later-description" className="mt-0 mb-6 text-sm leading-relaxed text-body">{step === "extension" ? "You can install Pip anytime in Connect. Would you like to continue and complete it later?" : "You can connect your school calendar in Connect and review its deadlines later. Would you like to continue without completing coursework setup?"}</p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" autoFocus onClick={() => skipDialog.current?.close()}>Go back</Button>
            <Button variant="primary" onClick={() => { skipDialog.current?.close(); void advance(true); }}>Complete later</Button>
          </div>
        </dialog>
      </main>
    </div>
  );
}
function Choices({
  label,
  options,
  value,
  onChange,
  showDetails = true,
}: {
  label: string;
  options: { value: string; label: string; detail: string }[];
  value: string;
  onChange: (value: string) => void;
  showDetails?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={`${styles.choices} ${showDetails ? "" : styles.compact}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={`${styles.choice} ${value === option.value ? styles.selected : ""}`}
          onClick={() => onChange(option.value)}
        >
          <span>
            <strong>{option.label}</strong>
            {showDetails && <span>{option.detail}</span>}
          </span>
          <span className={styles.radio} aria-hidden="true">
            {value === option.value && <Check />}
          </span>
        </button>
      ))}
    </div>
  );
}
function Check() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}
function Arrow({ direction }: { direction?: "back" }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={direction === "back" ? { transform: "rotate(180deg)" } : undefined}
    >
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M20 12h-8m8 0a8 8 0 1 1-2.4-5.7M20 12v5" />
    </svg>
  );
}
