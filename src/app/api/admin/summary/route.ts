import { NextResponse } from "next/server";
import { getAdminContext } from "@/server/admin/context";

function getProfileName(profile: { display_name: string | null } | null) {
  return profile?.display_name || "未命名成员";
}

export async function GET(request: Request) {
  const context = await getAdminContext(request);

  if (!context.ok) {
    return context.response;
  }

  const [placesResult, listsResult, ratingsResult, membersResult] = await Promise.all([
    context.supabase.from("places").select("id", { count: "exact", head: true }).eq("team_id", context.team.id),
    context.supabase.from("lists").select("id", { count: "exact", head: true }).eq("team_id", context.team.id),
    context.supabase.from("ratings").select("id", { count: "exact", head: true }).eq("team_id", context.team.id),
    context.supabase
      .from("team_members")
      .select("role, created_at, profiles(display_name)")
      .eq("team_id", context.team.id)
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
      name: context.team.name,
      slug: context.team.slug,
    },
    currentUser: {
      id: context.user.id,
      role: context.membership.role,
      name:
        context.user.user_metadata?.username ||
        context.user.user_metadata?.display_name ||
        context.user.email ||
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
