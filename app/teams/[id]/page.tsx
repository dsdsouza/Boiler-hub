import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEngineRoom } from "@/lib/data/teams";
import { EngineRoom } from "../_components/EngineRoom";

export const dynamic = "force-dynamic";

// A fixed title: the team's name would need a second membership-checked lookup here.
export const metadata = { title: "Engine Room · Boilerplate" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EngineRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const { supabase, user } = await getCurrentUser();
  if (!user) redirect(`/?next=/teams/${id}`);

  // getEngineRoom checks membership with the user client before using the admin client.
  const room = await getEngineRoom(supabase, createAdminClient(), id, user.id);
  if (!room) notFound();

  return <EngineRoom room={room} />;
}
