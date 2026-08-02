import "server-only";

import {
  getRatingsForPlace,
  getRatingTarget,
  upsertUserRating,
  type AdminRatingRecord,
  type RatingRecord,
} from "@/server/ratings/repository";
import { getPlaceByStableId } from "@/server/places/repository";
import { canManageTeamContent, getTeamMembership } from "@/server/teams/repository";

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

export type AdminPlaceRating = {
  id: string;
  userId: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  source: "team_member" | "external";
  raterLabel: string | null;
  score: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
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

function toAdminPlaceRating(rating: AdminRatingRecord): AdminPlaceRating {
  return {
    id: rating.id,
    userId: rating.user_id,
    username: rating.profile?.username ?? null,
    displayName: rating.profile?.display_name ?? null,
    avatarUrl: rating.profile?.avatar_url ?? null,
    source: rating.source,
    raterLabel: rating.rater_label,
    score: Number(rating.score),
    note: rating.note,
    createdAt: rating.created_at,
    updatedAt: rating.updated_at,
  };
}

export async function getAdminPlaceRatings(input: {
  userId: string;
  placeId: string;
}): Promise<AdminPlaceRating[]> {
  const place = await getPlaceByStableId(input.placeId);

  if (!place) {
    throw new RatingError("Place not found.", "place_not_found");
  }

  const membership = await getTeamMembership(place.team_id, input.userId);

  if (!canManageTeamContent(membership?.role)) {
    throw new RatingError("Rating is not allowed for this place.", "rating_not_allowed");
  }

  const ratings = await getRatingsForPlace(place.id);

  return ratings.map(toAdminPlaceRating);
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
