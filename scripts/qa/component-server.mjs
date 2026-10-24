import { mkdtemp, mkdir, cp, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

// The harness exists only in a disposable local checkout. No QA route or fake
// authentication is added to the shipped app, and no environment files are copied.
const root = process.cwd();
const directory = await mkdtemp(join(tmpdir(), 'boilerplate-component-qa-'));
for (const name of ['app', 'components', 'lib', 'fixtures', 'public', 'package.json', 'tsconfig.json', 'next.config.ts', 'postcss.config.mjs']) {
  await cp(resolve(root, name), join(directory, name), { recursive: true });
}
await symlink(resolve(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
const route = join(directory, 'app', 'qa-components');
await mkdir(route, { recursive: true });
await writeFile(join(route, 'page.tsx'), `"use client";
import { useEffect, useState } from 'react';
import { useMyBoiler } from '@/components/boiler/useMyBoiler';
import { MyBoilerView } from '@/components/boiler/MyBoilerView';
import { VisibilityPicker } from '@/app/teams/_components/VisibilityPicker';
import { CreateTeamForm, JoinTeamForm } from '@/app/teams/_components/TeamForms';
import { EngineRoom } from '@/app/teams/_components/EngineRoom';
import { OnboardingClient } from '@/app/onboarding/OnboardingClient';
export default function Harness() {
 const boiler = useMyBoiler('api');
 const [mode, setMode] = useState('boiler');
 useEffect(() => setMode(new URLSearchParams(location.search).get('mode') || 'boiler'), []);
 const team = {id:'00000000-0000-4000-a000-000000000001', name:'x'.repeat(80), type:'work' as const};
 return <main className="mx-auto max-w-[1240px] px-4 py-8">
  {mode === 'boiler' && <MyBoilerView boiler={boiler} />}
  {mode === 'visibility' && <VisibilityPicker teamId={team.id} value="everyone" leadLabel="Lead" />}
  {mode === 'forms' && <div className="flex flex-wrap gap-6"><CreateTeamForm /><JoinTeamForm /></div>}
  {mode === 'engine' && <EngineRoom room={{team, myRole:'member', myUserId:'qa', myVisibility:'hidden', memberCount:0, hiddenCount:0, boilers:[]}} />}
  {mode === 'onboarding' && <OnboardingClient />}
 </main>;
}
`);
const workflowRoute = join(directory, 'app', 'qa-workflows');
await mkdir(workflowRoute, { recursive: true });
await cp(resolve(root, 'tests/workflows/harness.tsx'), join(workflowRoute, 'page.tsx'));
const child = spawn(resolve(root, 'node_modules/.bin/next'), ['dev', '--hostname', '127.0.0.1', '--port', process.env.QA_COMPONENT_PORT || '3219'], {
  cwd: directory, stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'https://qa-project.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'qa-anon-placeholder' },
});
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { if (!stopping) { stopping = true; child.kill(signal); } });
const code = await new Promise((ok) => { child.on('error', () => ok(1)); child.on('exit', (code) => ok(code ?? (stopping ? 0 : 1))); });
await rm(directory, { recursive: true, force: true });
process.exitCode = code;
