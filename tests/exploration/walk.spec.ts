import { test, expect, type Page } from '@playwright/test';

const walks = Number(process.env.QA_EXPLORE_WALKS ?? 8);
const steps = Number(process.env.QA_EXPLORE_STEPS ?? 60);
const baseSeed = Number(process.env.QA_EXPLORE_SEED ?? Date.now() % 2_147_483_647);
for (const [label, n, max] of [['walks', walks, 100], ['steps', steps, 200], ['seed', baseSeed, 2_147_483_647]] as const) {
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`Invalid exploration ${label}`);
}
function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x ^= x + Math.imul(x ^ x >>> 7, 61 | x); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
}
const pressure = (page: Page) => page.getByRole('region', { name: 'Gauge and status', exact: true }).getByRole('img');
async function score(page: Page) { return Number((await pressure(page).getAttribute('aria-label'))?.match(/pressure (\d+)/)?.[1]); }

async function inspect(page: Page) {
  return page.evaluate(() => {
    const visible = (e: Element | null | undefined) => {
      if (!e || !e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return false;
      // Engines can retain layout boxes for closed <details> descendants.
      // Only their summary is actionable until the explorer opens the panel.
      let closed = e.closest('details:not([open])');
      while (closed) {
        if (![...closed.children].find((c) => c.tagName === 'SUMMARY')?.contains(e)) return false;
        closed = closed.parentElement?.closest('details:not([open])') ?? null;
      }
      return true;
    };
    const number = (e?: Element | null) => Number(e?.getAttribute('aria-label')?.match(/pressure (\d+)/)?.[1]);
    const gauge = [...document.querySelectorAll('[aria-label="Gauge and status"] [role="img"]')].find(visible);
    const today = [...document.querySelectorAll('section[aria-labelledby="fc"] li')].find(visible);
    const card = [...document.querySelectorAll('[aria-label="Product Squad boilers"] article')].find((e) => e.querySelector('h2')?.textContent === 'Maya');
    const title = document.querySelector<HTMLInputElement>('#at');
    return {
      buttons: [...document.querySelectorAll('button')].map((node, index) => ({ index,
        visible: visible(node) && !node.disabled, name: node.getAttribute('aria-label') ?? node.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        pressed: node.getAttribute('aria-pressed'), busy: node.getAttribute('aria-busy') })).filter((b) => b.visible),
      summaries: [...document.querySelectorAll('summary')].map((node, index) => ({ index, visible: visible(node), name: node.textContent ?? '' })).filter((s) => s.visible),
      selects: [...document.querySelectorAll('select')].map((node, index) => ({ index, visible: visible(node), name: node.getAttribute('aria-label') ?? node.id,
        options: [...node.options].filter((o) => !o.selected && !o.disabled).map((o) => o.value) })).filter((s) => s.visible),
      checks: [...document.querySelectorAll<HTMLInputElement>('input[type=checkbox]')].map((node, index) => ({ index, visible: visible(node), name: node.labels?.[0]?.textContent?.trim() ?? String(index) })).filter((c) => c.visible),
      note: [...document.querySelectorAll<HTMLInputElement>('input')].some((node) => visible(node) && [...(node.labels ?? [])].some((l) => l.textContent?.trim() === 'Status note (shown to your teams)')),
      task: visible(document.querySelector('#nt')), title: visible(title), titleValue: title?.value.trim(),
      slider: visible(document.querySelector('input[type=range]:not(:disabled)')),
      links: [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(visible).map((n) => n.href),
      width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll('main p')].filter((e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 3).slice(0, 3).map((e) => e.textContent?.slice(0, 90)),
      personal: gauge ? number(gauge) : null, today: today?.textContent?.trim(),
      team: card && visible(card) ? number(card.querySelector('[role="img"]')) : null,
      workTeam: visible(document.querySelector('[aria-label="Product Squad boilers"]')),
      previewing: Boolean(title?.value.trim()),
    };
  });
}

type Action = { key: string; run: () => Promise<unknown> };

for (let walk = 0; walk < walks; walk++) {
  test(`explore walk ${walk + 1}`, async ({ page }, info) => {
    const seed = (baseSeed + walk * 7919 + [...info.project.name].reduce((n, c) => n + c.charCodeAt(0), 0)) >>> 0;
    const rng = random(seed);
    const history: { step: number; action: string; path: string }[] = [];
    const findings: { step: number; kind: string; detail: string }[] = [];
    const used = new Map<string, number>();
    const errors: string[] = [];
    const paths = new Set<string>();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('dialog', (dialog) => { findings.push({ step: history.length, kind: 'unexpected-dialog', detail: dialog.message() }); void dialog.dismiss(); });
    page.on('response', (r) => { if (new URL(r.url()).pathname.startsWith('/_next/static/') && r.status() >= 400) errors.push(`Missing app asset: ${r.status()} ${new URL(r.url()).pathname}`); });
    const record = (kind: string, detail: string) => {
      if (!findings.some((f) => f.kind === kind && f.detail === detail)) findings.push({ step: history.length, kind, detail });
    };
    await page.goto('/demo');
    await expect(pressure(page)).toBeVisible();
    try {
      for (let step = 0; step < steps; step++) {
        paths.add(new URL(page.url()).pathname);
        const actions: Action[] = [];
        const offer = (key: string, run: Action['run']) => actions.push({ key, run });
        // Inventory changes after every action. New controls become candidates as
        // panels, completed tasks, teams and wardrobe choices are revealed.
        const inventory = await inspect(page);
        for (const b of inventory.buttons) {
          if (!b.name || b.busy === 'true' || /Sign in|Import|Connect|Copy|Enable sound/i.test(b.name)) continue;
          if (b.pressed === 'true') continue;
          offer(`click:${b.name}`, () => page.locator('button').nth(b.index).click({ timeout: 8000 }));
        }
        for (const summary of inventory.summaries) {
          offer(`disclose:${summary.name}`, () => page.locator('summary').nth(summary.index).click({ timeout: 8000 }));
        }
        for (const select of inventory.selects) {
          for (const option of select.options) offer(`select:${select.name}:${option}`, () => page.locator('select').nth(select.index).selectOption(option, { timeout: 8000 }));
        }
        for (const check of inventory.checks) offer(`check:${check.name}`, () => page.locator('input[type=checkbox]').nth(check.index).click({ timeout: 8000 }));
        const note = page.getByRole('textbox', { name: 'Status note (shown to your teams)', exact: true });
        if (inventory.note) {
          for (const text of ['', 'Exploring Δ 中文', 'x'.repeat(80), '  spaced note  ']) offer(`note:${text.slice(0, 16)}`, async () => { await note.fill(text); await note.press('Enter'); });
        }
        const task = page.getByRole('textbox', { name: 'New task', exact: true });
        if (inventory.task) {
          for (const value of ['Exploration task', 'x'.repeat(120), '  ', '<b>Δ 中文</b>']) offer(`task-title:${value.slice(0, 16)}`, () => task.fill(value));
        }
        const assignment = page.getByRole('complementary', { name: 'New assignment', exact: true });
        const title = assignment.getByRole('textbox', { name: 'Title', exact: true });
        if (inventory.title) {
          for (const value of ['', 'Explore assignment', 'x'.repeat(200), '<svg>Δ</svg>']) offer(`assignment-title:${value.slice(0, 16)}`, () => title.fill(value));
        }
        const slider = page.getByRole('slider');
        if (inventory.slider) {
          for (const key of ['Home', 'End', 'ArrowLeft', 'ArrowRight']) offer(`slider:${key}`, () => slider.press(key));
        }
        // Only follow public same-origin links discovered from the current page.
        for (const href of [...new Set(inventory.links)]) {
          const url = new URL(href);
          if (url.origin === new URL(page.url()).origin && ['/', '/demo', '/how'].includes(url.pathname)) offer(`navigate:${url.pathname}${url.hash}`, () => page.goto(href));
        }
        if (step % 8 === 7) {
          for (const width of [320, 390, 768, 1280]) offer(`resize:${width}`, () => page.setViewportSize({ width, height: 900 }));
          offer('reload', () => page.reload());
          offer('keyboard:Tab', () => page.keyboard.press('Tab'));
        }
        // Prefer new edges, then revisit controls in changed state. The chooser
        // is seeded, so a path can be reproduced against the same app state.
        const weights = actions.map((a) => 1 / (1 + (used.get(a.key) ?? 0)) ** 3);
        let ticket = rng() * weights.reduce((a, b) => a + b, 0);
        let selected = actions.at(-1)!;
        for (let i = 0; i < actions.length; i++) { ticket -= weights[i]!; if (ticket <= 0) { selected = actions[i]!; break; } }
        if (!selected) break;
        used.set(selected.key, (used.get(selected.key) ?? 0) + 1);
        history.push({ step, action: selected.key, path: new URL(page.url()).pathname });
        const comparesBeforeAfter = /^(click:(Complete:|Away|Heads down|Running hot|Open for work)|note:)/.test(selected.key);
        const personalBefore = comparesBeforeAfter ? await score(page) : inventory.personal;
        const postedTitle = selected.key.startsWith('click:Post to ') && inventory.workTeam ? inventory.titleValue : null;
        try { await selected.run(); } catch (e) { record('action-failed', `${selected.key}: ${(e as Error).message.slice(0, 1800)}`); }
        // Finish the size control's 600ms debounce before measuring a later
        // status action; otherwise unrelated queued work can change its score.
        if (selected.key.startsWith('select:Size:')) await page.waitForTimeout(800);
        // A background WebKit page may suspend animation frames. Use a bounded
        // settle here; assertions below read the resulting DOM rather than wait
        // indefinitely for a decorative animation.
        await page.waitForTimeout(30);
        // Read related values in one browser task: a debounced size update must
        // not land between separate gauge and forecast observations.
        const layout = await inspect(page);
        if (layout.scroll > layout.width + 1) record('horizontal-overflow', `${layout.width}px viewport expands to ${layout.scroll}px`);
        if (layout.overflow.length) record('clipped-copy', layout.overflow.join(' | '));
        if (layout.personal !== null) {
          const value = layout.personal;
          if (personalBefore !== null && /^(click:(Away|Heads down|Running hot|Open for work)|note:)/.test(selected.key) && value !== personalBefore) record('status-changes-pressure', `${personalBefore} to ${value}`);
          if (personalBefore !== null && selected.key.startsWith('click:Complete:') && value > personalBefore) record('completion-increases-pressure', `${personalBefore} to ${value}`);
          if (postedTitle && await page.getByRole('button', { name: `Complete: ${postedTitle}`, exact: true }).count() === 0) record('assignment-missing', 'Posting to Product Squad did not add Maya’s task');
          if (!Number.isInteger(value) || value < 0 || value > 100) record('invalid-pressure', String(value));
          if (!layout.today?.includes(`Today: ${value},`)) record('forecast-disagrees', `Gauge ${value}; ${layout.today}`);
          if (layout.team !== null && !layout.previewing && layout.team !== value) record('personal-team-disagree', `Personal ${value}; Maya team card ${layout.team}`);
        }
        for (const message of errors.splice(0)) record('browser-error', message);
        if ((step + 1) % 20 === 0) console.log(`Exploration ${info.project.name}/${walk + 1}: ${step + 1} actions, ${findings.length} findings`);
      }
    } finally {
      const evidence = { baseSeed, seed, walk, project: info.project.name, steps: history.length, paths: [...paths], uniqueActions: used.size, findings, history };
      await info.attach('exploration.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
    }
    expect(findings, `Base seed ${baseSeed}, walk ${walk + 1}, ${info.project.name}; see exploration.json for the discovered path`).toEqual([]);
  });
}
