"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Counts, ForecastDay, Zone } from "@/lib/types";
import { createClient } from "@/lib/supabase/browser";
import { FloatingPip } from "./FloatingPip";
import type { Snapshot } from "./dockMessage";

/** One companion on every signed-in screen, even before a first reading exists. */
export function PipDock() {
  const pathname = usePathname() ?? "/";
  const [userId, setUserId] = useState<string | null>(null);
  const [reading, setReading] = useState<{ userId: string; snapshot: Snapshot | null; now: number } | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const client = createClient();
    let active = true;
    let observedAuth = false;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      observedAuth = true;
      if (active) setUserId(session?.user.id ?? null);
    });
    void client.auth.getSession().then(({ data }) => {
      if (active && !observedAuth) setUserId(data.session?.user.id ?? null);
    }).catch(() => { if (active && !observedAuth) setUserId(null); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!userId || pathname === "/onboarding") return;
    let active = true;
    const client = createClient();
    void (async () => {
      try {
        const { data, error } = await client.from("pressure_snapshots")
          .select("score, zone, counts, forecast, computed_at").eq("user_id", userId).maybeSingle();
        if (active) setReading({ userId, now: Date.now(), snapshot: !error && data ? {
          score: data.score as number, zone: data.zone as Zone, counts: data.counts as Counts,
          forecast: (data.forecast ?? []) as ForecastDay[], computedAt: data.computed_at as string,
        } : null });
      } catch {
        if (active) setReading({ userId, snapshot: null, now: Date.now() });
      }
    })();
    return () => { active = false; };
  }, [userId, pathname]);

  if (!userId || pathname === "/onboarding") return null;
  const ownReading = reading?.userId === userId ? reading : null;
  return <FloatingPip key={userId} userId={userId} snapshot={ownReading?.snapshot ?? null} now={ownReading?.now ?? 0} pathname={pathname} />;
}
