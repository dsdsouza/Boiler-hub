import type { Metadata } from "next";
import { AccountMenu } from "@/components/ui/Account";
import { MobileTabBar, SiteHeader } from "@/components/ui/SiteHeader";
import { BoilerClient } from "./BoilerClient";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "My Boiler · Boilerplate" };

export default async function BoilerPage() {
  const supabase = await createClient();
  // Verify the cache owner locally; the data API still verifies the live user.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/?next=/boiler");
  return (
    <div className="min-h-screen">
      <SiteHeader variant="app" current="boiler" account={<AccountMenu />} />
      <main className="mx-auto max-w-[1240px] px-4 pt-6 pb-24 sm:px-8 sm:pt-8 sm:pb-16">
        <BoilerClient key={userId} userId={userId} />
      </main>
      <MobileTabBar current="boiler" />
    </div>
  );
}
