import "server-only";

import {
  getImportBatchById,
  getImportBatchCounts,
  getImportBatchListPlacePreview,
  getImportBatchPlacePreview,
  getImportBatchRatingPreview,
  getImportBatches,
  type ImportBatchRecord,
} from "@/server/imports/repository";
import { canManageTeamMembers, getTeamBySlug, getTeamMembership } from "@/server/teams/repository";

export type AdminImportBatch = {
  id: string;
  teamId: string | null;
  sourceName: string;
  operation: string;
  status: string;
  summary: Record<string, unknown>;
  counts: {
    places: number;
    listPlaces: number;
    ratings: number;
  };
  createdAt: string;
  finishedAt: string | null;
  rolledBackAt: string | null;
};

export type GetAdminImportBatchesInput = {
  actorUserId: string;
  teamSlug?: string;
  includeLegacy?: boolean;
  limit?: number;
};

export type GetAdminImportBatchInput = {
  actorUserId: string;
  batchId: string;
  teamSlug?: string;
  previewLimit?: number;
};

export type AdminImportBatchDetail = AdminImportBatch & {
  preview: {
    places: Array<{
      id: string;
      importKey: string | null;
      name: string;
      category: string | null;
      region: string | null;
      archivedAt: string | null;
    }>;
    listPlaces: Array<{
      listId: string;
      placeId: string;
      listSlug: string | null;
      listName: string | null;
      placeImportKey: string | null;
      placeName: string | null;
      sortOrder: number;
    }>;
    ratings: Array<{
      id: string;
      placeId: string;
      placeImportKey: string | null;
      placeName: string | null;
      source: string;
      raterLabel: string | null;
      score: number;
    }>;
  };
};

export class ImportBatchReadError extends Error {
  constructor(
    message: string,
    public readonly code: "team_not_found" | "batch_not_found" | "not_allowed",
  ) {
    super(message);
    this.name = "ImportBatchReadError";
  }
}

function clampLimit(limit: number | undefined) {
  if (!limit || !Number.isFinite(limit)) {
    return 20;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function clampPreviewLimit(limit: number | undefined) {
  if (!limit || !Number.isFinite(limit)) {
    return 20;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 50);
}

function toAdminImportBatch(batch: ImportBatchRecord, counts: AdminImportBatch["counts"]): AdminImportBatch {
  return {
    id: batch.id,
    teamId: batch.team_id,
    sourceName: batch.source_name,
    operation: batch.operation,
    status: batch.status,
    summary: batch.summary,
    counts,
    createdAt: batch.created_at,
    finishedAt: batch.finished_at,
    rolledBackAt: batch.rolled_back_at,
  };
}

export async function getAdminImportBatches(input: GetAdminImportBatchesInput): Promise<AdminImportBatch[]> {
  const team = await getTeamBySlug(input.teamSlug?.trim() || "what-to-eat");

  if (!team) {
    throw new ImportBatchReadError("Team not found.", "team_not_found");
  }

  const membership = await getTeamMembership(team.id, input.actorUserId);

  if (!canManageTeamMembers(membership?.role)) {
    throw new ImportBatchReadError("Current user cannot read import batches for this team.", "not_allowed");
  }

  const batches = await getImportBatches({
    teamId: team.id,
    includeLegacy: input.includeLegacy ?? true,
    limit: clampLimit(input.limit),
  });
  const counts = await Promise.all(batches.map((batch) => getImportBatchCounts(batch.id)));

  return batches.map((batch, index) => toAdminImportBatch(batch, counts[index]));
}

export async function getAdminImportBatch(input: GetAdminImportBatchInput): Promise<AdminImportBatchDetail> {
  const team = await getTeamBySlug(input.teamSlug?.trim() || "what-to-eat");

  if (!team) {
    throw new ImportBatchReadError("Team not found.", "team_not_found");
  }

  const membership = await getTeamMembership(team.id, input.actorUserId);

  if (!canManageTeamMembers(membership?.role)) {
    throw new ImportBatchReadError("Current user cannot read import batch details for this team.", "not_allowed");
  }

  const batch = await getImportBatchById(input.batchId);

  if (!batch || (batch.team_id && batch.team_id !== team.id)) {
    throw new ImportBatchReadError("Import batch not found.", "batch_not_found");
  }

  const limit = clampPreviewLimit(input.previewLimit);
  const [counts, places, listPlaces, ratings] = await Promise.all([
    getImportBatchCounts(batch.id),
    getImportBatchPlacePreview({ batchId: batch.id, limit }),
    getImportBatchListPlacePreview({ batchId: batch.id, limit }),
    getImportBatchRatingPreview({ batchId: batch.id, limit }),
  ]);

  return {
    ...toAdminImportBatch(batch, counts),
    preview: {
      places: places.map((place) => ({
        id: place.id,
        importKey: place.import_key,
        name: place.name,
        category: place.category,
        region: place.region,
        archivedAt: place.archived_at,
      })),
      listPlaces: listPlaces.map((row) => ({
        listId: row.list_id,
        placeId: row.place_id,
        listSlug: row.list?.slug ?? null,
        listName: row.list?.name ?? null,
        placeImportKey: row.place?.import_key ?? null,
        placeName: row.place?.name ?? null,
        sortOrder: row.sort_order,
      })),
      ratings: ratings.map((rating) => ({
        id: rating.id,
        placeId: rating.place_id,
        placeImportKey: rating.place?.import_key ?? null,
        placeName: rating.place?.name ?? null,
        source: rating.source,
        raterLabel: rating.rater_label,
        score: Number(rating.score),
      })),
    },
  };
}
