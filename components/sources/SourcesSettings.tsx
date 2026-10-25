"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SourceInfo } from "@/lib/pressure/api-types";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { timeAgo } from "@/components/boiler/format";
import { foundLine, sourcesCall, type TestResult } from "./api";
import { CalendarSubscription } from "./CalendarSubscription";
import { SourceConnections } from "./SourceConnections";
import { Feedback } from "@/components/ui/Feedback";

const KIND_LABEL: Record<SourceInfo["kind"], string> = { ics: "Calendar feed", github: "GitHub" };

/** /settings/sources: connected sources with health, Test and Remove, plus the add forms. */
export function SourcesSettings({ initial }: { initial: SourceInfo[] }) {
  const [sources, setSources] = useState(initial);

  const upsert = (s: SourceInfo) => setSources((list) => (list.some((x) => x.id === s.id) ? list.map((x) => (x.id === s.id ? s : x)) : [...list, s]));

  return (
    <div className="bp-arrive bp-arrive-next flex flex-col gap-6">
      <Card as="section" aria-labelledby="yours" className="px-5 py-6 sm:px-7">
        <div className="mb-4 flex items-center gap-3">
          <CardTitle id="yours" tabIndex={-1}>Your sources</CardTitle>
          <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-muted tabular-nums">{sources.length}</span>
        </div>
        {sources.length === 0 ? (
          <p className="m-0 border-t border-line py-3 text-sm text-muted">
            Nothing connected yet. Add a calendar feed below to include your events and deadlines.
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {sources.map((s) => (
              <SourceRow key={s.id} source={s} onChange={upsert} onRemoved={() => { setSources((l) => l.filter((x) => x.id !== s.id)); document.getElementById("yours")?.focus(); }} />
            ))}
          </ul>
        )}
      </Card>

      <SourceConnections onAdded={(r) => upsert(r.source)} />
      <CalendarSubscription />
    </div>
  );
}

function SourceRow({ source, onChange, onRemoved }: { source: SourceInfo; onChange: (s: SourceInfo) => void; onRemoved: () => void }) {
  const uid = useId();
  const [busy, setBusy] = useState<"test" | "remove" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const ok = source.kind === "ics" && source.status === "ok";
  const retired = source.kind !== "ics";
  useEffect(() => { if (confirming) confirmButton.current?.focus(); }, [confirming]);

  async function test() {
    if (busy) return;
    setBusy("test"); setNote(null);
    try {
      const r = await sourcesCall<TestResult>(`/api/sources/${source.id}/test`, "POST");
      onChange(r.source);
      const found = foundLine(r);
      setNote(r.ok ? { ok: true, text: `${found}.` } : { ok: false, text: r.error ?? "The source did not respond" });
    } catch (e) { setNote({ ok: false, text: (e as Error).message }); }
    finally { setBusy(null); }
  }
  async function remove() {
    if (busy) return;
    setBusy("remove"); setNote(null);
    try { await sourcesCall(`/api/sources/${source.id}`, "DELETE"); onRemoved(); }
    catch (e) {
      setNote({ ok: false, text: (e as Error).message });
      setBusy(null); setConfirming(false); removeButton.current?.focus();
    }
  }
  return (
    <li className="flex flex-col gap-2 border-t border-line py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-words text-base font-semibold text-fg">{source.label}</span>
            {source.label.trim().toLowerCase() !== KIND_LABEL[source.kind].toLowerCase() && <span className="rounded border border-line px-1.5 text-[11px] font-medium text-muted">{KIND_LABEL[source.kind]}</span>}
            {source.kind === "ics" && source.coursework && <span className="text-xs text-muted">coursework</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            <span className={`inline-flex items-center gap-1.5 font-medium ${ok ? "text-cool-ink" : "text-redline-ink"}`}>
              <span aria-hidden="true" className={`size-1.5 rounded-full ${ok ? "bg-zone-cool" : "bg-zone-redline"}`} />
              {retired ? "Disconnected" : ok ? "Connected" : "Needs attention"}
            </span>
            {!retired && <span className="text-muted">· {source.lastSyncedAt ? `Last synced ${timeAgo(source.lastSyncedAt)}` : "Never synced"}</span>}
          </div>
          {(retired || !ok && source.error) && <p className="m-0 text-[13px] leading-relaxed text-body wrap-anywhere">{retired ? "This integration has been removed." : source.error}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!retired && <Button onClick={() => void test()} aria-label={`Test ${source.label}`} aria-disabled={busy !== null} aria-busy={busy === "test"}>
            {busy === "test" ? "Testing…" : "Test"}
          </Button>}
          <Button ref={removeButton} variant="ghost" onClick={() => { if (!busy) setConfirming(true); }} aria-expanded={confirming} aria-controls={`${uid}-remove`} aria-label={`Remove ${source.label}`} aria-disabled={busy !== null}>Remove</Button>
        </div>
      </div>
      {confirming && <div id={`${uid}-remove`} role="group" aria-label={`Remove ${source.label}`} className="flex flex-wrap items-center gap-2 rounded-[10px] bg-bg px-3 py-2">
        <p className="m-0 mr-auto text-sm text-body">Remove this connection?</p>
        <Button ref={confirmButton} onClick={() => void remove()} aria-disabled={busy !== null} aria-busy={busy === "remove"} className="border-redline-ink text-redline-ink">{busy === "remove" ? "Removing…" : "Confirm removal"}</Button>
        <Button variant="ghost" onClick={() => { if (busy) return; setConfirming(false); removeButton.current?.focus(); }} aria-disabled={busy !== null}>Cancel</Button>
      </div>}
      <Feedback message={note?.text} tone={note?.ok ? "success" : "error"} />
    </li>
  );
}
