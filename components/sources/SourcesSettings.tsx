"use client";

import { useState } from "react";
import type { SourceInfo } from "@/lib/pressure/api-types";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { timeAgo } from "@/components/boiler/format";
import { foundLine, sourcesCall, type TestResult } from "./api";
import { CalendarFeedForm, GitHubTokenForm } from "./SourceForms";
import { CalendarSubscription } from "./CalendarSubscription";

const KIND_LABEL: Record<SourceInfo["kind"], string> = { ics: "Calendar feed", github: "GitHub" };

/** /settings/sources: connected sources with health, Test and Remove, plus the add forms. */
export function SourcesSettings({ initial }: { initial: SourceInfo[] }) {
  const [sources, setSources] = useState(initial);

  const upsert = (s: SourceInfo) => setSources((list) => (list.some((x) => x.id === s.id) ? list.map((x) => (x.id === s.id ? s : x)) : [...list, s]));

  return (
    <div className="flex flex-col gap-6">
      <CalendarSubscription />
      <Card as="section" aria-labelledby="yours" className="px-5 py-6 sm:px-7">
        <CardTitle id="yours" className="mb-3">
          Your sources
        </CardTitle>
        {sources.length === 0 ? (
          <p className="m-0 border-t border-line py-3 text-sm text-muted">
            Nothing connected yet. Add a calendar feed or GitHub below and their deadlines join your boiler.
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {sources.map((s) => (
              <SourceRow key={s.id} source={s} onChange={upsert} onRemoved={() => setSources((l) => l.filter((x) => x.id !== s.id))} />
            ))}
          </ul>
        )}
      </Card>

      <Card as="section" aria-labelledby="add-feed" className="px-5 py-6 sm:px-7">
        <CardTitle id="add-feed" className="mb-1">
          Add a calendar feed
        </CardTitle>
        <p className="mt-0 mb-4 text-sm text-muted">
          Deadlines (anything due, quizzes, exams, labs, projects) become tasks. Other timed entries count as events. Titles and dates are
          fetched live on each sync and never stored.
        </p>
        <CalendarFeedForm onAdded={(r) => upsert(r.source)} />
      </Card>

      <Card as="section" aria-labelledby="add-gh" className="px-5 py-6 sm:px-7">
        <CardTitle id="add-gh" className="mb-1">
          Connect GitHub
        </CardTitle>
        <p className="mt-0 mb-4 text-sm text-muted">
          Assigned issues, review requests and failing CI on your PRs become tasks. Issues you close and PRs that merge vent pressure.
        </p>
        <GitHubTokenForm onAdded={(r) => upsert(r.source)} />
      </Card>
    </div>
  );
}

function SourceRow({ source, onChange, onRemoved }: { source: SourceInfo; onChange: (s: SourceInfo) => void; onRemoved: () => void }) {
  const [busy, setBusy] = useState<"test" | "remove" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const ok = source.status === "ok";

  async function test() {
    setBusy("test");
    setNote(null);
    try {
      const r = await sourcesCall<TestResult>(`/api/sources/${source.id}/test`, "POST");
      onChange(r.source);
      const found = source.kind === "github" ? `Found ${r.tasks} ${r.tasks === 1 ? "item" : "items"}` : foundLine(r);
      setNote(r.ok ? { ok: true, text: `${found}.` } : { ok: false, text: r.error ?? "The source did not respond" });
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    setNote(null);
    try {
      await sourcesCall(`/api/sources/${source.id}`, "DELETE");
      onRemoved();
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message });
      setBusy(null);
      setConfirming(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 border-t border-line py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-line px-1.5 font-mono text-[11px] font-bold tracking-[0.06em] text-muted uppercase">
              {KIND_LABEL[source.kind]}
            </span>
            <span className="truncate text-[15px] font-semibold text-fg">{source.label}</span>
            {source.kind === "ics" && source.coursework && <span className="text-xs text-muted">coursework</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-[13px]">
            <span className={`inline-flex items-center gap-1.5 font-semibold ${ok ? "text-cool-ink" : "text-redline-ink"}`}>
              <span aria-hidden="true" className={`size-2 rounded-full ${ok ? "bg-zone-cool" : "bg-zone-redline"}`} />
              {ok ? "Working" : "Error"}
            </span>
            <span className="text-muted">· {source.lastSyncedAt ? `Last synced ${timeAgo(source.lastSyncedAt)}` : "Never synced"}</span>
          </div>
          {!ok && source.error && <p className="m-0 text-[13px] text-body">{source.error}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <span className="text-sm text-body">Remove {source.label}?</span>
              <Button onClick={() => void remove()} disabled={busy === "remove"} className="border-redline-ink text-redline-ink">
                {busy === "remove" ? "Removing…" : "Remove"}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy === "remove"}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => void test()} disabled={busy !== null} aria-busy={busy === "test"}>
                {busy === "test" ? "Testing…" : "Test"}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(true)} disabled={busy !== null}>
                Remove
              </Button>
            </>
          )}
        </div>
      </div>
      <p aria-live="polite" className="m-0 text-[13px]">
        {note && <span className={note.ok ? "text-cool-ink" : "text-redline-ink"}>{note.text}</span>}
      </p>
    </li>
  );
}
