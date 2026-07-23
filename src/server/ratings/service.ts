import "server-only";

import {
  getRatingTarget,
  upsertUserRating,
  type RatingRecord,
} from "@/server/ratings/repository";
import { getTeamMembership } from "@/server/teams/repository";

export type UpsertRatingInput = {
  userId: string;
  placeId: string;
  score: number;
  note?: string | null;
};

export type UpsertRatingResult = {
  rating: RatingRecord;
  source: "team_member" | "external";
  role: "owner" | "member" | "viewer" | null;
};

export class RatingError extends Error {
  constructor(
    message: string,
    public readonly code: "place_not_found" | "place_not_public" | "rating_not_allowed",
  ) {
    super(message);
    this.name = "RatingError";
  }
}

export async function upsertRating(input: UpsertRatingInput): Promise<UpsertRatingResult> {
  const target = await getRatingTarget(input.placeId);

  if (!target) {
    throw new RatingError("Place not found.", "place_not_found");
  }

  if (target.publicLists.length === 0) {
    throw new RatingError("Place is not public.", "place_not_public");
  }

  const membership = await getTeamMembership(target.teamId, input.userId);
  const canWriteTeamRating = membership?.role === "owner" || membership?.role === "member";
  const canWriteExternalRating = target.publicLists.some((list) => list.visibility === "public_rate");

  if (!canWriteTeamRating && !canWriteExternalRating) {
    throw new RatingError("Rating is not allowed for this place.", "rating_not_allowed");
  }

  const source = canWriteTeamRating ? "team_member" : "external";
  const rating = await upsertUserRating({
    teamId: target.teamId,
    placeId: target.placeId,
    userId: input.userId,
    source,
    score: input.score,
    note: input.note?.trim() || null,
  });

  return {
    rating,
    source,
    role: membership?.role ?? null,
  };
}
