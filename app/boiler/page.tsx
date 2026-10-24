import type { Metadata } from "next";
import { Avatar, MobileTabBar, SiteHeader } from "@/components/ui/SiteHeader";
import { createClient } from "@/lib/supabase/server";
import { BoilerClient } from "./BoilerClient";

export const metadata: Metadata = { title: "My Boiler · Boilerplate" };

async function viewer(): Promise<{ name: string; avatarUrl: string | null } | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    const meta = data.user.user_metadata ?? {};
    return {
      name: String(meta.full_name ?? meta.name ?? data.user.email ?? "You"),
      avatarUrl: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
    };
  } catch {
    return null;
  }
}

export default async function BoilerPage() {
  const me = await viewer();
  return (
    <div className="min-h-screen">
      <SiteHeader
        variant="app"
        current="boiler"
        account={
          me && (
            <div className="flex items-center gap-2">
              <form action="/auth/signout" method="post" className="hidden sm:block">
                <button
                  type="submit"
                  className="min-h-11 cursor-pointer rounded-lg border-0 bg-transparent px-2 text-sm font-medium text-muted hover:text-fg"
                >
                  Sign out
                </button>
              </form>
              <Avatar name={me.name} url={me.avatarUrl} label={`Signed in as ${me.name}`} />
            </div>
          )
        }
      />
      <main className="mx-auto max-w-[1240px] px-4 pt-6 pb-28 sm:px-8 sm:pt-8 sm:pb-16">
        <BoilerClient />
      </main>
      <MobileTabBar current="boiler" />
    </div>
  );
}
