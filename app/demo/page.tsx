import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/Button";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { DemoContent } from "./DemoContent";

export const metadata: Metadata = {
  title: "Demo · Boilerplate",
  description: "A seeded class and work team. No sign-in needed.",
};

export default function DemoPage() {
  return (
    <div className="min-h-screen">
      <aside aria-label="Demo mode" className="bg-brass text-sm font-semibold text-soot">
        <div className="mx-auto flex max-w-[1320px] flex-wrap justify-between gap-2 px-4 py-2.5 sm:px-8">
          <span>You are viewing demo data. Nothing you do here is saved.</span>
          {/* Route handler: plain anchor so Next does not prefetch it. */}
          <a href="/auth/signin?next=/boiler" className="text-soot underline hover:text-soot">
            Sign in with Google to see your own boiler
          </a>
        </div>
      </aside>

      <SiteHeader
        variant="marketing"
        current="demo"
        account={
          <span className="hidden sm:inline-flex">
            <LinkButton plain href="/auth/signin?next=/boiler" variant="ghost" className="text-fg">
              Sign in with Google
            </LinkButton>
          </span>
        }
      />

      <nav aria-label="Demo sections" className="border-b border-line">
        <div className="mx-auto flex max-w-[1320px] gap-1 px-4 sm:px-8">
          <a href="#engine-room" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-body no-underline hover:text-fg">
            Engine Room
          </a>
          <a href="#maya" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-body no-underline hover:text-fg">
            Maya’s boiler
          </a>
        </div>
      </nav>

      <main className="mx-auto flex max-w-[1320px] flex-col gap-16 px-4 pt-7 pb-16 sm:px-8">
        <DemoContent />
      </main>
    </div>
  );
}
