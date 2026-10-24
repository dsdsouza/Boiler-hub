import type { SupabaseClient } from "@supabase/supabase-js";
import type { BoilerCard, Counts, EngineRoom, Role, Status, Visibility, Zone } from "@/lib/types";
import type { AssignmentInput, AssignmentTarget, TargetResult } from "@/app/api/teams/_lib/assignment";

// Query helpers for teams. Callers pass the clients in:
//   `supabase` is the per-request user client (RLS applies),
//   `admin` is the service-role client and is only passed AFTER the caller's
//   membership or lead role has been checked (CLAUDE.md rule 6).

export type TeamType = "class" | "work";

export interface MyTeam {
  id: string;
  name: string;
  type: TeamType;
  role: Role;
  visibility: Visibility;
  visibleCount: number; // boilers I can see, including mine
  hiddenCount: number;
  inviteCode?: string; // leads only
}

export interface TeamBoiler extends BoilerCard {
  synced: boolean; // false if the member has never synced (score/zone/counts are placeholders)
  isLead: boolean;
}

export interface EngineRoomView extends EngineRoom {
  boilers: TeamBoiler[];
  myUserId: string;
  myVisibility: Visibility;
  memberCount: number;
  inviteCode?: string; // leads only
}

// Row shape returned by rpc('team_boilers').
export interface TeamBoilerRow {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  score: number | null;
  zone: Zone | null;
  status: Status;
  status_note: string | null;
  counts: Partial<Counts> | null;
  updated_at: string | null;
}

export const EMPTY_COUNTS: Counts = { meetings: 0, meetingHours: 0, tasksDue: 0, overdue: 0 };

export function toTeamBoiler(row: TeamBoilerRow, leadIds: Set<string>): TeamBoiler {
  const synced = row.score !== null;
  return {
    userId: row.user_id,
    name: row.name?.trim() || "Unnamed",
    avatarUrl: row.avatar_url ?? undefined,
    score: row.score ?? 0,
    zone: row.zone ?? "cool",
    status: row.status,
    statusNote: row.status_note || undefined,
    counts: { ...EMPTY_COUNTS, ...(row.counts ?? {}) },
    updatedAt: row.updated_at ?? "",
    synced,
    isLead: leadIds.has(row.user_id),
  };
}

export function sortBoilers<T extends { score: number; synced: boolean; name: string }>(boilers: T[]): T[] {
  return [...boilers].sort(
    (a, b) => Number(b.synced) - Number(a.synced) || b.score - a.score || a.name.localeCompare(b.name),
  );
}

export async function getMembership(
  supabase: SupabaseClient,
  teamId: string,
  userId: string,
): Promise<{ role: Role; visibility: Visibility } | null> {
  const { data, error } = await supabase
    .from("memberships")
    .select("role, visibility")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { role: Role; visibility: Visibility } | null) ?? null;
}

async function visibleAndHidden(supabase: SupabaseClient, teamId: string) {
  const [boilers, hidden] = await Promise.all([
    supabase.rpc("team_boilers", { team_id: teamId }),
    supabase.rpc("team_hidden_count", { team_id: teamId }),
  ]);
  if (boilers.error) throw boilers.error;
  if (hidden.error) throw hidden.error;
  return { rows: (boilers.data ?? []) as TeamBoilerRow[], hiddenCount: (hidden.data as number) ?? 0 };
}

export async function listMyTeams(supabase: SupabaseClient, userId: string): Promise<MyTeam[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select("role, visibility, joined_at, teams(id, name, type, invite_code)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });
  if (error) throw error;

  type Row = {
    role: Role;
    visibility: Visibility;
    teams: { id: string; name: string; type: TeamType; invite_code: string } | null;
  };
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.teams);

  return Promise.all(
    rows.map(async (r) => {
      const t = r.teams!;
      const { rows: visible, hiddenCount } = await visibleAndHidden(supabase, t.id);
      return {
        id: t.id,
        name: t.name,
        type: t.type,
        role: r.role,
        visibility: r.visibility,
        visibleCount: visible.length,
        hiddenCount,
        inviteCode: r.role === "lead" ? t.invite_code : undefined,
      };
    }),
  );
}

// Engine Room: boilers come from team_boilers() only. The admin client is used solely to
// tag which of the already-visible members are leads, after the membership check.
export async function getEngineRoom(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  teamId: string,
  userId: string,
): Promise<EngineRoomView | null> {
  const me = await getMembership(supabase, teamId, userId);
  if (!me) return null;

  const [teamRes, { rows, hiddenCount }] = await Promise.all([
    supabase.from("teams").select("id, name, type, invite_code").eq("id", teamId).single(),
    visibleAndHidden(supabase, teamId),
  ]);
  if (teamRes.error) throw teamRes.error;
  const team = teamRes.data as { id: string; name: string; type: TeamType; invite_code: string };

  const leadIds = await getLeadIds(admin, teamId, rows.map((r) => r.user_id));

  return {
    team: { id: team.id, name: team.name, type: team.type },
    myRole: me.role,
    myVisibility: me.visibility,
    myUserId: userId,
    boilers: sortBoilers(rows.map((r) => toTeamBoiler(r, leadIds))),
    hiddenCount,
    memberCount: rows.length + hiddenCount,
    inviteCode: me.role === "lead" ? team.invite_code : undefined,
  };
}

async function getLeadIds(admin: SupabaseClient, teamId: string, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { data, error } = await admin
    .from("memberships")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("role", "lead")
    .in("user_id", userIds);
  if (error) throw error;
  return new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
}

// ---------------------------------------------------------------------------
// Admin-only helpers. Call ONLY after verifying the caller is a lead of teamId.
// ---------------------------------------------------------------------------

export async function countLeads(admin: SupabaseClient, teamId: string): Promise<number> {
  const { count, error } = await admin
    .from("memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("role", "lead");
  if (error) throw error;
  return count ?? 0;
}

export async function setMemberRole(
  admin: SupabaseClient,
  teamId: string,
  userId: string,
  role: Role,
): Promise<boolean> {
  const { data, error } = await admin
    .from("memberships")
    .update({ role })
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

export interface TargetWithCounts extends AssignmentTarget {
  counts: Counts | null;
}

// Assignment recipients: every non-lead member, hidden ones included.
// `visible` mirrors team_boilers() for a lead caller (visibility 'lead' or 'everyone').
export async function loadAssignmentTargets(admin: SupabaseClient, teamId: string): Promise<TargetWithCounts[]> {
  const { data: members, error } = await admin
    .from("memberships")
    .select("user_id, visibility")
    .eq("team_id", teamId)
    .eq("role", "member");
  if (error) throw error;
  const ms = (members ?? []) as { user_id: string; visibility: Visibility }[];
  if (ms.length === 0) return [];
  const ids = ms.map((m) => m.user_id);

  const [profiles, snapshots] = await Promise.all([
    admin.from("profiles").select("id, name").in("id", ids),
    admin.from("pressure_snapshots").select("user_id, raw, score, zone, counts").in("user_id", ids),
  ]);
  if (profiles.error) throw profiles.error;
  if (snapshots.error) throw snapshots.error;

  const names = new Map(((profiles.data ?? []) as { id: string; name: string | null }[]).map((p) => [p.id, p.name]));
  type Snap = { user_id: string; raw: number; score: number; zone: Zone; counts: Partial<Counts> | null };
  const snaps = new Map(((snapshots.data ?? []) as Snap[]).map((s) => [s.user_id, s]));

  return ms.map((m) => {
    const s = snaps.get(m.user_id);
    return {
      userId: m.user_id,
      name: names.get(m.user_id)?.trim() || "Unnamed",
      visible: m.visibility !== "hidden",
      raw: s?.raw ?? null,
      score: s?.score ?? null,
      zone: s?.zone ?? null,
      counts: s ? { ...EMPTY_COUNTS, ...(s.counts ?? {}) } : null,
    };
  });
}

// Creates the assignment, fans out one `team` task per recipient, then bumps each
// recipient's snapshot with the same math the preview used, so the posted result
// matches the preview.
// TODO(merge): once the engine's syncUser does a full recompute, the bump is redundant.
export async function createAssignment(
  admin: SupabaseClient,
  teamId: string,
  createdBy: string,
  input: AssignmentInput,
  targets: TargetWithCounts[],
  results: TargetResult[],
  now: Date,
): Promise<{ assignmentId: string }> {
  const { data: assignment, error } = await admin
    .from("team_assignments")
    .insert({ team_id: teamId, title: input.title, due_at: input.due, size: input.size, created_by: createdBy })
    .select("id")
    .single();
  if (error) throw error;
  const assignmentId = (assignment as { id: string }).id;

  if (targets.length > 0) {
    // Fresh assignment, so a plain insert; the partial unique index guards duplicates.
    const { error: taskError } = await admin.from("tasks").insert(
      targets.map((t) => ({
        owner_id: t.userId,
        title: input.title,
        due_at: input.due,
        size: input.size,
        source: "team",
        assignment_id: assignmentId,
      })),
    );
    if (taskError) {
      await admin.from("team_assignments").delete().eq("id", assignmentId);
      throw taskError;
    }
  }

  const dueWithinWeek = Date.parse(input.due) - now.getTime() <= 7 * 86_400_000;
  const countsById = new Map(targets.map((t) => [t.userId, t.counts]));
  const { error: snapError } = await admin.from("pressure_snapshots").upsert(
    results.map((r) => {
      const counts = countsById.get(r.userId) ?? EMPTY_COUNTS;
      return {
        user_id: r.userId,
        score: r.after,
        raw: r.rawAfter,
        zone: r.zoneAfter,
        counts: { ...counts, tasksDue: counts.tasksDue + (dueWithinWeek ? 1 : 0) },
        computed_at: now.toISOString(),
      };
    }),
    { onConflict: "user_id" },
  );
  if (snapError) throw snapError;

  return { assignmentId };
}
