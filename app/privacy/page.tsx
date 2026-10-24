import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SiteHeader } from "@/components/ui/SiteHeader";

export const metadata: Metadata = {
  title: "Privacy · Boilerplate",
  description: "What Boilerplate reads, what it stores, and what your teams can see.",
};

const CONTACT = "dand54545@gmail.com";

const POINTS: { title: string; body: React.ReactNode }[] = [
  {
    title: "We read your Google Calendar only to compute a pressure score",
    body: "With your permission we read your calendar (read-only) for the next seven days and turn it into a single score from 0 to 100. We use it for nothing else.",
  },
  {
    title: "Event details are never stored",
    body: "Event titles, attendees and times are fetched when your score is computed and then discarded. We store only the resulting score, zone and category counts (for example “9 meetings, 3 due”), plus the tasks you add yourself.",
  },
  {
    title: "Teams see only your score, zone and status, and only if you choose",
    body: "When you join a team you start Hidden. You decide, per team, whether leads or everyone can see your boiler. Teams never see what is on your calendar.",
  },
  {
    title: "You can hide or disconnect anytime",
    body: (
      <>
        Set yourself to Hidden on any team from <Link href="/teams">Teams</Link>. To disconnect Google, remove Boilerplate from your
        Google Account&rsquo;s third-party access page; we then stop reading your calendar.
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader variant="marketing" />
      <main className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 pt-10 pb-12 sm:px-8">
        <h1 className="m-0 font-display text-[clamp(44px,7vw,72px)] leading-[0.95] font-normal">Privacy</h1>
        <p className="m-0 text-lg leading-relaxed text-body">
          The gauge measures load, not wellbeing. Here is exactly what we read, what we keep and who sees it.
        </p>
        <Card plate className="flex flex-col gap-6 px-6 py-7 sm:px-8">
          {POINTS.map((p) => (
            <section key={p.title} className="flex flex-col gap-1.5">
              <h2 className="m-0 text-lg font-bold">{p.title}</h2>
              <p className="m-0 leading-relaxed text-body">{p.body}</p>
            </section>
          ))}
        </Card>
        <p className="m-0 text-body">
          Questions or a deletion request? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </main>
    </div>
  );
}
