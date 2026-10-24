import { test, expect, type Page, type Request } from '@playwright/test';

const walks = Number(process.env.QA_EXPLORE_WALKS ?? 2);
const steps = Number(process.env.QA_EXPLORE_STEPS ?? 60);
const baseSeed = Number(process.env.QA_EXPLORE_SEED ?? Date.now() % 2_147_483_647);
if (![walks, steps, baseSeed].every((n) => Number.isInteger(n) && n > 0) || walks > 100 || steps > 200) throw new Error('Invalid signed-in exploration limits');
function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x ^= x + Math.imul(x ^ x >>> 7, 61 | x); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
}
async function inventory(page: Page) {
  return page.evaluate(() => {
    const visible = (e: Element) => {
      if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return false;
      let closed = e.closest('details:not([open])');
      while (closed) {
        if (![...closed.children].find((c) => c.tagName === 'SUMMARY')?.contains(e)) return false;
        closed = closed.parentElement?.closest('details:not([open])') ?? null;
      }
      return true;
    };
    return {
      buttons: [...document.querySelectorAll('button')].map((e, index) => ({ index, name: e.getAttribute('aria-label') ?? e.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        active: visible(e) && !e.disabled && e.getAttribute('aria-disabled') !== 'true' && e.getAttribute('aria-pressed') !== 'true' } )).filter((e) => e.active),
      summaries: [...document.querySelectorAll('summary')].map((e, index) => ({ index, visible: visible(e), name: e.textContent ?? '' })).filter((e) => e.visible),
      selects: [...document.querySelectorAll('select')].map((e, index) => ({ index, name: e.getAttribute('aria-label') ?? e.id,
        visible: visible(e) && !e.disabled, options: [...e.options].filter((o) => !o.selected && !o.disabled).map((o) => o.value) })).filter((e) => e.visible),
      links: [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(visible).map((e) => e.href),
      note: [...document.querySelectorAll('input')].some((e) => visible(e) && [...(e.labels ?? [])].some((l) => l.textContent === 'Status note (shown to your teams)')),
      task: Boolean(document.querySelector('#nt')),
      assignment: Boolean(document.querySelector('#a-title')),
      width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll('main p, main h1')].filter((e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 3).map((e) => e.tagName).slice(0, 3),
    };
  });
}

for (let walk = 0; walk < walks; walk++) test(`signed-in walk ${walk + 1}`, async ({ page, request }, info) => {
  const origin = new URL(info.project.use.baseURL as string).origin;
  const seed = baseSeed + walk * 7919 + [...info.project.name].reduce((n, c) => n + c.charCodeAt(0), 0);
  const rng = random(seed), used = new Map<string, number>();
  const history: { step: number; action: string; path: string }[] = [];
  const findings: { step: number; kind: string }[] = [];
  const paths = new Set<string>(), pending = new Set<Request>();
  const prefix = `QA explore ${info.project.name} ${baseSeed} ${walk}`;
  const ownTaskIds = new Set<string>();
  const teamId = info.project.metadata.teamId as string | undefined;
  const record = (kind: string) => { if (!findings.some((f) => f.kind === kind)) findings.push({ step: history.length, kind }); };
  const isAPI = (url: string) => new URL(url).pathname.startsWith('/api/');
  page.on('pageerror', () => record('runtime-error'));
  page.on('request', (r) => { if (isAPI(r.url())) pending.add(r); });
  page.on('requestfinished', (r) => pending.delete(r));
  page.on('requestfailed', (r) => pending.delete(r));
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    // A navigation can abandon a read without a final network event. The old
    // document's GET/preview response is irrelevant to the new document. Keep
    // owner writes tracked until they finish, including during cleanup.
    for (const r of pending) if (r.method() === 'GET' || new URL(r.url()).pathname.endsWith('/assignments/preview')) pending.delete(r);
  });
  page.on('response', (r) => { if (isAPI(r.url()) && r.status() >= 500) record('server-error'); });
  page.on('dialog', (dialog) => { record('unexpected-dialog'); void dialog.dismiss(); });
  const initialResponse = await request.get('/api/me/boiler');
  expect(initialResponse.status()).toBe(200);
  const original = await initialResponse.json();
  const teams = await (await request.get('/api/teams')).json();
  const originalVisibility = teams.teams.find((t: { id: string }) => t.id === teamId)?.visibility;
  const settle = async () => {
    try { await expect.poll(() => pending.size, { timeout: 25_000 }).toBe(0); }
    catch { throw new Error(`Unsettled app requests: ${[...pending].map((r) => `${r.method()} ${new URL(r.url()).pathname}`).join(', ')}`); }
  };
  try {
    await page.goto('/boiler');
    const tasks = page.getByRole('region', { name: 'Tasks', exact: true });
    await expect(tasks).toBeVisible();
    await tasks.getByRole('textbox', { name: 'New task', exact: true }).fill(prefix);
    const created = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/tasks' && r.request().method() === 'POST');
    await tasks.getByRole('button', { name: 'Add task', exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    ownTaskIds.add((await response.json()).task.id);
    await settle();
    for (let step = 0; step < steps; step++) {
      paths.add(new URL(page.url()).pathname);
      const state = await inventory(page);
      const actions: { key: string; run: () => Promise<unknown> }[] = [];
      const offer = (key: string, run: () => Promise<unknown>) => actions.push({ key, run });
      for (const b of state.buttons) {
        // Mutate only this walk's disposable tasks and this synthetic identity's status.
        const safe = /^(Open for work|Heads down|Running hot|Away|Refresh|See what|Hide Pip|Show Pip|Dress up|Show all|Any status|All ·|Redline ·|Hot ·|Working ·|Cool ·|Draft another|\+ New assignment|Subscribe in Apple Calendar|Cancel|.*how to connect|Apple Calendar|Brightspace|Other calendar|GitHub)/i.test(b.name);
        if (safe || ((b.name.startsWith('Complete: ') || b.name.startsWith('Mark not done: ')) && b.name.includes(prefix))) offer(`click:${b.name}`, () => page.locator('button').nth(b.index).click());
      }
      for (const s of state.summaries) offer(`disclose:${s.name}`, () => page.locator('summary').nth(s.index).click());
      for (const s of state.selects) {
        if (s.name.startsWith('Size:') && !s.name.includes(prefix)) continue;
        for (const value of s.options) offer(`select:${s.name}:${value}`, async () => {
          await page.locator('select').nth(s.index).selectOption(value);
          if (s.name.startsWith('Size:')) await page.waitForTimeout(800);
        });
      }
      if (state.note) for (const value of ['', 'Exploring Δ 中文', 'x'.repeat(80)]) offer(`note:${value.slice(0, 12)}`, async () => {
        const note = page.getByRole('textbox', { name: 'Status note (shown to your teams)', exact: true });
        await note.fill(value); await note.press('Enter');
      });
      if (state.task) for (const value of [' ', 'x'.repeat(120), '<b>Δ 中文</b>']) offer(`task-draft:${value.slice(0, 10)}`, () => page.getByRole('textbox', { name: 'New task', exact: true }).fill(value));
      if (state.assignment) for (const value of ['', 'x'.repeat(200), 'Explore draft']) offer(`assignment-draft:${value.slice(0, 10)}`, () => page.locator('#a-title').fill(value));
      for (const href of new Set(state.links)) {
        const u = new URL(href);
        if (u.origin === origin && ['/', '/boiler', '/teams', '/settings/sources', '/onboarding', '/how', ...(teamId ? [`/teams/${teamId}`] : [])].includes(u.pathname)) offer(`navigate:${u.pathname}`, () => page.goto(href));
      }
      if (step % 6 === 5) {
        for (const width of [320, 390, 768, 1280]) offer(`resize:${width}`, () => page.setViewportSize({ width, height: 900 }));
        offer('reload', () => page.reload());
      }
      const weights = actions.map((a) => 1 / (1 + (used.get(a.key) ?? 0)) ** 3);
      let ticket = rng() * weights.reduce((a, b) => a + b, 0);
      let action = actions.at(-1)!;
      for (let i = 0; i < actions.length; i++) { ticket -= weights[i]!; if (ticket <= 0) { action = actions[i]!; break; } }
      if (!action) break;
      history.push({ step, action: action.key, path: new URL(page.url()).pathname });
      used.set(action.key, (used.get(action.key) ?? 0) + 1);
      await action.run(); await settle();
      const after = await inventory(page);
      if (after.scroll > after.width + 1 || after.overflow.length) record('layout-overflow');
      if (new URL(page.url()).pathname === '/boiler') {
        const body = await (await request.get('/api/me/boiler')).json();
        const gauge = page.getByRole('region', { name: 'Gauge and status', exact: true }).getByRole('img');
        await expect(gauge).toHaveAttribute('aria-label', new RegExp(`pressure ${body.result.score},`));
        await expect(page.getByRole('button', { name: ({ open: 'Open for work', heads_down: 'Heads down', running_hot: 'Running hot', away: 'Away' } as Record<string, string>)[body.status.status], exact: true })).toHaveAttribute('aria-pressed', 'true');
      }
      if ((step + 1) % 20 === 0) console.log(`Signed-in walk: ${step + 1} actions, ${findings.length} findings`);
    }
  } finally {
    // Wait for browser writes before restoration. Never alter seeded fixture tasks.
    await settle().catch(() => record('unsettled-requests'));
    const current = await (await request.get('/api/me/boiler')).json();
    for (const t of current.tasks ?? []) if (t.title.startsWith(prefix) && t.source === 'manual') ownTaskIds.add(t.id);
    for (const id of ownTaskIds) expect((await request.delete(`/api/tasks/${id}`)).status()).toBe(200);
    expect((await request.patch('/api/me/status', { data: original.status })).status()).toBe(200);
    if (teamId && originalVisibility) expect((await request.patch(`/api/teams/${teamId}/membership`, { data: { visibility: originalVisibility } })).status()).toBe(200);
    // This file stays private: no cookies, response bodies, screenshots or traces.
    await info.attach('signed-exploration.json', { body: JSON.stringify({ baseSeed, seed, walk, steps: history.length, paths: [...paths], uniqueActions: used.size, findings, history }), contentType: 'application/json' });
  }
  expect(history.length).toBe(steps);
  expect(findings).toEqual([]);
});
