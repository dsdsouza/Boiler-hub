"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { DeadlineCalendar } from "@/components/calendar/DeadlineCalendar";
import { calendarDay, type MonthCalendar } from "@/lib/calendar/month";

const EMPTY: MonthCalendar = { deadlines: [], unavailableSources: 0, truncated: false };

export function CalendarClient({ userId }: { userId: string }) {
  const [calendar, setCalendar] = useState<{ month: string; selected: string; today: string; timeZone: string } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [accessLost, setAccessLost] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const [result, setResult] = useState<{ key: string; data: MonthCalendar; error: string; loading: boolean } | null>(null);
  const month = calendar?.month, timeZone = calendar?.timeZone;
  const key = `${userId}:${month}:${timeZone}`;
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const { data } = createClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || session && session.user.id !== userId) {
        pending.current?.abort(); setResult(null); setAccessLost(true);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [userId]);
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const today = calendarDay(new Date(), zone);
    setCalendar({ month: today.slice(0, 7), selected: today, today, timeZone: zone });
    const changed = () => setRefresh((value) => value + 1);
    window.addEventListener("focus", changed);
    window.addEventListener("boiler:data-changed", changed);
    return () => { window.removeEventListener("focus", changed); window.removeEventListener("boiler:data-changed", changed); };
  }, []);
  useEffect(() => {
    if (!month || !timeZone || accessLost) return;
    const controller = new AbortController();
    pending.current = controller;
    setResult({ key, data: EMPTY, error: "", loading: true });
    void (async () => {
      try {
        const response = await fetch(`/api/calendar/month?${new URLSearchParams({ month, timeZone })}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 401 ? "Sign in again to see your deadlines." : "Your deadlines couldn’t load. Please try again.");
        const data = await response.json() as MonthCalendar;
        if (!controller.signal.aborted) setResult({ key, data, error: "", loading: false });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, data: EMPTY, error: error instanceof Error ? error.message : "Your deadlines couldn’t load. Please try again.", loading: false });
      }
    })();
    return () => controller.abort();
  }, [key, month, timeZone, refresh, accessLost]);
  if (accessLost) return <p role="status" className="py-16 text-center text-body"><a href="/auth/signin?next=/calendar" className="underline underline-offset-4">Sign in again</a> to see your deadlines.</p>;
  if (!calendar) return <p role="status" className="py-16 text-center text-muted">Loading your calendar…</p>;
  const current = result?.key === key ? result : null;
  return <DeadlineCalendar {...calendar} data={current?.data ?? EMPTY} loading={current?.loading ?? true} error={current?.error ?? ""}
    onMonth={(month) => setCalendar((value) => value && { ...value, month, selected: `${month}-01` })}
    onSelect={(selected) => setCalendar((value) => value && { ...value, selected, month: selected.slice(0, 7) })}
    onToday={() => { const today = calendarDay(new Date(), calendar.timeZone); setCalendar({ ...calendar, month: today.slice(0, 7), selected: today, today }); }}
    onRefresh={() => setRefresh((value) => value + 1)} />;
}
