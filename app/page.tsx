import { Suspense } from "react";
import { Boiler } from "@/components/boiler/Boiler";
import { LinkButton } from "@/components/ui/Button";
import { SiteHeader } from "@/components/ui/SiteHeader";
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

  return (
    <div className="min-h-screen">
      <SiteHeader
        variant={viewer ? "app" : "marketing"}
        mobileNavigation="header"
        account={viewer ? (
          <AccountControls viewer={viewer} />
        ) : (
          <span className="hidden sm:inline-flex">
            <GoogleSignInButton href={signin} size="md" />
          </span>
        )}
      />

      {/* Isolate streamed Flight children from the bundled React hydration replay bug. */}
      <Suspense fallback={null}>
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
                <LinkButton href="/boiler" variant="ghost" size="lg" className="border-rivet font-semibold text-fg max-sm:w-full">
                  Open My Boiler
                </LinkButton>
              ) : (
                <GoogleSignInButton href={signin} className="max-sm:w-full" />
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
      </Suspense>
    </div>
  );
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

function GoogleSignInButton({ href, className = "", size = "lg" }: { href: string; className?: string; size?: "md" | "lg" }) {
  return (
    <LinkButton plain href={href} variant="ghost" size={size} className={`border-rivet font-semibold text-fg ${className}`}>
      <GoogleMark />
      Sign in with Google
    </LinkButton>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
