import Link from "next/link";
import { Bebas_Neue, Inter, JetBrains_Mono } from "next/font/google";
import { C } from "./_theme";
import "./plate.css";

const display = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-mono" });

// TODO(merge): drop the fonts and header here once the ui track's root layout provides them.
export default function TeamsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen font-[family-name:var(--font-body)]`}
      style={{ backgroundColor: C.bg, color: C.text }}
    >
      <header style={{ borderBottom: `1px solid ${C.line}`, backgroundColor: "#1A1611" }}>
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-8">
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/" className="flex items-center gap-2.5 no-underline" style={{ color: C.text }}>
              <svg width="30" height="30" viewBox="0 0 34 34" aria-hidden="true">
                <circle cx="17" cy="17" r="14" fill="none" stroke={C.brass} strokeWidth="3" />
                <line x1="17" y1="17" x2="25" y2="10" stroke="#F0913A" strokeWidth="3" strokeLinecap="round" />
                <circle cx="17" cy="17" r="3" fill={C.brass} />
              </svg>
              <span className="font-[family-name:var(--font-display)] text-[26px] leading-none tracking-[0.06em]">
                Boilerplate
              </span>
            </Link>
            <nav aria-label="App" className="flex flex-wrap gap-1 text-[15px]">
              <Link href="/boiler" className="inline-flex min-h-11 items-center px-3.5 font-medium" style={{ color: C.text2 }}>
                My Boiler
              </Link>
              <Link
                href="/teams"
                aria-current="page"
                className="inline-flex min-h-11 items-center px-3.5 font-semibold"
                style={{ color: C.text, borderBottom: `2px solid ${C.brass}` }}
              >
                Teams
              </Link>
              <Link href="/how" className="inline-flex min-h-11 items-center px-3.5 font-medium" style={{ color: C.text2 }}>
                How it works
              </Link>
            </nav>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="min-h-11 px-3 text-sm" style={{ color: C.muted }}>
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
