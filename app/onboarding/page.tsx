import type { Metadata } from "next";
import { OnboardingPip } from "@/components/mascot/OnboardingPip";
import { AccountMenu } from "@/components/ui/Account";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { OnboardingClient } from "./OnboardingClient";

export const metadata: Metadata = { title: "Get started · Boilerplate" };

export default function OnboardingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader variant="app" account={<AccountMenu />} />
      <main className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 pt-8 pb-12 sm:px-8">
        <div>
          <h1 className="m-0 font-display text-[44px] leading-none font-normal tracking-[0.02em] sm:text-[56px]">Light your boiler</h1>
        </div>
        <OnboardingPip />
        <OnboardingClient />
      </main>
    </div>
  );
}
