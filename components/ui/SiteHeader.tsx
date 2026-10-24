import Link from "next/link";
import { ThemeToggle } from "./Toggles";

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <Link href="/" className="flex min-h-11 items-center gap-2.5 text-fg no-underline hover:text-fg">
      <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r="14" fill="none" stroke="#D1A85A" strokeWidth="3" />
        <line x1="17" y1="17" x2="25" y2="10" stroke="#F0913A" strokeWidth="3" strokeLinecap="round" />
        <circle cx="17" cy="17" r="3" fill="#D1A85A" />
      </svg>
      <span className="font-display text-[26px] leading-none tracking-[0.06em] sm:text-[28px]">Boilerplate</span>
    </Link>
  );
}

export type NavKey = "boiler" | "teams" | "sources" | "how" | "demo";

const APP_NAV: { key: NavKey; href: string; label: string }[] = [
  { key: "boiler", href: "/boiler", label: "My Boiler" },
  { key: "teams", href: "/teams", label: "Teams" },
  { key: "sources", href: "/settings/sources", label: "Sources" },
  { key: "how", href: "/how", label: "How it works" },
];

const MARKETING_NAV: { key: NavKey; href: string; label: string }[] = [
  { key: "how", href: "/how", label: "How it works" },
  { key: "demo", href: "/demo", label: "Demo" },
];

function NavLink({ href, label, current }: { href: string; label: string; current: boolean }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`inline-flex min-h-11 items-center px-3.5 text-[15px] no-underline ${
        current ? "border-b-2 border-brass font-semibold text-fg hover:text-fg" : "font-medium text-body hover:text-fg"
      }`}
    >
      {label}
    </Link>
  );
}

/**
 * `app` is the signed-in shell (My Boiler / Teams / How, theme toggle, avatar);
 * `marketing` is the landing and demo shell (How / Demo, sign-in).
 * On phones the app nav moves to <MobileTabBar>.
 */
export function SiteHeader({
  variant,
  current,
  account,
  maxWidth = "max-w-[1240px]",
}: {
  variant: "app" | "marketing";
  current?: NavKey;
  /** Right-most slot: avatar or sign-in link. */
  account?: React.ReactNode;
  maxWidth?: string;
}) {
  const nav = variant === "app" ? APP_NAV : MARKETING_NAV;
  return (
    <header className={`border-b border-line ${variant === "app" ? "bg-bg-2" : ""}`}>
      <div className={`mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-8 ${maxWidth}`}>
        <div className="flex flex-wrap items-center gap-5">
          <Logo />
          <nav aria-label="Main" className={`${variant === "app" ? "hidden sm:flex" : "hidden md:flex"} flex-wrap gap-1`}>
            {nav.map((n) => (
              <NavLink key={n.key} href={n.href} label={n.label} current={current === n.key} />
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {account}
        </div>
        {variant === "marketing" && (
          <nav aria-label="Main" className="flex w-full flex-wrap gap-1 border-t border-line pt-1 md:hidden">
            {nav.map((n) => (
              <NavLink key={n.key} href={n.href} label={n.label} current={current === n.key} />
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
    return <img src={url} alt={label ?? ""} width={size} height={size} className="flex-none rounded-full" referrerPolicy="no-referrer" />;
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
      label: "How",
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
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-bg-2 pb-[max(env(safe-area-inset-bottom),8px)] sm:hidden"
    >
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={current === t.key ? "page" : undefined}
          className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold no-underline ${
            current === t.key ? "text-brass-ink hover:text-brass-ink" : "text-muted hover:text-fg"
          }`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {t.icon}
          </svg>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
