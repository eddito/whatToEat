import "server-only";

import { createSupabaseAdminClient } from "@/server/supabase/admin";

export type ImportBatchRecord = {
  id: string;
  team_id: string | null;
  source_name: string;
  operation: string;
  status: string;
  summary: Record<string, unknown>;
  created_at: string;
  finished_at: string | null;
  rolled_back_at: string | null;
};

export type ImportBatchCounts = {
  places: number;
  listPlaces: number;
  ratings: number;
};

export type ImportBatchPlacePreviewRecord = {
  id: string;
  import_key: string | null;
  name: string;
  category: string | null;
  region: string | null;
  archived_at: string | null;
};

export type ImportBatchListPlacePreviewRecord = {
  list_id: string;
  place_id: string;
  sort_order: number;
  list: {
    slug: string;
    name: string;
  } | null;
  place: {
    import_key: string | null;
    name: string;
  } | null;
};

export type ImportBatchRatingPreviewRecord = {
  id: string;
  place_id: string;
  source: string;
  rater_label: string | null;
  score: number;
  place: {
    import_key: string | null;
    name: string;
  } | null;
};

export async function getImportBatches(input: {
  teamId: string;
  includeLegacy: boolean;
  limit: number;
}): Promise<ImportBatchRecord[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("import_batches")
    .select("id, team_id, source_name, operation, status, summary, created_at, finished_at, rolled_back_at")
    .order("created_at", { ascending: false })
    .limit(input.limit);

  query = input.includeLegacy
    ? query.or(`team_id.eq.${input.teamId},team_id.is.null`)
    : query.eq("team_id", input.teamId);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as ImportBatchRecord[];
}

export async function getImportBatchById(batchId: string): Promise<ImportBatchRecord | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("import_batches")
    .select("id, team_id, source_name, operation, status, summary, created_at, finished_at, rolled_back_at")
    .eq("id", batchId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ImportBatchRecord | null;
}

async function getCount(table: "places" | "list_places" | "ratings", batchId: string) {
  const supabase = createSupabaseAdminClient();
  const countColumn = table === "list_places" ? "place_id" : "id";
  const { count, error } = await supabase
    .from(table)
    .select(countColumn, { count: "exact", head: true })
    .eq("import_batch_id", batchId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function getImportBatchCounts(batchId: string): Promise<ImportBatchCounts> {
  const [places, listPlaces, ratings] = await Promise.all([
    getCount("places", batchId),
    getCount("list_places", batchId),
    getCount("ratings", batchId),
  ]);

  return {
    places,
    listPlaces,
    ratings,
  };
}

export async function getImportBatchPlacePreview(input: {
  batchId: string;
  limit: number;
}): Promise<ImportBatchPlacePreviewRecord[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("places")
    .select("id, import_key, name, category, region, archived_at")
    .eq("import_batch_id", input.batchId)
    .order("updated_at", { ascending: false })
    .limit(input.limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as ImportBatchPlacePreviewRecord[];
}

export async function getImportBatchListPlacePreview(input: {
  batchId: string;
  limit: number;
}): Promise<ImportBatchListPlacePreviewRecord[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("list_places")
    .select(
      `
      list_id,
      place_id,
      sort_order,
      list:lists (
        slug,
        name
      ),
      place:places (
        import_key,
        name
      )
    `,
    )
    .eq("import_batch_id", input.batchId)
    .order("sort_order", { ascending: true })
    .limit(input.limit);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => ({
      ...row,
      list: Array.isArray(row.list) ? row.list[0] : row.list,
      place: Array.isArray(row.place) ? row.place[0] : row.place,
    })) as ImportBatchListPlacePreviewRecord[];
}

export async function getImportBatchRatingPreview(input: {
  batchId: string;
  limit: number;
}): Promise<ImportBatchRatingPreviewRecord[]> {
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
      place:places (
        import_key,
        name
      )
    `,
    )
    .eq("import_batch_id", input.batchId)
    .order("updated_at", { ascending: false })
    .limit(input.limit);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => ({
      ...row,
      place: Array.isArray(row.place) ? row.place[0] : row.place,
    })) as ImportBatchRatingPreviewRecord[];
}
