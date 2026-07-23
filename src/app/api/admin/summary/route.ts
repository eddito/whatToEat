import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

const TEAM_SLUG = "what-to-eat";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

function getProfileName(profile: { display_name: string | null } | null) {
  return profile?.display_name || "未命名成员";
}

export async function GET(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "请先登录后再进入后台。" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
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
    return NextResponse.json({ error: "小队不存在。" }, { status: 404 });
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
    return NextResponse.json({ error: "当前账号不是小队成员，无法访问后台。" }, { status: 403 });
  }

  const [placesResult, listsResult, ratingsResult, membersResult] = await Promise.all([
    supabase.from("places").select("id", { count: "exact", head: true }).eq("team_id", team.id),
    supabase.from("lists").select("id", { count: "exact", head: true }).eq("team_id", team.id),
    supabase.from("ratings").select("id", { count: "exact", head: true }).eq("team_id", team.id),
    supabase
      .from("team_members")
      .select("role, created_at, profiles(display_name)")
      .eq("team_id", team.id)
      .order("created_at", { ascending: true }),
  ]);

  const error = placesResult.error || listsResult.error || ratingsResult.error || membersResult.error;

  if (error) {
    throw error;
  }

  const members = (membersResult.data ?? []).map((member) => {
    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;

    return {
      name: getProfileName(profile),
      role: member.role,
      joinedAt: member.created_at,
    };
  });

  return NextResponse.json({
    team: {
      name: team.name,
      slug: team.slug,
    },
    currentUser: {
      id: userData.user.id,
      role: membership.role,
      name:
        userData.user.user_metadata?.username ||
        userData.user.user_metadata?.display_name ||
        userData.user.email ||
        "当前账号",
    },
    stats: {
      places: placesResult.count ?? 0,
      lists: listsResult.count ?? 0,
      ratings: ratingsResult.count ?? 0,
      members: members.length,
    },
    members,
  });
}
