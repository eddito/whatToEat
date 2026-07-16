import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import {
  getPublicListsForPlace,
  getPublicPlaceByStableId,
  getTeamMembership,
  getUserRatingForPlace,
  upsertUserRating,
  type RatingSource,
} from "@/server/places/repository";

const RatingBody = z.object({
  placeId: z.string().min(1),
  score: z.number().min(1).max(5),
  note: z.string().max(500).optional(),
});

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

function getUserLabel(user: { email?: string; user_metadata?: Record<string, unknown> }) {
  const username = user.user_metadata?.username;
  const displayName = user.user_metadata?.display_name;

  if (typeof username === "string" && username.trim()) {
    return username.trim();
  }

  if (typeof displayName === "string" && displayName.trim()) {
    return displayName.trim();
  }

  return user.email ?? "登录用户";
}

export async function POST(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "请先登录后再评分。" }, { status: 401 });
  }

  const parsed = RatingBody.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "评分参数不正确。" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  }

  const place = await getPublicPlaceByStableId(parsed.data.placeId);

  if (!place) {
    return NextResponse.json({ error: "店铺不存在。" }, { status: 404 });
  }

  const lists = await getPublicListsForPlace(place.id);
  const canPublicRate = lists.some((list) => list.visibility === "public_rate");
  const membership = await getTeamMembership(place.team_id, userData.user.id);
  const isTeamRater = membership?.role === "owner" || membership?.role === "member";
  const source: RatingSource = isTeamRater ? "team_member" : "external";

  if (!isTeamRater && !canPublicRate) {
    return NextResponse.json({ error: "这个榜单暂未开放外部评分。" }, { status: 403 });
  }

  const existingRating = await getUserRatingForPlace(place.id, userData.user.id, source);
  const rating = await upsertUserRating({
    existingRatingId: existingRating?.id,
    teamId: place.team_id,
    placeId: place.id,
    userId: userData.user.id,
    raterLabel: getUserLabel(userData.user),
    source,
    score: Number(parsed.data.score.toFixed(1)),
    note: parsed.data.note?.trim(),
  });

  return NextResponse.json({
    rating,
    source,
    message: existingRating ? "评分已更新。" : "评分已提交。",
  });
}
