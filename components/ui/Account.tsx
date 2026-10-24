import { createClient } from "@/lib/supabase/server";
import { Avatar } from "./SiteHeader";

export interface Viewer {
  name: string;
  avatarUrl: string | null;
}

/** The signed-in user's name and Google avatar, or null when signed out or Supabase is not configured. */
export async function getViewer(): Promise<Viewer | null> {
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

/** Right-hand slot of the app header: sign out plus avatar. Renders nothing when signed out. */
export async function AccountMenu() {
  const me = await getViewer();
  if (!me) return null;
  return (
    <div className="flex items-center gap-2">
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="min-h-11 cursor-pointer rounded-lg border-0 bg-transparent px-2 text-sm font-medium text-muted hover:text-fg"
        >
          Sign out
        </button>
      </form>
      <Avatar name={me.name} url={me.avatarUrl} label={`Signed in as ${me.name}`} />
    </div>
  );
}
