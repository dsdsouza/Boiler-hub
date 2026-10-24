import { AccountMenu } from "@/components/ui/Account";
import { MobileTabBar, SiteHeader } from "@/components/ui/SiteHeader";

// Fonts, theme tokens and the app header come from the ui track (app/layout.tsx, components/ui).
export default function TeamsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader variant="app" current="teams" account={<AccountMenu />} />
      {children}
      <MobileTabBar current="teams" />
    </div>
  );
}
