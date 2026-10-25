"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FlameLoader } from "@/components/ui/FlameLoader";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/SiteHeader";
import { Mascot } from "@/components/mascot/Mascot";
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
import { readDraftBackup, rememberDraftBackup } from "./draft-backup";
import { DeadlineReview } from "./DeadlineReview";
import { courseworkReady, courseworkSources, type SetupCheck } from "./setup";
import {
  DRAFT_KEY,
  goalOptions,
  isStepValid,
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
  calendar: "Bring your week into view.",
  milestone: "What’s one thing you want to finish?",
  deadline: "When would you like to finish it?",
  status: "How are you showing up today?",
  sources: "Anything else on your plate?",
  team: "Have a team invite?",
  recommendation: "A starting point, just for you.",
  ready: "Your boiler is ready.",
};
const PHASE: Record<StepId, number> = {
  identity: 0,
  name: 0,
  goal: 0,
  starting: 0,
  reassurance: 0,
  account: 1,
  extension: 2,
  review: 2,
  calendar: 2,
  milestone: 2,
  deadline: 2,
  status: 2,
  sources: 2,
  team: 2,
  recommendation: 3,
  ready: 3,
};
const OPTIONAL: StepId[] = [
  "calendar",
  "milestone",
  "deadline",
  "sources",
  "team",
];
const field =
  "bp-field min-h-14 w-full rounded-[10px] border border-control bg-field px-4 text-lg text-fg placeholder:text-muted";
const SAVE_LABELS = { idle: "Autosave on", saving: "Saving answers…", saved: "All changes saved", error: "Answers not saved yet" };
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
  const sections = useRef<Partial<Record<StepId, HTMLElement>>>({});
  const navigationLock = useRef(false);
  const userScrollAt = useRef(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const persist = useCallback((next: OnboardingDraft) => {
    track(next);
    setDraft(next);
    rememberDraftBackup(next);
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {
      /* Keep the active in-memory journey. Sign-in checks storage separately. */
    }
  }, [track]);
  const load = useCallback(async () => {
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
        (s) => s !== "recommendation" && s !== "ready",
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
      (step === "calendar" || step === "review" || step === "recommendation") &&
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
    navigationLock.current = true;
    userScrollAt.current = 0;
    const el = viewport.current;
    el?.scrollTo({
      top: index * el.clientHeight,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    const timer = setTimeout(() => {
      const currentViewport = viewport.current;
      currentViewport?.scrollTo({ top: index * currentViewport.clientHeight, behavior: "instant" });
      navigationLock.current = false;
      heading.current?.focus({ preventScroll: true });
    }, 420);
    let height = el?.clientHeight;
    const resize = new ResizeObserver(() => {
      if (el && el.clientHeight !== height) {
        height = el.clientHeight;
        el.scrollTo({ top: index * height, behavior: "instant" });
      }
    });
    if (el) resize.observe(el);
    return () => { clearTimeout(timer); resize.disconnect(); };
  }, [loaded, loadFailed, step, index]);
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
  const setupReady = pip.state === "installed" &&
    (draft.role !== "student" || (courseworkReady(boiler) && !!reviewReceipt && reviewed));
  const valid =
    isStepValid(step, draft, signedIn) &&
    (step !== "extension" || pip.state === "installed") &&
    (step !== "calendar" || draft.role !== "student" || (courseworkReady(boiler) && !!reviewReceipt)) &&
    (step !== "review" || (!!reviewReceipt && reviewed)) &&
    (step !== "recommendation" || setupReady) &&
    // Opening the app after saved completion does not submit setup again.
    // Review receipts intentionally stay in memory and disappear on reload.
    (step !== "ready" || draft.finished);
  const canSkip = OPTIONAL.includes(step) && !(draft.role === "student" && step === "calendar");
  async function finishLater() {
    if (!loaded || loadFailed || busy || sourceBusy) return;
    setBusy(true); setError("");
    const next = { ...draft, finished: false };
    try {
      if (signedIn) await save(next);
      persist(next);
      location.assign(signedIn ? "/boiler" : "/");
    } catch { setError("Your progress could not be saved. Try Finish later again before leaving."); }
    finally { setBusy(false); }
  }
  async function advance(skip = false) {
    if (
      busy ||
      sourceBusy ||
      (skip && !canSkip) ||
      (!skip && !valid)
    )
      return;
    if (step === "ready") {
      if (!draft.finished) return;
      location.assign(plan.href);
      return;
    }
    let next = {
      ...draft,
      completed: [...new Set([...draft.completed, step])],
      finished: false,
    };
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
      next.current =
        nextSteps[Math.min(nextSteps.indexOf(step) + 1, nextSteps.length - 1)];
      if (step === "recommendation")
        next = {
          ...next,
          finished: true,
          completed: [...new Set([...next.completed, "ready" as const])],
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
  function renderContent(currentStep: StepId): ReactNode {
    let content: ReactNode;
    switch (currentStep) {
      case "identity":
        content = (
          <>
            <p className={styles.intro}>
              A few small questions. A clearer picture of your week.
            </p>
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
                  value: "helping",
                  label: "I’m helping someone get started",
                  detail: "Set things up together, using their account.",
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
              {draft.role === "helping"
                ? "Use the name of the person whose boiler this will be. They should sign in with their own Google account."
                : "First name, nickname—whatever feels like you."}
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
              placeholder="e.g. Alex"
            />
          </>
        );
        break;
      case "goal":
        content = (
          <>
            <p className={styles.intro}>
              Nice to meet you, {draft.name.trim()}. Let’s give your boiler a
              purpose.
            </p>
            <Choices
              label={TITLES.goal}
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
            <p className={styles.intro}>
              We’ll meet you where you are, {draft.name.trim()}.
            </p>
            <Choices
              label={TITLES.starting}
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
            <p className={styles.intro}>
              {draft.name.trim()},{" "}
              {draft.starting === "overwhelmed"
                ? "we’ll start small, with the work already in front of you."
                : "we’ll bring your week into one place, one connection at a time."}{" "}
              {goal === "team"
                ? "You can check team capacity before adding work."
                : goal === "focus"
                  ? "Pip can help you choose a task and protect a little time to work on it."
                  : "Your forecast can help you spot a heavy week before it arrives."}
            </p>
            <OnboardingPip />
          </>
        );
        break;
      case "account":
        content = (
          <>
            <p className={styles.intro}>
              Your answers come with you. Google creates your account or signs
              you in, and connects your calendar with read-only access.
            </p>
            {signedIn ? (
              <div className={styles.connection} role="status">
                <Check />
                <div>
                  <strong>Signed in as {accountName}</strong>
                  <p className="mt-1 mb-0 text-sm text-muted">
                    Your answers save automatically to this account.
                  </p>
                </div>
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
                <p className="mt-4 mb-0 text-sm leading-relaxed text-muted">
                  Already have an account? The same button signs you in.{" "}
                  {draft.role === "helping"
                    ? "Ask the person you’re helping to sign in with their own account."
                    : "You choose what your team can see."}
                </p>
              </>
            )}
            <p className="mt-6 mb-0 border-t border-line pt-5 text-sm leading-relaxed text-muted">
              Calendar titles and dates are fetched live. Teams never see your
              calendar details. You can disconnect in Connect.
            </p>
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
            <ExtensionStep extension={pip} />
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
                : "Google Calendar connects when you sign in. Add Apple Calendar or another subscription here if your work lives elsewhere."}
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
              <div className={styles.connection}>
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
            <details
              open={pendingFeed ? true : undefined}
              className="mt-5 border-t border-line pt-2"
            >
              <summary className="bp-summary flex min-h-11 cursor-pointer items-center font-semibold text-brass-ink">
                {draft.role === "student"
                  ? "Add my school calendar"
                  : "Add Apple Calendar or another feed"}
              </summary>
              <div className="py-4">
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
              </div>
            </details>
            {draft.role === "student" && (
              <div className="mt-5 border-t border-line pt-4">
                <p role="status" className="text-sm text-body">
                  {courseworkReady(boiler) && reviewReceipt
                    ? `Coursework verified: ${courseworkSources(boiler).map((s) => s.label).join(", ")}. Review its deadlines next.`
                    : "Connect a readable school calendar with Coursework enabled to continue. Google Calendar alone does not confirm a course import."}
                </p>
                {courseworkSources(boiler).filter((s) => s.status !== "ok").map((s) => <p key={s.id} className="text-sm text-redline-ink">{s.label}: {s.error || "This feed could not be read. Check the link and try again."}</p>)}
                <Button variant="secondary" disabled={syncing || sourceBusy} onClick={() => void sync()}>{syncing ? "Checking coursework…" : "Check coursework again"}</Button>
              </div>
            )}
            {boiler && (
              <div className="mt-6 border-t border-line pt-5">
                <p className="mt-0 mb-4 font-semibold">Your first reading</p>
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
                  <FirstReadingPip
                    score={boiler.result.score}
                    zone={boiler.result.zone}
                  />
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
            <p className={styles.intro}>
              Your status is your say. It never changes your pressure score, and
              you control who sees it in each team.
            </p>
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
      case "sources":
        content = (
          <>
            <p className={styles.intro}>
              Connect coursework or Apple Calendar to bring more of your
              work together. You can always add these later in Connect.
            </p>
            {boiler?.sources?.length ? (
              <p className="text-cool-ink">
                Connected: {boiler.sources.map((s) => s.label).join(", ")}.
              </p>
            ) : null}
            <CalendarFeedForm
              idPrefix="ob-feed"
              onAdded={sourceAdded}
              onBusyChange={setSourceBusy}
            />
            <p className="mt-5 mb-0 text-sm text-muted">
              Titles and dates are fetched live. Private subscription links are stored encrypted.
            </p>
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
                <p className="mt-2 mb-0 text-sm text-muted">
                  Use the six letters and numbers from your invite.
                </p>
              </>
            )}
          </>
        );
        break;
      case "recommendation":
        content = (
          <>
            <p className={styles.intro}>
              {draft.goal === "recommend"
                ? `Based on your answers, ${draft.name.trim()}, Pip recommends this.`
                : `Here’s where we’ll begin, ${draft.name.trim()}.`}
            </p>
            <div className="mb-5 border-y border-line py-4" aria-label="Setup checks">
              <p className="mt-0 text-sm">{pip.state === "installed" ? "Pip connected" : "Pip connection needs checking"}</p>
              <Button variant="ghost" onClick={() => navigate("extension")}>Check Pip</Button>
              {draft.role === "student" && <>
                <p className="text-sm">{courseworkReady(boiler) && reviewReceipt ? "Coursework import verified" : "Coursework import needs checking"}</p>
                <Button variant="ghost" onClick={() => navigate("calendar")}>Check coursework</Button>
                <p className="text-sm">{reviewed && reviewReceipt ? "Deadlines reviewed" : "Deadline review still needed"}</p>
                <Button variant="ghost" onClick={() => navigate("review")}>Review deadlines</Button>
              </>}
            </div>
            <div className="border-y border-line py-6">
              <h2 className="mt-0 mb-3 font-display text-[32px] font-normal">
                {plan.title}
              </h2>
              <p className="m-0 leading-relaxed text-body">{plan.body}</p>
              {draft.milestone && goal === "deadlines" && (
                <p className="mt-4 mb-0 text-sm text-brass-ink">
                  First task: {draft.milestone}
                  {draft.deadline
                    ? ` · ${new Date(`${draft.deadline}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                    : " · no deadline yet"}
                </p>
              )}
            </div>
            <p className="mt-5 mb-0 text-sm text-muted">
              You can change your setup later. Your team visibility starts
              hidden.
            </p>
          </>
        );
        break;
      case "ready":
        content = (
          <>
            <div className="mb-5 flex items-center gap-4">
              <Mascot
                size={96}
                score={boiler?.result.score ?? 20}
                reaction="wave"
              />
              <div>
                <h2 className="mt-0 mb-2 font-display text-[32px] font-normal">
                  All set, {draft.name.trim()}.
                </h2>
                <p className="m-0 leading-relaxed text-body">
                  {goal === "team"
                    ? "Your next step is waiting in Teams."
                    : "Your calendar, status and starting point are ready in My Boiler."}
                </p>
              </div>
            </div>
            <p className="m-0 border-t border-line pt-5 text-sm text-muted">
              Pip measures your workload. You’re always the judge of how you
              feel.
            </p>
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
        <aside className={styles.sidebar} aria-label="Onboarding progress">
          <div className="hidden lg:block">
            <Mascot size={92} score={20} reaction="wave" />
            <h2 className="mt-5 mb-3 font-display text-[40px] leading-none font-normal">
              Make room
              <br />
              for your week.
            </h2>
            <p className="m-0 max-w-[24ch] text-sm leading-relaxed text-muted">
              A little context helps Pip build a boiler that works for you.
            </p>
          </div>
          <ol className={styles.phases}>
            {["About you", "Your account", "Your setup", "Ready to go"].map(
              (phase, i) => (
                <li
                  key={phase}
                  className={PHASE[step] >= i ? styles.phaseActive : ""}
                  aria-current={PHASE[step] === i ? "step" : undefined}
                >
                  <span className={styles.phaseDot}>
                    {PHASE[step] > i ? <Check /> : i + 1}
                  </span>
                  <span>{phase}</span>
                </li>
              ),
            )}
          </ol>
          <p className="hidden text-xs leading-relaxed text-muted lg:block">
            Your calendar stays private.
            <br />
            Sharing is always your choice.
          </p>
        </aside>
        <div className={styles.journey}>
          <div className={styles.progress}>
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <span>
                {loaded
                  ? `Step ${index + 1} of ${steps.length}`
                  : "Preparing your setup…"}
              </span>
              <span role={signedIn ? "status" : undefined}>
                {signedIn
                  ? SAVE_LABELS[saveState]
                  : "Your progress stays with you"}
              </span>
            </div>
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
                onWheel={() => { userScrollAt.current = performance.now(); }}
                onScroll={() => {
                  if (navigationLock.current || busy || sourceBusy || performance.now() - userScrollAt.current > 800) return;
                  const el = viewport.current;
                  if (!el) return;
                  const target = Math.round(el.scrollTop / el.clientHeight);
                  if (target !== index && target <= unlocked && steps[target])
                    navigate(steps[target]);
                }}
                onTouchStart={(e) => {
                  userScrollAt.current = performance.now();
                  touch.current = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY,
                  };
                }}
                onTouchEnd={(e) => {
                  const start = touch.current;
                  touch.current = null;
                  if (!start) return;
                  const dx = e.changedTouches[0].clientX - start.x,
                    dy = e.changedTouches[0].clientY - start.y;
                  const el = e.target as HTMLElement;
                  if (
                    Math.abs(dy) < 90 ||
                    Math.abs(dy) < Math.abs(dx) ||
                    el.closest("input,textarea,select,button,summary,a")
                  )
                    return;
                  const panel = sections.current[step];
                  if (panel && panel.scrollHeight > panel.clientHeight + 4)
                    return;
                  const target = steps[index + (dy < 0 ? 1 : -1)];
                  if (target) navigate(target);
                }}
              >
                {steps.slice(0, unlocked + 1).map((s) => (
                  <section
                    key={s}
                    ref={(el) => {
                      if (el) sections.current[s] = el;
                    }}
                    className={styles.step}
                    aria-label={s === step ? undefined : TITLES[s]}
                    aria-hidden={s !== step}
                    inert={s !== step}
                  >
                    {
                      <div className={styles.stepContent}>
                        <div className="mb-6 flex items-start justify-between gap-4">
                          <h1
                            ref={s === step ? heading : undefined}
                            tabIndex={-1}
                            id={`onboarding-title-${s}`}
                            className={styles.title}
                          >
                            {TITLES[s]}
                          </h1>
                          {!["reassurance", "ready"].includes(s) && (
                            <div className="hidden shrink-0 sm:block">
                              <Mascot
                                size={64}
                                score={20}
                                reaction={s === "identity" ? "wave" : "idle"}
                              />
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
                              ].includes(s)
                            ) {
                              e.preventDefault();
                              void advance();
                            }
                          }}
                        >
                          <fieldset disabled={busy || sourceBusy} className="m-0 min-w-0 border-0 p-0">
                            <div className={styles.body}>{renderContent(s)}</div>
                          </fieldset>
                        </div>
                      </div>
                    }
                  </section>
                ))}
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
                        disabled={!valid || busy || sourceBusy}
                        onClick={() => void advance()}
                      >
                        {busy
                          ? "Saving…"
                          : step === "ready"
                            ? plan.action
                            : step === "recommendation"
                              ? "Finish setup"
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
                      aria-label={`Step ${i + 1}: ${TITLES[s]}`}
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
      </main>
    </div>
  );
}
function Choices({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string; detail: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className={styles.choices}>
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
            <span>{option.detail}</span>
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
