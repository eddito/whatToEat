import "server-only";

import {
  getImportBatchCounts,
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

export class ImportBatchReadError extends Error {
  constructor(
    message: string,
    public readonly code: "team_not_found" | "not_allowed",
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
