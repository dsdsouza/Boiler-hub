import type { Page } from '@playwright/test';

export async function inspectKeyboardFocus(page: Page) {
  const controls = page.locator('[data-qa-app] :is(button, input:not([type="hidden"]), select, textarea, summary, a[href]):visible:not(:disabled):not([aria-disabled="true"])');
  if (!await controls.count()) throw new Error('The app must expose controls for the focus inspection');
  await page.keyboard.press('Tab');
  const findings = [];
  for (const control of await controls.all()) {
    const before = await control.evaluate(el => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      const styles = [];
      for (let node: Element | null = el; node && !node.hasAttribute('data-qa-app'); node = node.parentElement) {
        const s = getComputedStyle(node); styles.push(s.borderColor);
      }
      return styles;
    });
    await control.focus();
    const focused = await control.evaluate((el, previous) => {
      const s = getComputedStyle(el);
      let indicator = parseFloat(s.outlineWidth) >= 2 && !['none', 'hidden'].includes(s.outlineStyle) && !['transparent', 'rgba(0, 0, 0, 0)'].includes(s.outlineColor);
      let i = 0;
      // A composer can deliberately put its focus indicator on the surrounding
      // group. Count only an actual painted border change after focus.
      for (let node: Element | null = el; node && !node.hasAttribute('data-qa-app'); node = node.parentElement, i++) {
        const style = getComputedStyle(node);
        if (parseFloat(style.borderWidth) >= 1 && !['none', 'hidden'].includes(style.borderStyle) && style.borderColor !== previous[i] && !['transparent', 'rgba(0, 0, 0, 0)'].includes(style.borderColor)) indicator = true;
      }
      return { active: document.activeElement === el, indicator, element: el.tagName.toLowerCase() + '[' + (el.getAttribute('aria-label') || el.id || el.classList[0]) + ']' };
    }, before);
    if (!focused.active || !focused.indicator) findings.push({ rule: 'keyboard-focus', element: focused.element, actual: `active=${focused.active}, visible indicator=${focused.indicator}` });
  }
  return findings;
}

/** Rendered checks, deliberately narrower than a complete accessibility audit.
 * No pixel baselines: these invariants also work across OS font rasterizers.
 */
export async function inspectUI(page: Page) {
  return page.evaluate(() => {
    type RGB = [number, number, number, number];
    const findings: { rule: string; element: string; actual: string }[] = [];
    const skipped = { complexPaint: 0, nativeColor: 0, translucentGroup: 0 };
    const seen = new Set<string>();
    const label = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.getAttribute('aria-label') ? '[' + el.getAttribute('aria-label') + ']' : ''}.${[...el.classList].slice(0, 2).join('.')}`;
    const add = (rule: string, el: Element, actual: string) => {
      const key = rule + label(el) + actual;
      if (!seen.has(key)) { findings.push({ rule, element: label(el), actual }); seen.add(key); }
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility === 'visible'
        && !el.closest('[hidden], [aria-hidden="true"], .sr-only')
        && ![el, ...ancestors(el)].some(a => Number(getComputedStyle(a).opacity) === 0);
    };
    function ancestors(el: Element) { const out: Element[] = []; for (let a = el.parentElement; a; a = a.parentElement) out.push(a); return out; }
    const rgba = (color: string): RGB | null => {
      const match = color.match(/^rgba?\(([^)]+)\)$/);
      if (!match) return null;
      const n = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      return [n[0], n[1], n[2], n[3] ?? 1];
    };
    const over = (front: RGB, back: RGB): RGB => [
      front[0] * front[3] + back[0] * (1 - front[3]),
      front[1] * front[3] + back[1] * (1 - front[3]),
      front[2] * front[3] + back[2] * (1 - front[3]), 1,
    ];
    const luminance = (rgb: RGB) => rgb.slice(0, 3).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4)
      .reduce((total, n, i) => total + n * [.2126, .7152, .0722][i], 0);
    const elements = [...document.querySelectorAll('body *')].filter(visible);
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > width + 1) add('horizontal-overflow', document.body, `${document.documentElement.scrollWidth}px > ${width}px`);
    const controls = elements.filter(el => el.matches('button, input:not([type="hidden"]), select, textarea, a.bp-button, summary'));
    for (const el of controls) {
      const style = getComputedStyle(el), rect = el.getBoundingClientRect();
      if (rect.left < -1 || rect.right > width + 1) add('control-outside-page', el, `${Math.round(rect.left)}..${Math.round(rect.right)} of ${width}px`);
      if (el.matches('.bp-button, .bp-field') && rect.height < 43.5 && !el.matches('[type="checkbox"], [type="radio"]')) add('shared-control-height', el, `${rect.height}px, expected at least 44px`);
      if (el.matches('.bp-field') && parseFloat(style.fontSize) < 16) add('field-text-size', el, `${style.fontSize}, expected at least 16px`);
      if (el.matches('.bp-field') && style.borderTopLeftRadius !== '10px') add('field-radius', el, `${style.borderTopLeftRadius}, expected 10px`);
      if (el.matches('button, a.bp-button, summary') && el.scrollWidth > el.clientWidth + 2) add('clipped-control-label', el, `${el.scrollWidth}px content in ${el.clientWidth}px`);
    }
    for (const el of elements) {
      if (el.matches('.bp-card') && getComputedStyle(el).borderTopLeftRadius !== '14px') add('card-radius', el, `${getComputedStyle(el).borderTopLeftRadius}, expected 14px`);
      // Inspect direct text, once per element. SVG text, native select options,
      // inactive controls and translucent groups need different paint models.
      if (!el.matches('svg *, option, script, style') && [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) {
        const chain = [el, ...ancestors(el)];
        if (chain.some(a => a.matches(':disabled, [aria-disabled="true"]'))) continue;
        if (chain.some(a => Number(getComputedStyle(a).opacity) < 1)) { skipped.translucentGroup++; continue; }
        if (chain.some(a => getComputedStyle(a).backgroundImage !== 'none' || getComputedStyle(a).filter !== 'none' || getComputedStyle(a).mixBlendMode !== 'normal')) { skipped.complexPaint++; continue; }
        let background: RGB = [255, 255, 255, 1];
        let valid = true;
        for (const a of [...chain].reverse()) { const color = rgba(getComputedStyle(a).backgroundColor); if (!color) { valid = false; break; } background = over(color, background); }
        const style = getComputedStyle(el), foreground = rgba(style.color);
        if (!valid || !foreground) { skipped.nativeColor++; continue; }
        const l = [luminance(over(foreground, background)), luminance(background)].sort((a, b) => b - a);
        const contrast = (l[0] + .05) / (l[1] + .05);
        const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.6667 && Number(style.fontWeight) >= 700);
        if (contrast < (large ? 3 : 4.5)) add('text-contrast', el, `${contrast.toFixed(2)}:1, expected ${large ? 3 : 4.5}:1; ${style.color} on ${background.slice(0, 3).map(Math.round).join(',')}`);
      }
    }
    return { findings, inspectedElements: elements.length, inspectedControls: controls.length, skipped,
      viewport: { width, height: innerHeight }, body: { background: getComputedStyle(document.body).backgroundColor, font: getComputedStyle(document.body).fontFamily } };
  });
}
