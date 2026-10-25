"use client";

import { Disclosure } from "@/components/ui/Disclosure";
import { useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { FlameLoader } from "@/components/ui/FlameLoader";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import {
  FOCUS_DOMAINS,
  nextStudyOpening,
  parseStudyContext,
} from "@/lib/pip/study";
import type { MyBoiler } from "./useMyBoiler";
import type { StudyAccountability as Study } from "./useStudyAccountability";

const remaining = (value: number) => {
  const seconds = Math.max(0, Math.ceil(value / 1000));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
};
const at = (value: number) =>
  new Date(value).toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export function StudyAccountability({
  boiler,
  study,
  onAsk,
}: {
  boiler: MyBoiler;
  study: Study;
  onAsk: (question: string) => void;
}) {
  const id = useId();
  const [selected, setSelected] = useState("");
  const [minutes, setMinutes] = useState(25);
  const [goal, setGoal] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const tasks =
    boiler.data?.items.filter(
      (task) =>
        task.kind === "task" &&
        !task.doneAt &&
        !boiler.data?.taskMeta?.[task.id]?.completedInSource,
    ) ?? [];
  const task = tasks.find((item) => item.id === selected) ?? tasks[0];
  const { session, phase, blocker } = study;
  const open = session && phase && !["completed", "cancelled"].includes(phase);
  const ask = (question: string) => {
    if (boiler.source === "fixture") {
      setError(
        "Sign in to ask Pip for a live Gemini answer. The demo focus timer and extension work without sign-in.",
      );
      return;
    }
    onAsk(question);
  };
  const start = (mode: "now" | "opening" | "demo") => {
    if (!task) return;
    const now = Date.now();
    if (blocker.session && blocker.session.scope !== study.scope && !blocker.session.outcome && blocker.session.endAt > now) {
      setError("End your current commitment in its Boilerplate page before starting this demo.");
      return;
    }
    const duration = mode === "demo" ? 1 : minutes;
    const startAt =
      mode === "demo"
        ? now + 10000
        : mode === "opening"
          ? nextStudyOpening(boiler.data?.items ?? [], now, duration)
          : now;
    setError("");
    setConfirmed(false);
    study.send({
      id: crypto.randomUUID(),
      taskId: task.id,
      title: task.title.slice(0, 200),
      goal: goal.trim() || `Make a start on ${task.title}`.slice(0, 240),
      startAt,
      endAt: startAt + duration * 60000,
      demo: mode === "demo",
      scope: study.scope,
    });
  };
  const finish = async () => {
    if (!session || !confirmed || busy) return;
    if (!boiler.data?.items.some((item) => item.id === session.taskId)) {
      setError(
        "That task is no longer in your list. End focus, then choose another task.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const done = await boiler.setTaskDone(session.taskId, true);
      if (done === false) {
        setError(
          "The assignment could not be marked done. Your focus session is still available; try again or end focus.",
        );
        return;
      }
      study.send({ ...session, outcome: "completed" });
    } catch {
      setError(
        "Could not save completion. Try again, or end focus without marking it done.",
      );
    } finally {
      setBusy(false);
    }
  };
  const addSource = (event: FormEvent) => {
    event.preventDefault();
    const sources = [
      ...study.sources,
      { id: crypto.randomUUID(), title, text },
    ];
    const parsed = parseStudyContext({ sources });
    if (!parsed) {
      setError(
        "Use up to three documents, 6,000 characters each and 12,000 combined. Give each a title and at least 20 characters of text.",
      );
      return;
    }
    study.setSources(parsed.sources);
    setTitle("");
    setText("");
    setError("");
  };
  return (
    <Card id="study-accountability"
      as="section"
      aria-labelledby={`${id}-heading`}
      className="px-4 py-5 sm:px-7 sm:py-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <CardTitle id={`${id}-heading`}>Focus with Pip</CardTitle>
        <span
          className={`text-xs ${blocker.connected ? "text-[#5b8f63]" : "text-muted"}`}
        >
          {blocker.connected
            ? "Extension connected!"
            : "Focus extension not connected"}
        </span>
      </div>
      {!boiler.data ? (
        boiler.error ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-hot-ink">
          <span>{boiler.error}</span>
          <Button disabled={boiler.syncing} onClick={() => void boiler.refresh()}>Try again</Button>
        </div> : <FlameLoader label="Loading your focus tasks…" />
      ) : open ? (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p role="status" className="m-0 text-lg font-semibold text-fg">
              {phase === "scheduled"
                ? "You made a promise. Pip will meet you there."
                : phase === "active"
                  ? "Time to come back. One small step."
                  : "Time’s up. What did you finish?"}
            </p>
            <p className="mt-2 mb-0 text-sm text-body">{session.title}</p>
            <p className="mt-1 mb-0 text-sm text-muted">{session.goal}</p>
            <p className="mt-3 mb-0 text-xs text-muted">
              {phase === "scheduled"
                ? `Starts ${at(session.startAt)}`
                : blocker.connected &&
                    blocker.enforced &&
                    blocker.session?.id === session.id
                  ? "Five distracting websites are paused in this browser."
                  : phase === "active"
                    ? "Timer running. Website blocking is not confirmed; connect the focus extension."
                    : "Your distracting websites are available again. A timer ending does not complete the assignment."}
              {session.demo && " This is a one-minute demo."}
            </p>
          </div>
          <div
            className="font-mono text-[40px] leading-none tabular-nums text-brass-ink"
            aria-label={
              phase === "scheduled"
                ? "Time until focus"
                : "Focus time remaining"
            }
          >
            {remaining(
              (phase === "scheduled" ? session.startAt : session.endAt) -
                study.now,
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button
              onClick={() =>
                ask(
                  `Help me take the next small step on ${session.title}. My goal is: ${session.goal}. Use my course material if relevant.`,
                )
              }
            >
              Ask Pip for a first step
            </Button>
            {phase !== "scheduled" && (
              <>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-body">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="h-4 w-4 accent-brass"
                  />
                  I finished the whole assignment
                </label>
                <Button
                  disabled={!confirmed || busy}
                  onClick={() => void finish()}
                >
                  {busy ? "Saving…" : "Mark done & release"}
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={study.end}>
              End focus · emergency release
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-0 mb-4 text-sm leading-relaxed text-body">
            {phase === "completed"
              ? study.scope === "demo"
                ? "Demo commitment completed and focus released. Demo task changes reset when you reload."
                : "You followed through. Your task is marked done and the focus block is released."
              : phase === "cancelled"
                ? "Focus ended. Your sites are available again. You can make a new commitment when you’re ready."
                : "Knowing what’s due is one thing. Starting is another. Choose one task and protect a little time for it."}
          </p>
          {tasks.length ? (
            <>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
                <label
                  className="grid gap-2 text-sm text-body"
                  htmlFor={`${id}-task`}
                >
                  One task
                  <Select
                    id={`${id}-task`}
                    value={task?.id ?? ""}
                    onChange={(event) => setSelected(event.target.value)}
                  >
                    {tasks.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </Select>
                </label>
                <label
                  className="grid gap-2 text-sm text-body"
                  htmlFor={`${id}-minutes`}
                >
                  Focus time
                  <Select
                    id={`${id}-minutes`}
                    value={minutes}
                    onChange={(event) => setMinutes(Number(event.target.value))}
                  >
                    {[10, 25, 45].map((value) => (
                      <option key={value} value={value}>
                        {value} minutes
                      </option>
                    ))}
                  </Select>
                </label>
                <label
                  className="grid gap-2 text-sm text-body sm:col-span-2"
                  htmlFor={`${id}-goal`}
                >
                  Make it smaller
                  <input
                    id={`${id}-goal`}
                    value={goal}
                    onChange={(event) => setGoal(event.target.value)}
                    maxLength={240}
                    placeholder="e.g. Outline the first two questions"
                    className="bp-field min-h-11 min-w-0 rounded-lg border bg-field px-3 text-base text-fg"
                  />
                </label>
              </div>
              <p className="mt-3 mb-4 text-xs leading-relaxed text-muted">
                Starting or scheduling focus lets the installed extension pause{" "}
                {FOCUS_DOMAINS.join(", ")} for this commitment. You can end it
                any time. Other apps and devices remain accessible.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" onClick={() => start("now")}>
                  Start focus
                </Button>
                <Button onClick={() => start("opening")}>
                  Use my next free window
                </Button>
                <Button variant="ghost" onClick={() => start("demo")}>
                  10-second demo
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    ask(
                      `Help me make a short study plan for ${task?.title}. Break the work into process steps using only the requirements and deadlines in my course material, without giving solutions. I have ${minutes} minutes.`,
                    )
                  }
                >
                  Plan with Pip
                </Button>
              </div>
              <p className="mt-3 mb-0 text-xs leading-relaxed text-muted">
                The next opening is calculated from your loaded events;
                incomplete calendars can miss conflicts. This schedules a focus
                commitment, not a calendar event.
                {!blocker.connected &&
                  " Without the extension, keep this page open for the timer."}
              </p>
            </>
          ) : (
            <p className="m-0 text-sm text-muted">
              Add an assignment in <Link href="/boiler" className="underline underline-offset-4">My Boiler</Link>, then choose a time to focus on it.
            </p>
          )}
        </>
      )}
      <Disclosure className="mt-5" label={`Course material for Pip · ${study.sources.length} of 3 documents`}>
        <p className="mt-0 mb-3 text-xs leading-relaxed text-muted">
          Paste a syllabus or assignment, or choose a .txt/.md file. Material
          stays in memory for this page and clears on reload; when you send a
          message, it goes to Gemini with your question. Only use material you
          want to share with Google.
        </p>
        {study.sources.map((source) => (
          <Disclosure key={source.id} className="mb-3" label={source.title}>
            <p className="mt-0 mb-3 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere text-body">
              {source.text}
            </p>
            <Button
              variant="ghost"
              onClick={() =>
                study.setSources(
                  study.sources.filter((item) => item.id !== source.id),
                )
              }
            >
              Remove document
            </Button>
          </Disclosure>
        ))}
        <form onSubmit={addSource} className="grid gap-3">
          <label
            htmlFor={`${id}-title`}
            className="grid gap-2 text-sm text-body"
          >
            Document title
            <input
              id={`${id}-title`}
              required
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="bp-field min-h-11 rounded-lg border bg-field px-3 text-base text-fg"
            />
          </label>
          <label
            htmlFor={`${id}-text`}
            className="grid gap-2 text-sm text-body"
          >
            Course text
            <textarea
              id={`${id}-text`}
              required
              minLength={20}
              maxLength={6000}
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Paste syllabus or assignment text…"
              className="bp-field min-w-0 rounded-lg border bg-field p-3 text-base text-fg"
            />
          </label>
          <input
            ref={upload}
            type="file"
            className="sr-only"
            accept=".txt,.md"
            aria-label="Upload course text"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (!/\.(txt|md)$/i.test(file.name) || file.size > 12000) {
                setError(
                  "Choose a small .txt or .md file. For a PDF, copy and paste its text.",
                );
                return;
              }
              try {
                const value = await file.text();
                if (value.length > 6000) throw new Error();
                setTitle(file.name.slice(0, 120));
                setText(value);
              } catch {
                setError(
                  "Could not read that file, or it exceeds 6,000 characters. Paste a shorter excerpt instead.",
                );
              }
              event.target.value = "";
            }}
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => upload.current?.click()}>
              Choose text file
            </Button>
            <Button type="submit" disabled={study.sources.length >= 3}>
              Add course material
            </Button>
          </div>
        </form>
      </Disclosure>
      {study.sources.length > 0 && (
        <Button
          className="mt-4"
          onClick={() =>
            ask(
              "What requirements and deadlines are in the material I added? Help me plan the work without giving solutions. Cite the relevant instructions.",
            )
          }
        >
          Ask Pip about my course material
        </Button>
      )}
      <Disclosure className="mt-4" label="Connect the focus extension">
        <p className="mt-0 mb-3 text-sm leading-relaxed text-muted">
          Download and unzip the extension. In Chrome’s Extensions page, turn on
          Developer mode, choose Load unpacked, and select the unzipped folder.
          Then reload Connect. The extension runs locally; it does not send
          browsing history to Gemini.
        </p>
        <div className="flex flex-wrap gap-3">
          <LinkButton
            plain
            href="/downloads/boilerplate-focus-extension.zip"
            download
          >
            Download focus extension
          </LinkButton>
          <Button
            disabled={!blocker.connected || !blocker.remindersSupported}
            onClick={() => study.enableReminders(true)}
          >
            Enable laptop reminders
          </Button>
        </div>
      </Disclosure>
      {boiler.source === "fixture" && (
        <p className="mt-4 mb-0 text-xs leading-relaxed text-muted">
          Demo assignments are synthetic. Focus blocking works if you install
          the extension. Gemini conversations require sign-in and a configured
          server key.
        </p>
      )}
      {(error || blocker.error) && (
        <p
          role="alert"
          className="mt-4 mb-0 text-sm leading-relaxed text-redline-ink"
        >
          {error || blocker.error}
        </p>
      )}
    </Card>
  );
}
