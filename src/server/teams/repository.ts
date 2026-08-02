import "server-only";

import { createSupabaseAdminClient } from "@/server/supabase/admin";

export type TeamRole = "owner" | "member" | "viewer";

export type TeamMembership = {
  role: TeamRole;
};

export type TeamMemberRecord = {
  team_id: string;
  user_id: string;
  role: TeamRole;
};

export type TeamMemberWithProfileRecord = {
  user_id: string;
  role: TeamRole;
  created_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

export type TeamRecord = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
};

export async function getTeamBySlug(slug: string): Promise<TeamRecord | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id, slug, name, description")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as TeamRecord | null;
}

export async function getTeamMembership(teamId: string, userId: string): Promise<TeamMembership | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as TeamMembership | null;
}

export async function getTeamMembers(teamId: string): Promise<TeamMemberWithProfileRecord[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_members")
    .select(
      `
        user_id,
        role,
        created_at,
        profile:profiles!team_members_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `,
    )
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as TeamMemberWithProfileRecord[];
}

export async function upsertTeamMember(input: {
  teamId: string;
  userId: string;
  role: TeamRole;
}): Promise<TeamMemberRecord> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_members")
    .upsert(
      {
        team_id: input.teamId,
        user_id: input.userId,
        role: input.role,
      },
      {
        onConflict: "team_id,user_id",
      },
    )
    .select("team_id, user_id, role")
    .single();

  if (error) {
    throw error;
  }

  return data as TeamMemberRecord;
}

export async function deleteTeamMember(input: { teamId: string; userId: string }) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", input.teamId)
    .eq("user_id", input.userId);

  if (error) {
    throw error;
  }
}

export function canManageTeamContent(role: TeamRole | null | undefined) {
  return role === "owner" || role === "member";
}

export function canManageTeamMembers(role: TeamRole | null | undefined) {
  return role === "owner";
}
