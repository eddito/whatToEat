import "server-only";

import { createSupabaseAdminClient } from "@/server/supabase/admin";
import type { ListVisibility, RatingSource } from "@/server/places/repository";

export type RatingTarget = {
  placeId: string;
  teamId: string;
  publicLists: Array<{
    id: string;
    slug: string;
    visibility: ListVisibility;
  }>;
};

export type RatingRecord = {
  id: string;
  source: RatingSource;
  score: number;
  note: string | null;
  updated_at: string;
};

export type AdminRatingRecord = RatingRecord & {
  user_id: string | null;
  rater_label: string | null;
  created_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getRatingTarget(stablePlaceId: string): Promise<RatingTarget | null> {
  const supabase = createSupabaseAdminClient();
  const placeQuery = supabase.from("places").select("id, team_id");
  const { data: place, error: placeError } = UUID_PATTERN.test(stablePlaceId)
    ? await placeQuery.eq("id", stablePlaceId).maybeSingle()
    : await placeQuery.eq("import_key", stablePlaceId).maybeSingle();

  if (placeError) {
    throw placeError;
  }

  if (!place) {
    return null;
  }

  const { data: listRows, error: listsError } = await supabase
    .from("list_places")
    .select(
      `
      lists (
        id,
        slug,
        visibility
      )
    `,
    )
    .eq("place_id", place.id);

  if (listsError) {
    throw listsError;
  }

  const publicLists = listRows
    .map((row) => (Array.isArray(row.lists) ? row.lists[0] : row.lists))
    .filter((list) => list && ["public_view", "public_rate"].includes(list.visibility)) as RatingTarget["publicLists"];

  return {
    placeId: place.id,
    teamId: place.team_id,
    publicLists,
  };
}

export async function upsertUserRating(input: {
  teamId: string;
  placeId: string;
  userId: string;
  source: RatingSource;
  score: number;
  note: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const existing = await supabase
    .from("ratings")
    .select("id")
    .eq("place_id", input.placeId)
    .eq("user_id", input.userId)
    .eq("source", input.source)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  const payload = {
    team_id: input.teamId,
    place_id: input.placeId,
    user_id: input.userId,
    source: input.source,
    score: input.score,
    note: input.note,
    rater_label: null,
    updated_at: new Date().toISOString(),
  };

  const query = existing.data
    ? supabase.from("ratings").update(payload).eq("id", existing.data.id)
    : supabase.from("ratings").insert(payload);
  const { data, error } = await query.select("id, source, score, note, updated_at").single();

  if (error) {
    throw error;
  }

  return data as RatingRecord;
}

export async function getUserRating(input: {
  placeId: string;
  userId: string;
  source: RatingSource;
}): Promise<RatingRecord | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ratings")
    .select("id, source, score, note, updated_at")
    .eq("place_id", input.placeId)
    .eq("user_id", input.userId)
    .eq("source", input.source)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as RatingRecord | null;
}

export async function deleteUserRating(input: {
  placeId: string;
  userId: string;
  source: RatingSource;
}): Promise<RatingRecord | null> {
  const existing = await getUserRating(input);

  if (!existing) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("ratings").delete().eq("id", existing.id);

  if (error) {
    throw error;
  }

  return existing;
}

export async function getRatingsForPlace(placeId: string): Promise<AdminRatingRecord[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ratings")
    .select(
      `
      id,
      user_id,
      source,
      rater_label,
      score,
      note,
      created_at,
      updated_at,
      profile:profiles (
        id,
        username,
        display_name,
        avatar_url
      )
    `,
    )
    .eq("place_id", placeId)
    .order("source", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as AdminRatingRecord[];
}
