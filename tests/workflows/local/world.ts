import type { BrowserContext } from '@playwright/test';
import type { BoilerResponse, Task, SourceInfo } from '../../../lib/pressure/api-types';
import type { Status, Visibility } from '../../../lib/types';
import { parseDraft, resolvedGoal, type OnboardingDraft } from "../../../app/onboarding/model";
import { computePressure } from '../../../lib/pressure/compute';

// Resettable service model, shared by two independent browser contexts.
// No requests, credentials or state from this fixture can reach a live backend.
export function world() {
  const users = ['lead', 'member'].map((key, i) => ({ key, id: `00000000-0000-4000-a000-${String(i + 1).padStart(12, '0')}`, name: `Workflow ${key}`,
    status: { status: 'open' as Status, note: '' }, tasks: [] as Task[], sources: [] as SourceInfo[], feedPath: null as string | null, onboarding: null as OnboardingDraft | null }));
  type User = typeof users[number];
  const teams: { id: string; name: string; type: 'class' | 'work'; inviteCode: string; members: { user: User; role: 'lead' | 'member'; visibility: Visibility }[] }[] = [];
  let sequence = 10;
  const id = () => `00000000-0000-4000-a000-${String(sequence++).padStart(12, '0')}`;
  const failures = new Map<string, number>();
  const writes: string[] = [];
  const snapshot = (u: User): BoilerResponse => ({ tasks: structuredClone(u.tasks), events: [], sources: u.sources,
    status: { ...u.status }, calendar: 'ok', computedAt: new Date().toISOString(), result: pressure(u.tasks) });
  const pressure = (tasks: Task[]) => computePressure(tasks.map(t => ({ id: t.id, title: t.title, source: t.source,
    kind: 'task' as const, due: t.dueAt ?? undefined, doneAt: t.doneAt, size: t.size })), new Date());
  const preview = (team: typeof teams[number], body: { title: string; due: string; size: Task['size'] }) => ({
    members: team.members.filter(m => m.role === 'member' && m.visibility !== 'hidden').map(({ user }) => {
      const before = pressure(user.tasks), after = pressure([...user.tasks, { id: 'draft', title: body.title, dueAt: body.due, size: body.size, source: 'team', assignmentId: 'draft', doneAt: null }]);
      return { userId: user.id, name: user.name, before: before.score, after: after.score, zoneBefore: before.zone, zoneAfter: after.zone };
    }), hidden: { count: 0, intoRedline: 0 }, noRecentData: [], recipients: team.members.filter(m => m.role === 'member').length,
  });
  async function connect(context: BrowserContext, actor = 'lead', pipInstalled = true) {
    if (pipInstalled) await context.addInitScript(() => window.addEventListener('message', event => { if (event.data?.type === 'bp-extension:ping' && event.data.extension === 'focus') window.postMessage({ type: 'bp-extension:pong', extension: 'focus', nonce: event.data.nonce, version: '0.3.2' }, location.origin); }));
    const user = users.find(u => u.key === actor)!;
    // The floating companion now owns chat. Supply a local, synthetic browser
    // session as well as the service fixtures; no test auth reaches Supabase.
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expires })).toString('base64url')}.fixture`;
    const session = { access_token: token, refresh_token: 'fixture-only', token_type: 'bearer', expires_in: 3600, expires_at: expires, user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: `${actor}@example.test`, app_metadata: {}, user_metadata: {} } };
    await context.addCookies([{ name: 'sb-qa-project-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), url: `http://localhost:${process.env.QA_COMPONENT_PORT || '3219'}`, sameSite: 'Lax' }]);
    await context.route('https://qa-project.supabase.co/**', route => new URL(route.request().url()).pathname === '/auth/v1/user'
      ? route.fulfill({ json: session.user })
      : route.fulfill({ status: 503, json: { error: 'Reading unavailable' } }));
    await context.route('**/api/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
      if (method !== 'GET') writes.push(`${actor} ${method} ${path}`);
      const fail = `${method} ${path}`;
      if ((failures.get(fail) ?? 0) > 0) {
        failures.set(fail, failures.get(fail)! - 1);
        return route.fulfill({ status: 503, json: { error: 'Workflow service temporarily unavailable. Try again.' } });
      }
      const body = request.postData() ? request.postDataJSON() : {};
      const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
      if (path === '/api/me/onboarding/check') return reply({ boiler: { ...snapshot(user), sources: [{ id: 'fixture-school', kind: 'ics', label: 'Fictional school calendar', coursework: true, status: 'ok', error: null, lastSyncedAt: new Date().toISOString() }] }, reviewReceipt: 'fixture-review' });
      if (path === '/api/me/onboarding') {
        if (method === 'PATCH') {
          if ((body.autosave || body.expectedUserId !== undefined) && body.expectedUserId !== user.id) return reply({ error: 'Your account changed. Reload onboarding before saving more answers.' }, 409);
          if (body.autosave && body.draft?.finished) return reply({ error: 'Use Finish setup to complete onboarding.' }, 400);
          if (body.draft?.finished && ((body.extensionVersion !== '0.3.2' && body.draft.extensionDeferred !== true) || (body.draft.role === 'student' && (body.reviewReceipt !== 'fixture-review' || body.deadlinesReviewed !== true)))) return reply({ error: 'Verify Pip and review coursework first' }, 400);
          user.onboarding = { ...parseDraft(body.draft), ownerId: user.id };
          if (user.onboarding.finished) {
            user.name = user.onboarding.name;
            user.status = { status: user.onboarding.status, note: user.onboarding.note };
            if (resolvedGoal(user.onboarding) === 'deadlines' && user.onboarding.milestone.trim()) {
              const existing = user.tasks.find(task => task.id === `${user.id}-onboarding`);
              const task: Task = { id: `${user.id}-onboarding`, title: user.onboarding.milestone, dueAt: body.deadlineAt, size: 'M', doneAt: null, source: 'manual', assignmentId: null };
              if (existing) Object.assign(existing, task); else user.tasks.push(task);
            }
          }
          return reply({ saved: true });
        }
        return reply({ userId: user.id, draft: user.onboarding });
      }
      if (path === '/api/me/boiler'  || path === '/api/sync') return reply(snapshot(user));
      if (path === '/api/me/status') { user.status = { ...user.status, ...body }; return reply(user.status); }
      if (path === '/api/pip/chat') return route.fulfill({ contentType: 'application/x-ndjson',
        body: JSON.stringify({ type: 'delta', text: 'Workflow: start with the dated deliverable.' }) + '\n' + JSON.stringify({ type: 'done', asOf: new Date().toISOString() }) + '\n' });
      if (path === '/api/tasks') {
        const task: Task = { id: id(), title: body.title, dueAt: body.due_at ?? null, size: body.size ?? 'M', doneAt: null, source: 'manual', assignmentId: null };
        user.tasks.push(task); return reply({ task, boiler: snapshot(user) }, 201);
      }
      if (path.startsWith('/api/tasks/')) {
        const task = user.tasks.find(t => t.id === path.split('/').at(-1));
        if (!task) return reply({ error: 'Not found' }, 404);
        if (method === 'DELETE') user.tasks = user.tasks.filter(t => t !== task);
        else Object.assign(task, { ...(body.size ? { size: body.size } : {}), ...(body.done !== undefined ? { doneAt: body.done ? new Date().toISOString() : null } : {}) });
        return reply({ task, boiler: snapshot(user) });
      }
      if (path === '/api/teams' && method === 'POST') {
        const team = { id: id(), name: body.name, type: body.type, inviteCode: 'WF1234', members: [{ user, role: 'lead' as const, visibility: 'hidden' as const }] };
        teams.push(team); return reply({ team }, 201);
      }
      if (path === '/api/teams' && method === 'GET') return reply({ teams: teams.filter(t => t.members.some(m => m.user === user)).map(t => ({ ...t, members: undefined,
        role: t.members.find(m => m.user === user)!.role, visibility: t.members.find(m => m.user === user)!.visibility })) });
      if (path === '/api/teams/join') {
        const team = teams.find(t => t.inviteCode === body.code.trim().toUpperCase());
        if (!team) return reply({ error: 'No team found for that invite code' }, 404);
        if (!team.members.some(m => m.user === user)) team.members.push({ user, role: 'member', visibility: 'hidden' });
        return reply({ teamId: team.id });
      }
      if (path.startsWith('/api/teams/')) {
        const team = teams.find(t => t.id === path.split('/')[3]);
        const self = team?.members.find(m => m.user === user);
        if (!team || !self) return reply({ error: 'Not a member' }, 403);
        if (path.endsWith('/membership')) { self.visibility = body.visibility; return reply({}); }
        if (path.endsWith('/engine-room')) return reply({ team: { id: team.id, name: team.name, type: team.type },
          myRole: self.role, myUserId: user.id, myVisibility: self.visibility, memberCount: team.members.filter(m => m.role === 'member').length,
          hiddenCount: 0, inviteCode: self.role === 'lead' ? team.inviteCode : undefined,
          boilers: team.members.filter(m => m.user === user || m.visibility === 'everyone' || (self.role === 'lead' && m.visibility === 'lead')).map(m => ({
            userId: m.user.id, name: m.user.name, ...m.user.status, statusNote: m.user.status.note,
            score: pressure(m.user.tasks).score, zone: pressure(m.user.tasks).zone, counts: pressure(m.user.tasks).counts,
            updatedAt: new Date().toISOString(), synced: true, isLead: m.role === 'lead' })) });
        if (self.role !== 'lead') return reply({ error: 'Lead only' }, 403);
        if (path.endsWith('/assignments/preview')) return reply(preview(team, body));
        if (path.endsWith('/assignments')) {
          const result = preview(team, body), assignmentId = id();
          for (const m of team.members.filter(m => m.role === 'member')) m.user.tasks.push({ id: id(), title: body.title, dueAt: body.due, size: body.size, doneAt: null, source: 'team', assignmentId });
          return reply({ assignmentId, duplicate: false, result }, 201);
        }
      }
      if (path === '/api/sources' && method === 'GET') return reply({ sources: user.sources });
      if (path === '/api/sources' && method === 'POST') {
        const source: SourceInfo = { id: id(), kind: 'ics', label: body.label || 'Workflow feed', coursework: body.coursework, status: 'ok', error: null, lastSyncedAt: new Date().toISOString() };
        user.sources.push(source); return reply({ source, itemCount: 1, tasks: 1, events: 0, boiler: snapshot(user) }, 201);
      }
      if (path.startsWith('/api/sources/')) {
        const source = user.sources.find(s => s.id === path.split('/')[3]);
        if (!source) return reply({ error: 'Not found' }, 404);
        if (method === 'DELETE') { user.sources = user.sources.filter(s => s !== source); return reply({}); }
        return reply({ source, ok: true, itemCount: 1, tasks: 1, events: 0, error: null });
      }
      if (path === '/api/calendar/subscription') {
        if (method === 'POST') user.feedPath = `/api/calendar/feed/${'a'.repeat(64)}.ics`;
        if (method === 'DELETE') user.feedPath = null;
        return reply({ feedPath: user.feedPath }, method === 'POST' ? 201 : 200);
      }
      return reply({ error: 'Unexpected workflow request' }, 501);
    });
  }
  return { users, teams, writes, connect, failOnce: (path: string) => failures.set(path, 1),
    reset: () => { teams.length = 0; for (const u of users) { u.tasks.length = 0; u.sources.length = 0; u.feedPath = null; } } };
}
