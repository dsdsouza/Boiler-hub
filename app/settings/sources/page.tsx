import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/ui/Account";
import { MobileTabBar, SiteHeader } from "@/components/ui/SiteHeader";
import { SourcesSettings } from "@/components/sources/SourcesSettings";
import { createClient } from "@/lib/supabase/server";
import { toSummary } from "@/lib/sources/load";
import { SOURCE_COLUMNS, type SourceRow } from "@/lib/sources/types";

export const metadata: Metadata = { title: "Sources · Boilerplate" };
export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/?next=/settings/sources");

  // RLS and column grants: own rows only, never the secret.
  const { data, error } = await supabase.from("sources").select(SOURCE_COLUMNS).order("created_at").returns<SourceRow[]>();
  if (error) console.error("[settings/sources] read failed", error.message);

  return (
    <div className="min-h-screen">
      <SiteHeader variant="app" current="sources" account={<AccountMenu />} />
      <main className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 pt-8 pb-24 sm:px-8 sm:pb-16">
        <div className="bp-arrive">
          <h1 className="m-0 font-display text-[44px] leading-none font-normal tracking-[0.02em] sm:text-[56px]">Sources</h1>
        </div>
        {error && (
          <p role="alert" className="m-0 rounded-lg border border-redline-ink px-4 py-3 text-sm text-redline-ink">
            Could not load your sources. Try again in a moment.
          </p>
        )}
        <SourcesSettings initial={(data ?? []).map(toSummary)} />
      </main>
      <MobileTabBar current="sources" />
    </div>
  );
}
