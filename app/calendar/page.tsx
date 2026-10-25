import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountMenu } from "@/components/ui/Account";
import { MobileTabBar, SiteHeader } from "@/components/ui/SiteHeader";
import { CalendarClient } from "./CalendarClient";

export const metadata: Metadata = { title: "Calendar · Boilerplate" };

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/?next=/calendar");
  return <div className="min-h-screen">
    <SiteHeader variant="app" current="calendar" account={<AccountMenu />} />
    <main className="mx-auto max-w-[1240px] px-4 pt-6 pb-24 sm:px-8 sm:pt-8 sm:pb-16"><CalendarClient key={userId} userId={userId} /></main>
    <MobileTabBar current="calendar" />
  </div>;
}
