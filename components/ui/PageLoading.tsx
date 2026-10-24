import { MobileTabBar, SiteHeader, type NavKey } from "./SiteHeader";

export function PageLoading({ title, current, shell = true }: { title: string; current: NavKey; shell?: boolean }) {
  const content = <main className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 py-8 sm:px-8" aria-busy="true">
    <h1 className="m-0 font-display text-[44px] leading-none text-fg sm:text-[56px]">{title}</h1>
    <p role="status" className="m-0 text-sm text-muted">Loading {title.toLowerCase()}…</p>
    <div aria-hidden="true" className="grid animate-pulse grid-cols-1 gap-4 motion-reduce:animate-none sm:grid-cols-2">
      {[0, 1].map(key => <div key={key} className="h-52 rounded-xl border border-line bg-surface" />)}
    </div>
  </main>;
  return shell ? <div className="min-h-screen"><SiteHeader variant="app" current={current} />{content}<MobileTabBar current={current} /></div> : content;
}
