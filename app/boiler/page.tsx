import type { Metadata } from "next";
import { AccountMenu } from "@/components/ui/Account";
import { MobileTabBar, SiteHeader } from "@/components/ui/SiteHeader";
import { BoilerClient } from "./BoilerClient";
import { getCurrentUser } from "@/lib/supabase/user";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "My Boiler · Boilerplate" };

export default async function BoilerPage() {
  const { user } = await getCurrentUser();
  if (!user) redirect("/?next=/boiler");
  return (
    <div className="min-h-screen">
      <SiteHeader variant="app" current="boiler" account={<AccountMenu />} />
      <main className="mx-auto max-w-[1240px] px-4 pt-6 pb-24 sm:px-8 sm:pt-8 sm:pb-16">
        <BoilerClient key={user.id} userId={user.id} />
      </main>
      <MobileTabBar current="boiler" />
    </div>
  );
}
