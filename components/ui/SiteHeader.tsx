import Link from "next/link";
import { Suspense } from "react";
import { LinkPending } from "./LinkPending";
import { FlameLoader } from "./FlameLoader";

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2.5 text-fg no-underline hover:text-fg">
      <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r="14" fill="none" stroke="#D1A85A" strokeWidth="3" />
        <line x1="17" y1="17" x2="25" y2="10" stroke="#F0913A" strokeWidth="3" strokeLinecap="round" />
        <circle cx="17" cy="17" r="3" fill="#D1A85A" />
      </svg>
      <span className="font-display text-[26px] leading-none tracking-[0.06em] sm:text-[28px]">Boilerplate</span>
    </Link>
  );
}

export type NavKey = "boiler" | "calendar" | "teams" | "sources" | "how" | "demo";

const APP_NAV: { key: NavKey; href: string; label: string }[] = [
  { key: "boiler", href: "/boiler", label: "My Boiler" },
  { key: "calendar", href: "/calendar", label: "Calendar" },
  { key: "teams", href: "/teams", label: "Teams" },
  { key: "sources", href: "/settings/sources", label: "Sources" },
  { key: "how", href: "/how", label: "Help" },
];

function NavLink({ href, label, current, prefetch }: { href: string; label: string; current: boolean; prefetch?: boolean }) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={`bp-control relative inline-flex min-h-11 items-center whitespace-nowrap rounded-t-lg border-b-2 px-3.5 text-[15px] font-medium no-underline ${
        current ? "border-brass bg-surface text-fg hover:text-fg" : "border-transparent text-body hover:bg-surface hover:text-fg"
      }`}
    >
      {label}
      <LinkPending label={label} />
    </Link>
  );
}

/**
 * All sessions share the same navigation, dimensions and palette.
 * `app` uses <MobileTabBar> on phones; `marketing` keeps links in the header.
 * On phones the app nav moves to <MobileTabBar>, unless mobileNavigation is "header".
 */
export function SiteHeader({
  variant,
  current,
  account,
  mobileNavigation = "bottom",
}: {
  variant: "app" | "marketing";
  current?: NavKey;
  /** Right-most slot: avatar or sign-in link. */
  account?: React.ReactNode;
  /** Keep app links in the header on public pages, including phones and tablets. */
  mobileNavigation?: "header" | "bottom";
}) {
  const nav = APP_NAV;
  const headerNavigation = mobileNavigation === "header";
  const desktopVisibility = headerNavigation ? "hidden lg:flex" : variant === "app" ? "hidden sm:flex" : "hidden md:flex";
  return (
    <header className="border-b border-line bg-bg-2">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-1 gap-y-3 px-4 py-2.5 sm:gap-3 sm:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-5">
          <Logo />
          <nav aria-label="Main" className={`${desktopVisibility} flex-wrap gap-1`}>
            {nav.map((n) => (
              <NavLink key={n.key} href={n.href} label={n.label} current={current === n.key} prefetch={variant === "app" ? true : undefined} />
            ))}
          </nav>
        </div>
        {account && <div className="flex h-11 shrink-0 items-center gap-2"><Suspense fallback={<FlameLoader size="sm" label="Loading account…" />}>{account}</Suspense></div>}
        {(variant === "marketing" || headerNavigation) && (
          <nav aria-label="Main" className={`w-full gap-1 border-t border-line pt-1 ${headerNavigation ? "grid grid-cols-2 sm:flex sm:flex-wrap lg:hidden" : "flex flex-wrap md:hidden"}`}>
            {nav.map((n) => (
              <NavLink key={n.key} href={n.href} label={n.label} current={current === n.key} prefetch={variant === "app" ? true : undefined} />
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

export function Avatar({
  name,
  url,
  color = "#C47A45",
  ink = "#15120E",
  size = 40,
  label,
}: {
  name: string;
  url?: string | null;
  color?: string;
  ink?: string;
  size?: number;
  /** Accessible name; decorative when omitted. */
  label?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={label ?? ""} width={size} height={size} className="flex-none rounded-full outline outline-1 -outline-offset-1 outline-white/10" referrerPolicy="no-referrer" />;
  }
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="flex flex-none items-center justify-center rounded-full text-sm font-bold"
      style={{ width: size, height: size, backgroundColor: color, color: ink }}
    >
      {initials}
    </span>
  );
}

/** Phone-only bottom tab bar (Phone.dc.html). */
export function MobileTabBar({ current }: { current?: NavKey }) {
  const tabs: { key: NavKey; href: string; label: string; icon: React.ReactNode }[] = [
    {
      key: "boiler",
      href: "/boiler",
      label: "Boiler",
      icon: (
        <>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 13l4-4" />
        </>
      ),
    },
    { key: "calendar", href: "/calendar", label: "Calendar", icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></> },
    {
      key: "teams",
      href: "/teams",
      label: "Teams",
      icon: (
        <>
          <circle cx="8" cy="9" r="3" />
          <circle cx="16" cy="9" r="3" />
          <path d="M3 19c1-3 3-4 5-4s4 1 5 4M11 19c1-3 3-4 5-4s4 1 5 4" />
        </>
      ),
    },
    {
      key: "sources",
      href: "/settings/sources",
      label: "Sources",
      icon: (
        <>
          <path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7" />
        </>
      ),
    },
    {
      key: "how",
      href: "/how",
      label: "Help",
      icon: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7.5v.5" />
        </>
      ),
    },
  ];
  return (
    <nav
      aria-label="App"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-bg-2 pb-[max(env(safe-area-inset-bottom),8px)] sm:hidden"
    >
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          prefetch={true}
          aria-label={t.label}
          aria-current={current === t.key ? "page" : undefined}
          className={`bp-control relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold no-underline ${
            current === t.key ? "text-brass-ink after:absolute after:top-0 after:h-0.5 after:w-8 after:rounded-full after:bg-brass hover:text-brass-ink" : "text-muted hover:text-fg"
          }`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {t.icon}
          </svg>
          {t.label}
          <LinkPending label={t.label} />
        </Link>
      ))}
    </nav>
  );
}
