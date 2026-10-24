"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Card, Eyebrow } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { ZoneBadge } from "@/components/ui/ZoneBadge";
import { ZONE_INK } from "@/components/ui/zones";
import { Boiler } from "./Boiler";
import { Breakdown } from "./Breakdown";
import { ForecastStrip, forecastCaption } from "./ForecastStrip";
import { ReconnectBanner } from "./ReconnectBanner";
import { StatusPicker } from "./StatusPicker";
import { TaskList } from "./TaskList";
import { timeAgo } from "./format";
import { fireFromForecast } from "./geometry";
import type { MyBoiler } from "./useMyBoiler";

function useTick(ms: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

export function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? "animate-spin motion-reduce:animate-none" : ""}
    >
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

/**
 * The full My Boiler screen body (MyBoiler.dc.html / Phone.dc.html).
 * Desktop: gauge plate on the left, forecast / breakdown / tasks on the right.
 * Phone: hero row, forecast, tasks, breakdown, status, in that order.
 */
export function MyBoilerView({
  boiler,
  title = "My Boiler",
  sourceLabel = "Google Calendar connected",
  headingLevel = 1,
}: {
  boiler: MyBoiler;
  title?: string;
  sourceLabel?: string;
  headingLevel?: 1 | 2;
}) {
  useTick(30_000);
  const { data, error, syncing, vent } = boiler;
  const Heading = headingLevel === 1 ? "h1" : "h2";

  if (!data) {
    return (
      <div role="status" className="py-24 text-center text-muted">
        {error ? <span className="text-redline-ink">{error}</span> : "Lighting the boiler…"}
      </div>
    );
  }

  const { result } = data;
  const fire = fireFromForecast(result.forecast.map((d) => d.score));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading className="m-0 font-display text-[44px] leading-none font-normal tracking-[0.02em] sm:text-[56px]">{title}</Heading>
          <p className="mt-1.5 mb-0 text-[15px] text-muted">
            {data.calendar === "reconnect" ? "Tasks only" : sourceLabel} · next 7 days · synced {timeAgo(data.syncedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void boiler.refresh()}
          disabled={syncing}
          aria-busy={syncing}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-rivet bg-surface-2 px-[18px] text-sm font-semibold text-fg hover:border-brass disabled:cursor-wait disabled:opacity-70"
        >
          <RefreshIcon spinning={syncing} />
          {syncing ? "Syncing…" : "Refresh"}
        </button>
      </div>

      {data.calendar === "reconnect" && <ReconnectBanner />}

      {error && (
        <p role="alert" className="m-0 rounded-lg border border-redline-ink px-4 py-3 text-sm text-redline-ink">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        {/* Left: one riveted plate on desktop; on smaller screens its parts join the single column. */}
        <section
          aria-label="Gauge and status"
          className="contents lg:flex lg:min-w-0 lg:flex-[1_1_360px] lg:flex-col lg:items-center lg:gap-[22px] lg:rounded-[14px] lg:border lg:border-line lg:bg-surface lg:px-7 lg:py-8 lg:plate lg:shadow-(--shadow)"
        >
          <div className="order-1 flex items-center gap-4 sm:flex-col sm:gap-[22px] lg:order-none">
            <div className="relative w-[150px] flex-none min-[400px]:w-[170px] sm:w-[290px]">
              <Boiler score={result.score} zone={result.zone} status={data.status} width="fluid" fire={fire} vent={vent.key} />
              <VentLabel vent={vent} />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
              <span className={`font-mono text-[56px] leading-none font-bold sm:text-[64px] ${ZONE_INK[result.zone]}`}>
                <span className="sr-only">Pressure </span>
                {result.score}
              </span>
              <div className="flex flex-col items-start gap-1.5 sm:items-stretch">
                <ZoneBadge zone={result.zone} size="lg" className="max-sm:text-[22px]" />
                {result.zone === "redline" && (
                  <span className="text-center font-mono text-xs font-bold tracking-[0.12em] text-redline-ink">WHISTLE BLOWING</span>
                )}
                <StatusPill status={data.status} className="sm:hidden" />
              </div>
            </div>
          </div>

          <div className="order-5 rounded-[14px] border border-line bg-surface px-5 py-6 max-lg:shadow-(--shadow) lg:order-none lg:w-full lg:border-0 lg:bg-transparent lg:p-0">
            <StatusPicker status={data.status} note={data.statusNote} onChange={(s, n) => void boiler.setStatus(s, n)} />
          </div>
        </section>

        <div className="contents lg:flex lg:min-w-0 lg:flex-[999_1_560px] lg:flex-col lg:gap-6">
          <Card as="section" aria-labelledby="fc" className="order-2 px-4 py-4 sm:px-7 sm:py-6 lg:order-none">
            <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2 sm:mb-4">
              <h2 id="fc" className="m-0 font-normal">
                <Eyebrow className="text-xs sm:hidden">7-day forecast</Eyebrow>
                <span className="hidden font-display text-[30px] leading-none tracking-[0.03em] sm:inline">7-day forecast</span>
              </h2>
              <span className="text-[13px] text-muted">{forecastCaption(result.forecast)}</span>
            </div>
            <div className="sm:hidden">
              <ForecastStrip days={result.forecast} compact />
            </div>
            <div className="hidden sm:block">
              <ForecastStrip days={result.forecast} />
            </div>
          </Card>

          <Breakdown
            className="order-4 lg:order-none"
            contributions={result.contributions}
            items={data.items}
            onWeight={(id, w, series) => void boiler.setEventWeight(id, w, series)}
          />

          <TaskList
            className="order-3 lg:order-none"
            items={data.items}
            contributions={result.contributions}
            onToggle={(id, done) => void boiler.setTaskDone(id, done)}
            onAdd={(t) => void boiler.addTask(t)}
          />
        </div>
      </div>
    </div>
  );
}

function VentLabel({ vent }: { vent: { key: number; amount: number } }) {
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!vent.key) return;
    setShown(vent.key);
    const t = setTimeout(() => setShown(null), 1500);
    return () => clearTimeout(t);
  }, [vent.key]);

  return (
    <>
      <span role="status" className="sr-only">
        {shown ? `Task complete. Vented ${vent.amount.toFixed(1)} points.` : ""}
      </span>
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown}
            aria-hidden="true"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute top-2 left-1/2 w-[140px] -translate-x-1/2 rounded-md bg-zone-cool py-1.5 text-center font-mono text-sm font-bold text-soot"
          >
            VENTED −{vent.amount.toFixed(1)}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
