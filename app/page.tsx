import { Suspense } from "react";
import { PageLoading } from "@/components/ui/PageLoading";
import { Boiler } from "@/components/boiler/Boiler";
import { GoogleSignInButton } from "@/components/ui/GoogleSignInButton";
import { LinkButton } from "@/components/ui/Button";
import { MobileTabBar, SiteHeader } from "@/components/ui/SiteHeader";
import { AccountControls, getViewer } from "@/components/ui/Account";
import { ZONES, ZONE_DESCRIPTION, ZONE_INK, ZONE_LABEL, ZONE_RANGE } from "@/components/ui/zones";
import { safeNext } from "@/lib/auth";
import { HeroBoiler } from "@/components/boiler/HeroBoiler";
import { SignInToast } from "@/components/ui/SignInToast";

const SAMPLE_SCORE = { cool: 22, working: 55, hot: 80, redline: 95 } as const;

const display = "m-0 font-display font-normal tracking-[0.02em]";

export const dynamic = "force-dynamic";

export default async function LandingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, viewer] = await Promise.all([searchParams, getViewer()]);
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const signin = `/auth/signin?next=${encodeURIComponent(next)}`;
  const failed = params.error === "signin" || params.error === "auth";

  // Keep the page wrapper and header in the same hydration boundary as its
  // streamed Flight children, so a replay cannot claim the wrapper twice.
  return <Suspense fallback={<PageLoading />}>
    <div className={viewer ? "min-h-screen pb-[calc(80px+env(safe-area-inset-bottom))] sm:pb-0" : "min-h-screen"}>
      <SiteHeader
        variant={viewer ? "app" : "marketing"}
        account={viewer ? (
          <AccountControls viewer={viewer} />
        ) : (
          <span className="hidden sm:inline-flex">
            <GoogleSignInButton href={signin} size="md" />
          </span>
        )}
      />

      <main>
        {!viewer && failed && (
          <p role="alert" className="mx-auto mt-6 max-w-[1240px] px-4 text-sm text-redline-ink sm:px-8">
            Sign-in did not finish. Try again, or take the demo without signing in.
          </p>
        )}
        {!viewer && typeof params.next === "string" && !failed && (
          <SignInToast key={params.next} />
        )}

        <section className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-center gap-14 px-4 pt-12 pb-16 sm:px-8 sm:pt-14 sm:pb-20">
          <div className="flex flex-col gap-6">
            <h1 className={`${display} bp-arrive text-[clamp(48px,6.4vw,80px)] leading-[0.98] tracking-[0.01em]`}>
              You can see everyone’s calendar. You can’t see their pressure.
            </h1>
            <p className="bp-arrive bp-arrive-next m-0 max-w-[560px] text-[17px] leading-relaxed text-body sm:text-[19px]">
              Boilerplate turns each person’s calendar and tasks into a live boiler. Meetings, deadlines and homework add pressure; finishing work
              lowers it. Teams see who is near the red line, only with their permission.
            </p>
            <div className="bp-arrive bp-arrive-last flex flex-wrap gap-3.5 pt-2">
              <LinkButton href="/demo" variant="primary" size="lg" className="max-sm:w-full">
                Try the demo
              </LinkButton>
              {viewer ? (
                <LinkButton href="/boiler" variant="primary" size="lg" className="bp-button-striped max-sm:w-full">
                  Open My Boiler
                </LinkButton>
              ) : (
                typeof params.next === "string" && next !== "/onboarding" ? <GoogleSignInButton href={signin} className="max-sm:w-full" /> : <LinkButton href="/onboarding" variant="secondary" size="lg" className="max-sm:w-full">Set up my boiler</LinkButton>
              )}
            </div>
          </div>
          <HeroBoiler />
        </section>

        <section id="how" className="border-t border-line bg-bg-2">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-9 px-4 py-16 sm:px-8 sm:py-[72px]">
            <h2 className={`${display} text-[44px] sm:text-[52px]`}>How the pressure moves</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-5">
              <Step
                title="Pressure in"
                icon={<path d="M20 34V8M11 17l9-9 9 9" />}
                color="#F0913A"
                text="Connect Google Calendar and add tasks. Meetings over the next week and deadlines over two weeks build the score from 0 to 100."
              />
              <Step
                title="Steam out"
                icon={<path d="M10 28c0-6 6-6 6-12M20 28c0-6 6-6 6-12M30 28c0-6-4-6-4-10" />}
                color="#7FB3D5"
                text="Complete a task and its load leaves your boiler. The work still due keeps its weight."
              />
              <Step
                title="Shared on your terms"
                icon={
                  <>
                    <rect x="9" y="18" width="22" height="16" rx="3" />
                    <path d="M14 18v-5a6 6 0 0 1 12 0v5" />
                  </>
                }
                color="#D1A85A"
                text="Join a class or work team and choose who sees your gauge: Hidden, Lead only, or Everyone. Hidden is the default."
              />
            </div>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-9 px-4 py-16 sm:px-8 sm:py-[72px]">
            <h2 className={`${display} text-[44px] sm:text-[52px]`}>Four zones, one glance</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-5">
              {ZONES.map((z) => (
                <div key={z} className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface p-6 shadow-(--shadow)">
                  <Boiler score={SAMPLE_SCORE[z]} size="sm" whistle={false} />
                  <h3 className={`m-0 font-display text-[30px] font-normal tracking-[0.05em] ${ZONE_INK[z]}`}>
                    {ZONE_LABEL[z]} · {ZONE_RANGE[z]}
                  </h3>
                  <div className="text-center text-sm text-muted">{ZONE_DESCRIPTION[z]}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      {viewer && <MobileTabBar />}
    </div>
  </Suspense>;
}

function Step({ title, text, icon, color }: { title: string; text: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-7 py-8 shadow-(--shadow) plate">
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
        {icon}
      </svg>
      <h3 className="m-0 text-xl font-bold">{title}</h3>
      <p className="m-0 leading-relaxed text-body">{text}</p>
    </div>
  );
}
