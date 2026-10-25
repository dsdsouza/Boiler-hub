import { SiteHeader, type NavKey } from "./SiteHeader";
import { FlameLoader } from "./FlameLoader";

export function PageLoading({ title = "page", current, shell = true }: { title?: string; current?: NavKey; shell?: boolean }) {
  const content = <main className="mx-auto grid min-h-[calc(100svh-160px)] max-w-[1240px] place-items-center px-4 py-12 sm:px-8" aria-busy="true">
    <FlameLoader size="lg" label={`Loading ${title.toLowerCase()}…`} />
  </main>;
  return shell ? <div className="min-h-screen"><SiteHeader variant="marketing" current={current} />{content}</div> : content;
}
