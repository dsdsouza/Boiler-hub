"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Status } from "@/lib/types";
import type { BoilerResponse } from "@/lib/pressure/api-types";
import { Boiler } from "@/components/boiler/Boiler";
import { CalendarUnavailableBanner, ReconnectBanner } from "@/components/boiler/ReconnectBanner";
import { StatusPicker } from "@/components/boiler/StatusPicker";
import { CountBadges } from "@/components/boiler/CountBadges";
import { statusBody } from "@/components/boiler/fromApi";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { ZoneBadge } from "@/components/ui/ZoneBadge";
import { ZONE_INK } from "@/components/ui/zones";
import { CalendarFeedForm, GitHubTokenForm } from "@/components/sources/SourceForms";
import type { AddedSource } from "@/components/sources/api";
import { FirstReadingPip } from "@/components/mascot/OnboardingPip";

async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(json?.error ?? `${method} ${path} failed (${res.status})`);
  return json as T;
}

const field = "min-h-11 w-full rounded-lg border border-line bg-field px-3 font-mono text-[17px] tracking-[0.2em] text-fg uppercase placeholder:text-muted";

/** Onboarding (PRD): confirm calendar connected, first sync, pick status, optional sources and join code, then /boiler. */
export function OnboardingClient() {
  const [boiler, setBoiler] = useState<BoilerResponse | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ status: Status; note: string } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function sync() {
    setSyncError(null);
    try {
      const b = await call<BoilerResponse>("/api/sync", "POST");
      setBoiler(b);
      setStatus((s) => s ?? { status: b.status.status, note: b.status.note ?? "" });
    } catch (e) {
      setSyncError((e as Error).message);
    }
  }

  useEffect(() => {
    void sync();
  }, []);

  async function changeStatus(next: Status, note: string) {
    const prev = status;
    setStatus({ status: next, note });
    setStatusError(null);
    try {
      await call("/api/me/status", "PATCH", statusBody(next, note));
    } catch (e) {
      setStatus(prev);
      setStatusError((e as Error).message);
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    setJoining(true);
    setJoinError(null);
    try {
      await call<{ teamId: string }>("/api/teams/join", "POST", { code: code.trim() });
      setJoined(code.trim().toUpperCase());
      setCode("");
    } catch (err) {
      setJoinError((err as Error).message);
    } finally {
      setJoining(false);
    }
  }

  const connected = boiler?.calendar === "ok";
  const sources = boiler?.sources ?? [];
  // A new source resyncs on the server; show its effect on the first-sync gauge.
  const sourceAdded = (r: AddedSource) => {
    if (r.boiler) setBoiler(r.boiler);
  };

  return (
    <div className="flex flex-col gap-5">
      <Step n={1} title="Google Calendar">
        {!boiler && !syncError && <p className="m-0 text-body" role="status">Checking your calendar connection…</p>}
        {syncError && (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-redline-ink">
            <span>{syncError}</span>
            <Button onClick={() => void sync()}>Try again</Button>
          </div>
        )}
        {boiler && connected && (
          <p className="m-0 text-body">
            <strong className="text-cool-ink">Connected.</strong>
          </p>
        )}
        {boiler?.calendar === "reconnect" && <ReconnectBanner next="/onboarding" />}
        {boiler?.calendar === "unavailable" && <CalendarUnavailableBanner />}
      </Step>

      <Step n={2} title="First sync">
        {!boiler ? (
          <p className="m-0 text-muted">Waiting for the calendar…</p>
        ) : (
          <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
            <div className="w-full sm:row-span-2">
              <Boiler score={boiler.result.score} zone={boiler.result.zone} size="sm" width="fluid" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className={`font-mono text-[44px] leading-none font-bold ${ZONE_INK[boiler.result.zone]}`}>
                  <span className="sr-only">Pressure </span>
                  {boiler.result.score}
                </span>
                <ZoneBadge zone={boiler.result.zone} />
              </div>
              <CountBadges counts={boiler.result.counts} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              {connected ? <FirstReadingPip score={boiler.result.score} zone={boiler.result.zone} /> : (
                <p className="m-0 text-sm text-muted">Tasks and connected sources count here. Your team’s score updates when Google Calendar reconnects.</p>
              )}
            </div>
          </div>
        )}
      </Step>

      <Step n={3} title="Your status">
        {status ? (
          <>
            <StatusPicker status={status.status} note={status.note} labelledBy="step-3" onChange={(s, n) => void changeStatus(s, n)} />
            {statusError && (
              <p role="alert" className="mt-2 mb-0 text-sm text-redline-ink">
                {statusError}
              </p>
            )}
          </>
        ) : (
          <p className="m-0 text-muted">Loading…</p>
        )}
      </Step>

      <Step n={4} title="Connect more calendars or GitHub (optional)">
        <p className="mt-0 mb-3 text-sm text-body">
          Bring in events from Apple Calendar (iCloud), deadlines from Brightspace, Canvas or other feeds, and issues and reviews from GitHub, so you do not have to type
          them. Titles and dates are fetched live and never stored.
        </p>
        {sources.length > 0 && (
          <p className="mt-0 mb-3 text-sm text-cool-ink">Connected: {sources.map((s) => s.label).join(", ")}.</p>
        )}
        <div className="flex flex-col gap-1 border-t border-line pt-1">
          <details className="text-sm">
            <summary className="bp-summary flex min-h-11 cursor-pointer items-center font-semibold text-fg">
              Add Apple Calendar or another calendar feed
            </summary>
            <div className="pt-2 pb-4">
              <CalendarFeedForm onAdded={sourceAdded} idPrefix="ob-feed" />
            </div>
          </details>
          <details className="text-sm">
            <summary className="bp-summary flex min-h-11 cursor-pointer items-center font-semibold text-fg">Connect GitHub</summary>
            <div className="pt-2 pb-4">
              <GitHubTokenForm onAdded={sourceAdded} idPrefix="ob-gh" />
            </div>
          </details>
        </div>
        <p className="mt-2 mb-0 text-[13px] text-muted">Skip this for now if you like: it is always under Sources.</p>
      </Step>

      <Step n={5} title="Join a team (optional)">
        <p className="mt-0 mb-3 text-sm text-body">
          Got an invite code from a teacher or lead? You join as <strong>Hidden</strong>: nobody sees your boiler until you choose who
          can in Teams.
        </p>
        <form onSubmit={join} className="flex flex-wrap items-end gap-2.5">
          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5 sm:max-w-[240px]">
            <label htmlFor="code" className="text-[13px] font-medium text-body">
              Invite code
            </label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              autoComplete="off"
              placeholder="ABC123"
              className={field}
            />
          </div>
          <Button type="submit" disabled={joining || code.trim().length !== 6}>
            {joining ? "Joining…" : "Join"}
          </Button>
        </form>
        <p aria-live="polite" className="mt-2 mb-0 text-sm">
          {joined && <span className="text-cool-ink">Joined team {joined}. You are hidden there for now.</span>}
          {joinError && <span className="text-redline-ink">{joinError}</span>}
        </p>
      </Step>

      <div className="flex flex-wrap items-center gap-4">
        <LinkButton href="/boiler" variant="primary" size="lg">
          Go to my boiler
        </LinkButton>
        <span className="text-sm text-muted">You can change any of this later.</span>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card as="section" aria-labelledby={`step-${n}`} className="px-5 py-6 sm:px-7">
      <CardTitle id={`step-${n}`} className="mb-3">
        <span className="mr-2 font-mono text-[18px] text-brass-ink" aria-hidden="true">
          {n}
        </span>
        {title}
      </CardTitle>
      {children}
    </Card>
  );
}
