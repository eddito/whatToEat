import "server-only";

import { createSupabaseAdminClient } from "@/server/supabase/admin";

export type TeamRole = "owner" | "member" | "viewer";

export type TeamMembership = {
  role: TeamRole;
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

export function canManageTeamContent(role: TeamRole | null | undefined) {
  return role === "owner" || role === "member";
}
