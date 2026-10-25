"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Card, Eyebrow } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FlameLoader } from "@/components/ui/FlameLoader";
import { StatusPill } from "@/components/ui/StatusPill";
import { ZoneBadge } from "@/components/ui/ZoneBadge";
import { ZONE_INK } from "@/components/ui/zones";
import { SourcesBanner } from "@/components/sources/SourcesBanner";
import { PipDressUp } from "@/components/mascot/PipDressUp";
import { CalendarSubscription } from "@/components/sources/CalendarSubscription";
import { PipHero } from "@/components/mascot/PipHero";
import { usePipAccessory } from "@/components/mascot/useAccessory";
import { Breakdown } from "./Breakdown";
import { ClassSchedule } from "./ClassSchedule";
import { ForecastDayPanel } from "./ForecastDayPanel";
import { ForecastStrip, forecastCaption } from "./ForecastStrip";
import { CalendarUnavailableBanner, ReconnectBanner } from "./ReconnectBanner";
import { StatusPicker } from "./StatusPicker";
import { CountBadges } from "./CountBadges";
import { TaskList } from "./TaskList";
import { fireFromForecast } from "./geometry";
import { browserZone } from "./taskView";
import { forecastBreakdown } from "@/lib/pressure";
import type { MyBoiler } from "./useMyBoiler";

function useTick(ms: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

const WIDE = "(min-width: 640px)"; // Tailwind sm: the strip and panel switch layout here.

function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(WIDE);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
}

/** Focus the visible copy of a forecast day's button (the strip renders once per breakpoint). */
function focusDay(date: string) {
  const buttons = document.querySelectorAll<HTMLButtonElement>(`[data-forecast-day="${date}"]`);
  [...buttons].find((b) => b.offsetParent !== null)?.focus();
}

export function RefreshIcon({ spinning }: { spinning?: boolean }) {
  if (spinning) return <FlameLoader size="sm" decorative />;
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
    >
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

/**
 * The full My Boiler screen body (MyBoiler.dc.html / Phone.dc.html).
 * Desktop: gauge plate on the left, forecast / schedule / breakdown / tasks on the right.
 * Phone: hero row, forecast, schedule, tasks, breakdown, status, in that order.
 */
export function MyBoilerView({
  boiler,
  title = "My Boiler",
  headingLevel = 1,
}: {
  boiler: MyBoiler;
  title?: string;
  headingLevel?: 1 | 2;
}) {
  useTick(30_000);
  const accessory = usePipAccessory();
  const { data, error, syncing, vent } = boiler;
  const Heading = headingLevel === 1 ? "h1" : "h2";
  // The forecast day whose drill-down is open. Lives here so both strip copies and the panel share it.
  const [openDay, setOpenDay] = useState<string | null>(null);
  const wide = useWide();
  const closeDay = useCallback(() => {
    if (!openDay) return;
    setOpenDay(null);
    requestAnimationFrame(() => focusDay(openDay));
  }, [openDay]);
  const toggleDay = useCallback((date: string) => setOpenDay((d) => (d === date ? null : date)), []);

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center text-muted">
        {error ? (
          <>
            <p role="alert" className="m-0 text-redline-ink">{error}</p>
            <Button aria-disabled={syncing} aria-busy={syncing} onClick={() => !syncing && void boiler.refresh()}>
              {syncing ? "Retrying…" : "Try again"}
            </Button>
          </>
        ) : <FlameLoader size="lg" label="Lighting the boiler…" />}
      </div>
    );
  }

  const { result } = data;
  const fire = fireFromForecast(result.forecast.map((d) => d.score));
  const statusPicker = (
    <StatusPicker status={data.status} note={data.statusNote} onChange={boiler.setStatus}>
      <PipDressUp score={result.score} />
    </StatusPicker>
  );
  const timeZone = data.timeZone ?? browserZone();
  // After a sync the open day may have rolled off the strip; the panel then just closes.
  const dayIndex = openDay ? result.forecast.findIndex((d) => d.date === openDay) : -1;
  const shownDay = dayIndex >= 0 ? result.forecast[dayIndex]! : null;
  const dayContributions = shownDay && dayIndex > 0
    ? forecastBreakdown(data.items, new Date(data.pressureComputedAt ?? data.syncedAt), shownDay.date, { timeZone })?.contributions ?? []
    : result.contributions;
  const strip = { items: data.items, timeZone, openDate: shownDay?.date ?? null, onOpen: toggleDay };
  const pendingTaskIds = boiler.source === "api" ? new Set(data.items.filter((i) => i.id.startsWith("local-")).map((i) => i.id)) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="bp-arrive flex flex-wrap items-end justify-between gap-4">
        <Heading className="m-0 font-display text-[44px] leading-none font-normal tracking-[0.02em] sm:text-[56px]">{title}</Heading>
        <button
          type="button"
          // aria-disabled, not disabled: a disabled button drops keyboard focus to the page.
          onClick={() => !syncing && void boiler.refresh()}
          aria-disabled={syncing}
          aria-busy={syncing}
          className="bp-button inline-flex min-h-11 min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-rivet bg-surface-2 px-[18px] text-sm font-semibold text-fg hover:border-brass aria-disabled:cursor-wait aria-disabled:opacity-70"
        >
          <RefreshIcon spinning={syncing} />
          {syncing ? "Syncing…" : "Refresh"}
        </button>
      </div>

      {data.calendar === "reconnect" && <ReconnectBanner />}
      {data.calendar === "unavailable" && <CalendarUnavailableBanner />}
      {data.sources && <SourcesBanner sources={data.sources} />}

      {error && (
        <p role="alert" className="m-0 rounded-lg border border-redline-ink px-4 py-3 text-sm text-redline-ink">
          {error}
        </p>
      )}

      {/*
        DOM order is the reading order at each width, so Tab follows what is on screen:
        phone: hero, counts, forecast, tasks, schedule, breakdown, status; desktop: gauge plate (hero, status), then
        forecast, tasks, schedule, calendar subscription, breakdown. Status renders twice, one copy per breakpoint;
        display:none keeps the hidden copy out of the Tab order and the accessibility tree.
      */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <section
          aria-label="Gauge and status"
          className="contents lg:flex lg:min-w-0 lg:flex-[1_1_340px] lg:flex-col lg:items-center lg:gap-[22px] lg:rounded-[14px] lg:border lg:border-line lg:bg-surface lg:px-7 lg:py-8 lg:plate lg:shadow-(--shadow)"
        >
          <div className="flex items-center gap-4 sm:flex-col sm:gap-[22px]">
            <div className="relative w-[150px] flex-none min-[400px]:w-[170px] sm:w-[250px]">
              <PipHero score={result.score} zone={result.zone} status={data.status} width="fluid" fire={fire} vent={vent.key} accessory={accessory} />
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

          <div className="max-sm:-mt-2 lg:w-full">
            <CountBadges counts={result.counts} />
          </div>

          <div className="hidden lg:block lg:w-full">
            {statusPicker}
          </div>
        </section>

        <div className="contents lg:flex lg:min-w-0 lg:flex-[999_1_560px] lg:flex-col lg:gap-6">
          <Card as="section" aria-labelledby="fc" className="bp-arrive bp-arrive-next px-4 py-4 sm:px-7 sm:py-6">
            <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2 sm:mb-4">
              <h2 id="fc" className="m-0 font-normal">
                <Eyebrow className="text-xs sm:hidden">7-day forecast</Eyebrow>
                <span className="hidden font-display text-[30px] leading-none tracking-[0.03em] sm:inline">7-day forecast</span>
              </h2>
              <span className="text-[13px] text-muted">{forecastCaption(result.forecast)}</span>
            </div>
            <p className="mt-0 mb-3 text-sm text-muted">Select a day to see what’s adding pressure.</p>
            <div className="sm:hidden">
              <ForecastStrip days={result.forecast} compact {...strip} />
            </div>
            <div className="hidden sm:block">
              <ForecastStrip days={result.forecast} {...strip} />
            </div>
            {shownDay && (
              <ForecastDayPanel
                day={shownDay}
                isToday={dayIndex === 0}
                items={data.items}
                contributions={dayContributions}
                courses={data.courses}
                timeZone={timeZone}
                sheet={!wide}
                onClose={closeDay}
                onToggle={boiler.setTaskDone}
                taskMeta={data.taskMeta}
                pendingTaskIds={pendingTaskIds}
              />
            )}
          </Card>

          <TaskList
            pendingTaskIds={pendingTaskIds}
            items={data.items}
            contributions={result.contributions}
            onToggle={(id, done) => void boiler.setTaskDone(id, done)}
            onAdd={(t) => boiler.addTask(t)}
            onSize={(id, size) => void boiler.setTaskSize(id, size)}
            onRemove={(id) => void boiler.removeTask(id)}
            onClearOverdue={() => boiler.clearOverdue()}
            meta={data.taskMeta}
            courses={data.courses}
            sourcesHref={boiler.source === "api" ? "/settings/sources" : undefined}
          />

          <ClassSchedule items={data.items} sources={data.sources} demo={boiler.source === "fixture"} onImported={() => void boiler.refresh()} />
          {boiler.source === "api" && <CalendarSubscription />}

          <Breakdown
            contributions={result.contributions}
            items={data.items}
            overrides={data.eventOverrides}
            onWeight={(id, w, series, clear) => void boiler.setEventWeight(id, w, series, clear)}
          />

          <div className="rounded-[14px] border border-line bg-surface px-5 py-6 shadow-(--shadow) lg:hidden">
            {statusPicker}
          </div>
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
      <AnimatePresence initial={false}>
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
