// Runs before React: a missing bootstrap chunk must not leave an inert page.
// One cache-bypassing reload per five minutes, then an explicit retry link.
export const deploymentRecovery = `(() => {
  let recovering = false;
  let leaving = false;
  const inspecting = new Set();
  addEventListener('beforeunload', () => { leaving = true; });
  addEventListener('pagehide', () => { leaving = true; });
  addEventListener('pageshow', () => { leaving = false; });
  function inspect(src) {
    const url = new URL(src, location.href);
    if (leaving || recovering || inspecting.has(url.href) || url.origin !== location.origin || !url.pathname.startsWith('/_next/static/')) return;
    inspecting.add(url.href);
    // Firefox also emits resource errors when navigation cancels a request.
    // Confirm an HTTP failure before replacing a page that may be healthy.
    fetch(url.href, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' })
      .then((response) => { if (!leaving && response.status >= 400) recover(); })
      .catch(() => {});
  }
  function recover() {
    if (recovering) return;
    recovering = true;
    const key = 'boilerplate:asset-recovery';
    const now = Date.now();
    let previous = Number(new URL(location.href).searchParams.get('__boiler_reload')) || 0;
    try { previous = Math.max(previous, Number(sessionStorage.getItem(key)) || 0); } catch {}
    const url = new URL(location.href);
    url.searchParams.set('__boiler_reload', String(now));
    if (now - previous > 300000) {
      try { sessionStorage.setItem(key, String(now)); } catch {}
      location.replace(url.href);
    } else {
      function notice() {
        const banner = document.createElement('div');
        banner.setAttribute('role', 'alert');
        banner.style.cssText = 'position:fixed;inset:0 0 auto;z-index:2147483647;padding:16px;background:#f6e7c9;color:#241b10;font:16px system-ui';
        banner.append('A site update could not load. ');
        const retry = document.createElement('a');
        retry.href = url.href;
        retry.textContent = 'Reload Boilerplate';
        banner.append(retry);
        document.body.append(banner);
      }
      if (document.body) notice(); else addEventListener('DOMContentLoaded', notice, { once: true });
    }
  }
  addEventListener('error', (event) => {
    const element = event.target;
    const src = element && (element.src || element.href);
    if (src && (element.tagName === 'SCRIPT' || (element.tagName === 'LINK' && element.rel === 'stylesheet'))) inspect(src);
  }, true);
  addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason && reason.request && /ChunkLoadError|Loading (?:CSS )?chunk .+ failed/.test(String(reason.message || reason))) inspect(reason.request);
  });
})();`;
