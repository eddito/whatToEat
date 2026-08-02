import "server-only";

import { createSupabaseAdminClient } from "@/server/supabase/admin";

export type ListVisibility = "private" | "public_view" | "public_rate";
export type RatingSource = "team_member" | "external";

export type PublicListRecord = {
  id: string;
  team_id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: ListVisibility;
};

export type PlaceRecord = {
  id: string;
  team_id: string;
  import_key: string | null;
  name: string;
  category: string | null;
  taste_tags: string[];
  signature_dishes: string | null;
  review_summary: string | null;
  region: string | null;
  location_label: string | null;
  parking_note: string | null;
  source_label: string | null;
  visited: boolean;
  longitude: number | null;
  latitude: number | null;
  geocode_status: string;
};

export type ListPlaceRecord = {
  sort_order: number;
  list_id: string;
  place: PlaceRecord;
};

export type RatingRecord = {
  id: string;
  place_id: string;
  source: RatingSource;
  rater_label: string | null;
  score: number;
  note: string | null;
};

export type PhotoRecord = {
  place_id: string;
  url: string;
  is_cover: boolean;
  sort_order: number;
};

export type UserRatingHistoryRecord = RatingRecord & {
  updated_at: string;
  places:
    | {
        id: string;
        team_id: string;
        import_key: string | null;
        name: string;
        category: string | null;
        region: string | null;
        list_places:
          | Array<{
              lists:
                | {
                    slug: string;
                    name: string;
                    visibility: ListVisibility;
                  }
                | Array<{
                    slug: string;
                    name: string;
                    visibility: ListVisibility;
                  }>
                | null;
            }>
          | null;
      }
    | Array<{
        id: string;
        team_id: string;
        import_key: string | null;
        name: string;
        category: string | null;
        region: string | null;
        list_places: Array<{
          lists:
            | {
                slug: string;
                name: string;
                visibility: ListVisibility;
              }
            | Array<{
                slug: string;
                name: string;
                visibility: ListVisibility;
              }>
            | null;
        }> | null;
      }>
    | null;
};

export type TeamMembershipRecord = {
  role: "owner" | "member" | "viewer";
};

const PUBLIC_VISIBILITIES: ListVisibility[] = ["public_view", "public_rate"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getPublicLists() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("lists")
    .select("id, team_id, slug, name, description, visibility")
    .in("visibility", PUBLIC_VISIBILITIES)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data as PublicListRecord[];
}

export async function getPublicListBySlug(slug: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("lists")
    .select("id, team_id, slug, name, description, visibility")
    .eq("slug", slug)
    .in("visibility", PUBLIC_VISIBILITIES)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PublicListRecord | null;
}

export async function getPlacesForPublicListId(listId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("list_places")
    .select(
      `
      list_id,
      sort_order,
      places (
        id,
        team_id,
        import_key,
        name,
        category,
        taste_tags,
        signature_dishes,
        review_summary,
        region,
        location_label,
        parking_note,
        source_label,
        visited,
        longitude,
        latitude,
        geocode_status
      )
    `,
    )
    .eq("list_id", listId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return data
    .map((row) => ({
      list_id: row.list_id,
      sort_order: row.sort_order,
      place: Array.isArray(row.places) ? row.places[0] : row.places,
    }))
    .filter((row) => row.place) as unknown as ListPlaceRecord[];
}

export async function getPublicPlaceByStableId(stableId: string) {
  const supabase = createSupabaseAdminClient();
  const query = supabase
    .from("places")
    .select(
      `
      id,
      team_id,
      import_key,
      name,
      category,
      taste_tags,
      signature_dishes,
      review_summary,
      region,
      location_label,
      parking_note,
      source_label,
      visited,
      longitude,
      latitude,
      geocode_status
    `,
    );
  const { data, error } = UUID_PATTERN.test(stableId)
    ? await query.eq("id", stableId).maybeSingle()
    : await query.eq("import_key", stableId).maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlaceRecord | null;
}

export async function getPublicListsForPlace(placeId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("list_places")
    .select(
      `
      lists (
        id,
        team_id,
        slug,
        name,
        description,
        visibility
      )
    `,
    )
    .eq("place_id", placeId);

  if (error) {
    throw error;
  }

  return data
    .map((row) => (Array.isArray(row.lists) ? row.lists[0] : row.lists))
    .filter((list) => list && PUBLIC_VISIBILITIES.includes(list.visibility)) as PublicListRecord[];
}

export async function getRatingsForPlaces(placeIds: string[]) {
  if (placeIds.length === 0) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ratings")
    .select("id, place_id, source, rater_label, score, note")
    .in("place_id", placeIds);

  if (error) {
    throw error;
  }

  return data as RatingRecord[];
}

export async function getPhotosForPlaces(placeIds: string[]) {
  if (placeIds.length === 0) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("photos")
    .select("place_id, url, is_cover, sort_order")
    .in("place_id", placeIds)
    .order("is_cover", { ascending: false })
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return data as PhotoRecord[];
}

export async function getTeamMembership(teamId: string, userId: string) {
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

  return data as TeamMembershipRecord | null;
}

export async function getUserRatingForPlace(placeId: string, userId: string, source: RatingSource) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ratings")
    .select("id, place_id, source, rater_label, score, note")
    .eq("place_id", placeId)
    .eq("user_id", userId)
    .eq("source", source)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as RatingRecord | null;
}

export async function getUserRatingHistory(userId: string, limit = 30) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ratings")
    .select(
      `
      id,
      place_id,
      source,
      rater_label,
      score,
      note,
      updated_at,
      places (
        id,
        team_id,
        import_key,
        name,
        category,
        region,
        list_places (
          lists (
            slug,
            name,
            visibility
          )
        )
      )
    `,
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data as unknown as UserRatingHistoryRecord[];
}

export async function upsertUserRating(input: {
  existingRatingId?: string;
  teamId: string;
  placeId: string;
  userId: string;
  raterLabel: string;
  source: RatingSource;
  score: number;
  note?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const payload = {
    team_id: input.teamId,
    place_id: input.placeId,
    user_id: input.userId,
    rater_label: input.raterLabel,
    source: input.source,
    score: input.score,
    note: input.note || null,
    updated_at: new Date().toISOString(),
  };

  const query = input.existingRatingId
    ? supabase.from("ratings").update(payload).eq("id", input.existingRatingId).select("id, score, note").single()
    : supabase.from("ratings").insert(payload).select("id, score, note").single();
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data as { id: string; score: number; note: string | null };
}

export async function deleteUserRating(ratingId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("ratings").delete().eq("id", ratingId);

  if (error) {
    throw error;
  }
}
