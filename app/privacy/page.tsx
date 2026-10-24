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
    title: "What we read",
    body: (
      <>
        <strong>Google Calendar</strong> (read-only): your next seven days, to compute a single score from 0 to 100.{" "}
        <strong>Calendar feeds you add</strong> (Brightspace, Canvas, Outlook or any .ics link): their deadlines and events.{" "}
        <strong>GitHub</strong>, if you connect a read-only token: open issues assigned to you, pull requests waiting for your
        review, your open pull requests and whether their GitHub Actions checks failed, and issues or pull requests of yours closed
        or merged in the last two days. Only repositories you granted the token are visible to us. We use all of this for your score
        and nothing else.
      </>
    ),
  },
  {
    title: "What we do not store",
    body: "Calendar events (titles, attendees, times) and the items in your feeds and GitHub are fetched each time your score is computed. They may sit in server memory for a few minutes to avoid fetching again, and are never written to our database.",
  },
  {
    title: "What we store",
    body: (
      <>
        Your name and picture from Google, your status and status note, and your latest score with its zone, category counts (for
        example &ldquo;9 meetings, 3 due&rdquo;), seven-day forecast and the time it was computed. The titles, due dates and sizes of
        tasks you add yourself, and of assignments your team leads post. The Light/Normal/Heavy tags you set, stored against a
        scrambled (hashed) event ID, not the event. For feeds and GitHub: the name you gave each one, its sync status, and which items
        you marked done or resized, again by hashed ID. Feed links and GitHub tokens are stored encrypted, and are never shown back,
        even to you.
      </>
    ),
  },
  {
    title: "Your Google sign-in",
    body: "To read your calendar when you are not on the site (including a once-a-day background refresh), we keep your Google refresh token, encrypted. It stays stored until you ask us to delete your data. Removing Boilerplate from your Google Account's third-party access page stops us reading your calendar straight away.",
  },
  {
    title: "What teams see, and only if you choose",
    body: (
      <>
        Your score, zone, status and status note, category counts and when your score was last updated. Never anything on your
        calendar, feeds or GitHub. You start Hidden in every team you join and decide, per team, whether leads or everyone can see
        your boiler. Members you cannot see are shown to leads only as an anonymous count, and not at all when fewer than two are
        hidden. Change it any time from <Link href="/teams">Teams</Link>.
      </>
    ),
  },
  {
    title: "Deleting your data",
    body: "For now, deletion is by email (below): we delete your account, tasks, scores, sources and tokens. You can remove a feed or GitHub token yourself at any time under Sources, which deletes its saved link or token and its done/size marks.",
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
          Questions or a deletion request? Email <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>.
        </p>
      </main>
    </div>
  );
}
