import "server-only";

import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export const TEAM_SLUG = "what-to-eat";

export type AdminRole = "owner" | "member" | "viewer";

type AdminTeam = {
  id: string;
  name: string;
  slug: string;
};

type AdminMembership = {
  role: AdminRole;
};

export type AdminContext =
  | {
      ok: true;
      membership: AdminMembership;
      supabase: SupabaseClient;
      team: AdminTeam;
      user: User;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

export async function getAdminContext(request: Request): Promise<AdminContext> {
  const token = getBearerToken(request);

  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "请先登录后再进入后台。" }, { status: 401 }) };
  }

  const supabase = createSupabaseAdminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return { ok: false, response: NextResponse.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 }) };
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name, slug")
    .eq("slug", TEAM_SLUG)
    .maybeSingle();

  if (teamError) {
    throw teamError;
  }

  if (!team) {
    return { ok: false, response: NextResponse.json({ error: "小队不存在。" }, { status: 404 }) };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", team.id)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (!membership) {
    return { ok: false, response: NextResponse.json({ error: "当前账号不是小队成员，无法访问后台。" }, { status: 403 }) };
  }

  return {
    ok: true,
    membership: membership as AdminMembership,
    supabase,
    team: team as AdminTeam,
    user: userData.user,
  };
}

export function canEditTeamData(role: AdminRole) {
  return role === "owner" || role === "member";
}

export function canManageListPermissions(role: AdminRole) {
  return role === "owner";
}

export function canManageMembers(role: AdminRole) {
  return role === "owner";
}
