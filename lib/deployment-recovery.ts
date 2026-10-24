// Runs before React: a missing bootstrap chunk must not leave an inert page.
// One cache-bypassing reload per five minutes, then an explicit retry link.
export const deploymentRecovery = `(() => {
  let recovering = false;
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
    if (src && new URL(src, location.href).pathname.startsWith('/_next/static/') &&
        (element.tagName === 'SCRIPT' || (element.tagName === 'LINK' && element.rel === 'stylesheet'))) recover();
  }, true);
  addEventListener('unhandledrejection', (event) => {
    if (/ChunkLoadError|Loading (?:CSS )?chunk .+ failed/.test(String(event.reason && (event.reason.message || event.reason)))) recover();
  });
})();`;
