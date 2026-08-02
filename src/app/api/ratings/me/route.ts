import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { getUserRatingHistory, type ListVisibility, type UserRatingHistoryRecord } from "@/server/places/repository";

const PUBLIC_VISIBILITIES: ListVisibility[] = ["public_view", "public_rate"];

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

function normalizeSingle<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getStablePlaceId(place: { id: string; import_key: string | null }) {
  return place.import_key ?? place.id;
}

function toHistoryItem(row: UserRatingHistoryRecord, memberTeamIds: Set<string>) {
  const place = normalizeSingle(row.places);

  if (!place) {
    return null;
  }

  const canSeePrivateList = memberTeamIds.has(place.team_id);
  const lists = (place.list_places ?? [])
    .map((listPlace) => normalizeSingle(listPlace.lists))
    .filter((list): list is { slug: string; name: string; visibility: ListVisibility } => Boolean(list));
  const visibleLists = canSeePrivateList ? lists : lists.filter((list) => PUBLIC_VISIBILITIES.includes(list.visibility));
  const list = visibleLists[0] ?? null;

  if (!list) {
    return null;
  }

  return {
    id: row.id,
    score: Number(row.score),
    note: row.note,
    source: row.source,
    updatedAt: row.updated_at,
    place: {
      id: getStablePlaceId(place),
      name: place.name,
      category: place.category ?? "",
      region: place.region ?? "",
    },
    list: {
      slug: list.slug,
      name: list.name,
      visibility: list.visibility,
    },
  };
}

export async function GET(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "请先登录后查看评分历史。" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userData.user.id);

  if (membershipError) {
    throw membershipError;
  }

  const memberTeamIds = new Set((memberships ?? []).map((membership) => membership.team_id));
  const ratings = await getUserRatingHistory(userData.user.id);

  return NextResponse.json({
    ratings: ratings.map((rating) => toHistoryItem(rating, memberTeamIds)).filter(Boolean),
  });
}
