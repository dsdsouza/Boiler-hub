import Link from "next/link";

/** Site-wide footer, rendered once by app/layout.tsx. Extra bottom space on phones clears <MobileTabBar>. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-3 px-4 pt-7 pb-24 text-sm text-muted sm:px-8 sm:pb-7">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/how">How it works</Link>
          <Link href="/demo">Try the demo</Link>
        </nav>
      </div>
    </footer>
  );
}
