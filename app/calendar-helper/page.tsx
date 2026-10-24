import type { Metadata } from "next";
import { CalendarHelper } from "@/components/sources/CalendarHelper";
import { getViewer, AccountMenu } from "@/components/ui/Account";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { LinkButton } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Calendar Finder · Boiler Hub",
  description: "Find your school calendar subscription link and review it before connecting to Boiler Hub.",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CalendarHelperPage() {
  const viewer = await getViewer();
  return <div className="min-h-screen">
    <SiteHeader variant={viewer ? "app" : "marketing"} current={viewer ? "sources" : undefined} account={viewer ? <AccountMenu /> : <LinkButton plain href="/auth/signin?next=%2Fcalendar-helper" variant="ghost">Sign in</LinkButton>} />
    <main className="mx-auto flex max-w-[860px] flex-col gap-6 px-4 pt-8 pb-16 sm:px-8">
      <div className="bp-arrive">
        <h1 className="m-0 font-display text-[44px] leading-none sm:text-[56px]">Find your school calendar</h1>
        <p className="mt-3 mb-0 max-w-[65ch] text-base leading-relaxed text-muted">A browser helper for bringing school calendar links into Boiler Hub.</p>
      </div>
      <CalendarHelper signedIn={!!viewer} />
    </main>
  </div>;
}
