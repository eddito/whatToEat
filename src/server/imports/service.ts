import "server-only";

import seedPlaces from "@/data/seed-places.json";
import {
  countImportPlanArchiveMissing,
  getImportBatchById,
  getImportBatchCounts,
  getImportBatchListPlacePreview,
  getImportBatchPlacePreview,
  getImportBatchRatingPreview,
  getImportBatches,
  getImportPlanListPlaces,
  getImportPlanLists,
  getImportPlanPlaces,
  getImportPlanRatings,
  markImportBatchRolledBack,
  rollbackImportBatchRecords,
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

export type GetAdminImportPlanInput = {
  actorUserId: string;
  teamSlug?: string;
  archiveMissing?: boolean;
  sourceName?: string;
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

export type AdminImportBatchRollbackPlan = {
  batch: AdminImportBatch;
  dryRun: true;
  impact: {
    ratingsToDelete: number;
    listPlacesToDelete: number;
    placesToArchive: number;
  };
  warnings: string[];
};

export type RollbackAdminImportBatchInput = GetAdminImportBatchInput & {
  confirm: boolean;
};

export type AdminImportBatchRollbackResult = {
  batchId: string;
  status: "rolled_back";
  rolledBackAt: string;
  summary: {
    ratingsDeleted: number;
    listLinksDeleted: number;
    placesArchived: number;
  };
};

export type AdminImportPlan = {
  dryRun: true;
  sourceName: string;
  teamSlug: string;
  archiveMissing: boolean;
  summary: {
    listsCreated: number;
    listsUpdated: number;
    placesCreated: number;
    placesUpdated: number;
    listLinksCreated: number;
    listLinksUpdated: number;
    ratingsCreated: number;
    ratingsUpdated: number;
    ratingsSkipped: number;
    placesArchivedMissing: number;
  };
  counts: {
    seedPlaces: number;
    seedLists: number;
    importedRatings: number;
  };
};

export class ImportBatchReadError extends Error {
  constructor(
    message: string,
    public readonly code: "team_not_found" | "batch_not_found" | "batch_already_rolled_back" | "not_allowed",
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

const DEFAULT_IMPORT_LISTS = [
  {
    slug: "red-list",
    name: "红榜",
    description: "已经探过、值得优先推荐的店。",
    visibility: "public_rate",
  },
  {
    slug: "retry-list",
    name: "再练练",
    description: "体验还有争议，适合二刷确认的候选。",
    visibility: "public_view",
  },
];

const IMPORTED_RATERS = [
  ["杨", "yang"],
  ["陈", "chen"],
] as const;

type SeedPlace = {
  id: string;
  listSlug: string;
  memberScores?: Record<string, number>;
};

export async function getAdminImportPlan(input: GetAdminImportPlanInput): Promise<AdminImportPlan> {
  const team = await getTeamBySlug(input.teamSlug?.trim() || "what-to-eat");

  if (!team) {
    throw new ImportBatchReadError("Team not found.", "team_not_found");
  }

  const membership = await getTeamMembership(team.id, input.actorUserId);

  if (!canManageTeamMembers(membership?.role)) {
    throw new ImportBatchReadError("Current user cannot read import plan for this team.", "not_allowed");
  }

  const places = seedPlaces as SeedPlace[];
  const importKeys = places.map((place) => place.id);
  const listSlugs = DEFAULT_IMPORT_LISTS.map((list) => list.slug);
  const [existingLists, existingPlaces] = await Promise.all([
    getImportPlanLists({ teamId: team.id, slugs: listSlugs }),
    getImportPlanPlaces({ teamId: team.id, importKeys }),
  ]);
  const listsBySlug = new Map(existingLists.map((list) => [list.slug, list]));
  const placesByImportKey = new Map(existingPlaces.map((place) => [place.import_key, place]));
  const existingPlaceIds = existingPlaces.map((place) => place.id);
  const [existingListPlaces, existingRatings, placesArchivedMissing] = await Promise.all([
    getImportPlanListPlaces({
      listIds: existingLists.map((list) => list.id),
      placeIds: existingPlaceIds,
    }),
    getImportPlanRatings(existingPlaceIds),
    input.archiveMissing ? countImportPlanArchiveMissing({ teamId: team.id, importedKeys: importKeys }) : 0,
  ]);
  const listPlaceKeys = new Set(existingListPlaces.map((row) => `${row.list_id}:${row.place_id}`));
  const ratingKeys = new Set(existingRatings.map((rating) => `${rating.place_id}:${rating.rater_label ?? ""}`));
  const summary = {
    listsCreated: 0,
    listsUpdated: 0,
    placesCreated: 0,
    placesUpdated: 0,
    listLinksCreated: 0,
    listLinksUpdated: 0,
    ratingsCreated: 0,
    ratingsUpdated: 0,
    ratingsSkipped: 0,
    placesArchivedMissing,
  };
  let importedRatings = 0;

  for (const list of DEFAULT_IMPORT_LISTS) {
    if (listsBySlug.has(list.slug)) {
      summary.listsUpdated += 1;
    } else {
      summary.listsCreated += 1;
    }
  }

  for (const place of places) {
    const existingPlace = placesByImportKey.get(place.id);
    const list = listsBySlug.get(place.listSlug);

    if (existingPlace) {
      summary.placesUpdated += 1;
    } else {
      summary.placesCreated += 1;
    }

    if (!existingPlace || !list || !listPlaceKeys.has(`${list.id}:${existingPlace.id}`)) {
      summary.listLinksCreated += 1;
    } else {
      summary.listLinksUpdated += 1;
    }

    for (const [raterLabel, key] of IMPORTED_RATERS) {
      const score = place.memberScores?.[key] ?? 0;

      if (!score || score <= 0) {
        summary.ratingsSkipped += 1;
        continue;
      }

      importedRatings += 1;

      if (!existingPlace || !ratingKeys.has(`${existingPlace.id}:${raterLabel}`)) {
        summary.ratingsCreated += 1;
      } else {
        summary.ratingsUpdated += 1;
      }
    }
  }

  return {
    dryRun: true,
    sourceName: input.sourceName?.trim() || "seed-places.json",
    teamSlug: team.slug ?? "",
    archiveMissing: input.archiveMissing ?? false,
    summary,
    counts: {
      seedPlaces: places.length,
      seedLists: DEFAULT_IMPORT_LISTS.length,
      importedRatings,
    },
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

export async function getAdminImportBatchRollbackPlan(
  input: GetAdminImportBatchInput,
): Promise<AdminImportBatchRollbackPlan> {
  const detail = await getAdminImportBatch({
    ...input,
    previewLimit: 1,
  });
  const warnings = [
    "Rollback plan is read-only and does not modify data.",
    "Rollback would delete ratings and list-place links tracked by this batch.",
    "Rollback would soft-archive places tracked by this batch; it does not restore overwritten older field values.",
  ];

  if (detail.rolledBackAt) {
    warnings.push("This batch is already marked as rolled back.");
  }

  return {
    batch: {
      id: detail.id,
      teamId: detail.teamId,
      sourceName: detail.sourceName,
      operation: detail.operation,
      status: detail.status,
      summary: detail.summary,
      counts: detail.counts,
      createdAt: detail.createdAt,
      finishedAt: detail.finishedAt,
      rolledBackAt: detail.rolledBackAt,
    },
    dryRun: true,
    impact: {
      ratingsToDelete: detail.counts.ratings,
      listPlacesToDelete: detail.counts.listPlaces,
      placesToArchive: detail.counts.places,
    },
    warnings,
  };
}

export async function rollbackAdminImportBatch(
  input: RollbackAdminImportBatchInput,
): Promise<AdminImportBatchRollbackResult> {
  if (!input.confirm) {
    throw new ImportBatchReadError("Rollback requires explicit confirmation.", "not_allowed");
  }

  const detail = await getAdminImportBatch({
    ...input,
    previewLimit: 1,
  });

  if (detail.rolledBackAt || detail.status === "rolled_back") {
    throw new ImportBatchReadError("Import batch is already rolled back.", "batch_already_rolled_back");
  }

  const rollback = await rollbackImportBatchRecords(detail.id);
  const summary = {
    ratingsDeleted: rollback.ratingsDeleted,
    listLinksDeleted: rollback.listLinksDeleted,
    placesArchived: rollback.placesArchived,
  };

  await markImportBatchRolledBack({
    batchId: detail.id,
    rolledBackAt: rollback.rolledBackAt,
    summary: {
      ...detail.summary,
      rollback: summary,
    },
  });

  return {
    batchId: detail.id,
    status: "rolled_back",
    rolledBackAt: rollback.rolledBackAt,
    summary,
  };
}
