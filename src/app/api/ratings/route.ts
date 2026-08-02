import { NextResponse } from "next/server";
import { z } from "zod";
import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import {
  deleteUserRating,
  getPublicListsForPlace,
  getPublicPlaceByStableId,
  getTeamMembership,
  getUserRatingForPlace,
  upsertUserRating,
  type PlaceRecord,
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

type RatingContext =
  | {
      ok: true;
      place: PlaceRecord;
      role: "owner" | "member" | "viewer" | null;
      source: RatingSource;
      user: User;
    }
  | {
      ok: false;
      response: NextResponse;
    };

async function getRatingContext(request: Request, placeId: string): Promise<RatingContext> {
  const token = getBearerToken(request);

  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "请先登录后再评分。" }, { status: 401 }) };
  }

  const supabase = createSupabaseAdminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return { ok: false, response: NextResponse.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 }) };
  }

  const place = await getPublicPlaceByStableId(placeId);

  if (!place) {
    return { ok: false, response: NextResponse.json({ error: "店铺不存在。" }, { status: 404 }) };
  }

  const lists = await getPublicListsForPlace(place.id);
  const canPublicRate = lists.some((list) => list.visibility === "public_rate");
  const membership = await getTeamMembership(place.team_id, userData.user.id);
  const isTeamRater = membership?.role === "owner" || membership?.role === "member";
  const source: RatingSource = isTeamRater ? "team_member" : "external";

  if (!isTeamRater && !canPublicRate) {
    return { ok: false, response: NextResponse.json({ error: "这个榜单暂未开放外部评分。" }, { status: 403 }) };
  }

  return { ok: true, place, role: membership?.role ?? null, source, user: userData.user };
}

export async function GET(request: Request) {
  const placeId = new URL(request.url).searchParams.get("placeId");

  if (!placeId) {
    return NextResponse.json({ error: "缺少店铺参数。" }, { status: 400 });
  }

  const context = await getRatingContext(request, placeId);

  if (!context.ok) {
    return context.response;
  }

  const rating = await getUserRatingForPlace(context.place.id, context.user.id, context.source);

  return NextResponse.json({
    rating: rating
      ? {
          id: rating.id,
          score: rating.score,
          note: rating.note,
          source: rating.source,
        }
      : null,
    source: context.source,
    role: context.role,
  });
}

export async function POST(request: Request) {
  const parsed = RatingBody.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "评分参数不正确。" }, { status: 400 });
  }

  const context = await getRatingContext(request, parsed.data.placeId);

  if (!context.ok) {
    return context.response;
  }

  const existingRating = await getUserRatingForPlace(context.place.id, context.user.id, context.source);
  const rating = await upsertUserRating({
    existingRatingId: existingRating?.id,
    teamId: context.place.team_id,
    placeId: context.place.id,
    userId: context.user.id,
    raterLabel: getUserLabel(context.user),
    source: context.source,
    score: Number(parsed.data.score.toFixed(1)),
    note: parsed.data.note?.trim(),
  });

  return NextResponse.json({
    rating,
    source: context.source,
    role: context.role,
    message: existingRating ? "评分已更新。" : "评分已提交。",
  });
}

export async function DELETE(request: Request) {
  const placeId = new URL(request.url).searchParams.get("placeId");

  if (!placeId) {
    return NextResponse.json({ error: "缺少店铺参数。" }, { status: 400 });
  }

  const context = await getRatingContext(request, placeId);

  if (!context.ok) {
    return context.response;
  }

  const existingRating = await getUserRatingForPlace(context.place.id, context.user.id, context.source);

  if (!existingRating) {
    return NextResponse.json({ error: "还没有保存过这家店的评分。" }, { status: 404 });
  }

  await deleteUserRating(existingRating.id);

  return NextResponse.json({
    message: "评分已删除。",
  });
}
