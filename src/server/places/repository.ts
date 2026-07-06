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
    .select("id, place_id, source, rater_label, score")
    .in("place_id", placeIds);

  if (error) {
    throw error;
  }

  return data as RatingRecord[];
}
