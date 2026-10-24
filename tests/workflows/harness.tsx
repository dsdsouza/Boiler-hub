"use client";
// Copied into a disposable Next checkout only. Never imported by the app.
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useMyBoiler } from '@/components/boiler/useMyBoiler';
import { MyBoilerView } from '@/components/boiler/MyBoilerView';
import { OnboardingClient } from '@/app/onboarding/OnboardingClient';
import { CreateTeamForm, JoinTeamForm } from '@/app/teams/_components/TeamForms';
import { VisibilityPicker } from '@/app/teams/_components/VisibilityPicker';
import { EngineRoom } from '@/app/teams/_components/EngineRoom';
import { SourcesSettings } from '@/components/sources/SourcesSettings';
import type { MyTeam, EngineRoomView } from '@/lib/data/teams';
import type { SourceInfo } from '@/lib/pressure/api-types';

function BoilerScreen() { const boiler = useMyBoiler('api'); return <MyBoilerView boiler={boiler} />; }
function Workflows() {
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const view = params.get('view') || 'boiler', team = params.get('team');
  const [teams, setTeams] = useState<MyTeam[] | null>(null);
  const [room, setRoom] = useState<EngineRoomView | null>(null);
  const [sources, setSources] = useState<SourceInfo[] | null>(null);
  useEffect(() => {
    let active = true;
    setTeams(null); setRoom(null); setSources(null);
    if (view === 'teams') void fetch('/api/teams').then(r => r.json()).then(r => { if (active) setTeams(r.teams); });
    if (view === 'engine' && team) void fetch(`/api/teams/${team}/engine-room`).then(r => r.json()).then(r => { if (active) setRoom(r); });
    if (view === 'sources') void fetch('/api/sources').then(r => r.json()).then(r => { if (active) setSources(r.sources); });
    return () => { active = false; };
  }, [view, team]);
  if (!ready) return <p role="status">Starting the local workflow…</p>;
  return <div className="mx-auto max-w-[1240px] px-4 py-8">
    <nav aria-label="Workflow pages" className="mb-6 flex flex-wrap gap-5">
      {['boiler', 'teams', 'sources', 'onboarding'].map(v => <Link key={v} href={`/qa-workflows?view=${v}`}>{v}</Link>)}
    </nav>
    {view === 'boiler' && <BoilerScreen />}
    {view === 'onboarding' && <OnboardingClient />}
    {view === 'teams' && <main><h1>Teams</h1><div className="flex flex-wrap gap-6"><CreateTeamForm /><JoinTeamForm /></div>
      {teams?.map(t => <article key={t.id} className="my-6 rounded-lg border border-line p-6">
        <Link href={`/qa-workflows?view=engine&team=${t.id}`}>{t.name}</Link>
        <VisibilityPicker teamId={t.id} value={t.visibility} leadLabel={t.type === 'class' ? 'Teacher' : 'Lead'} />
      </article>)}
    </main>}
    {view === 'engine' && room && <EngineRoom room={room} />}
    {view === 'sources' && sources && <main><h1>Sources</h1><SourcesSettings initial={sources} /></main>}
  </div>;
}
function FixtureRouter({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // These service fixtures live in the browser. A Next server refresh cannot
  // read that state. Tests use fresh document/API reads as explicit checkpoints;
  // production server refresh behavior is covered by live signed-in navigation.
  const fixtureRouter = useMemo(() => ({ ...router, refresh: () => {} }), [router]);
  return <AppRouterContext.Provider value={fixtureRouter}>{children}</AppRouterContext.Provider>;
}
export default function Harness() { return <Suspense><FixtureRouter><Workflows /></FixtureRouter></Suspense>; }
