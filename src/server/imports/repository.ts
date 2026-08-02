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
