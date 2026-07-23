import "server-only";

import { randomUUID } from "node:crypto";
import type { ListSlug, ListSummary, Place } from "@/lib/types";
import {
  getListBySlug,
  getPlacesForPublicListId,
  getPublicListBySlug,
  getPublicLists,
  getPublicListsForPlace,
  getPlaceByStableId,
  getPublicPlaceByStableId,
  getRatingsForPlaces,
  isUuid,
  type ListVisibility,
  type PlaceRecord,
  type PublicListRecord,
  type RatingRecord,
  upsertListPlace,
  upsertPlaceRecord,
} from "@/server/places/repository";
import { canManageTeamContent, getTeamMembership } from "@/server/teams/repository";

export type PublicListStats = {
  count: number;
  scoredCount: number;
  avgScore: number;
};

export type PublicList = {
  slug: string;
  name: string;
  description: string;
  visibility: ListVisibility;
  stats: PublicListStats;
};

export type PublicPlace = {
  id: string;
  listSlug: string;
  listName: string;
  name: string;
  category: string;
  tasteTags: string[];
  signatureDishes: string;
  review: string;
  region: string;
  locationLabel: string;
  parkingNote: string;
  sourceLabel: string;
  visited: boolean;
  memberScores: Record<string, number>;
  teamScore: number;
  longitude?: number;
  latitude?: number;
};

export type PublicMapPlace = {
  id: string;
  name: string;
  region: string;
  category: string;
  score: number;
  longitude?: number;
  latitude?: number;
};

export type UpsertAdminPlaceInput = {
  userId: string;
  id?: string;
  listSlug: string;
  importKey?: string;
  name: string;
  category?: string | null;
  tasteTags?: string[];
  signatureDishes?: string | null;
  review?: string | null;
  region?: string | null;
  locationLabel?: string | null;
  parkingNote?: string | null;
  sourceLabel?: string | null;
  visited?: boolean;
  longitude?: number | null;
  latitude?: number | null;
};

export class PlaceWriteError extends Error {
  constructor(
    message: string,
    public readonly code: "list_not_found" | "place_not_found" | "place_team_mismatch" | "not_allowed",
  ) {
    super(message);
    this.name = "PlaceWriteError";
  }
}

function getStablePlaceId(place: PlaceRecord) {
  return place.import_key ?? place.id;
}

function toListBase(list: PublicListRecord) {
  return {
    slug: list.slug,
    name: list.name,
    description: list.description ?? "",
    visibility: list.visibility,
  };
}

function buildRatingSummary(placeId: string, ratings: RatingRecord[]) {
  const teamRatings = ratings.filter((rating) => rating.place_id === placeId && rating.source === "team_member");
  const memberScores = Object.fromEntries(
    teamRatings
      .filter((rating) => rating.rater_label)
      .map((rating) => [rating.rater_label as string, Number(rating.score)]),
  );
  const scored = teamRatings.map((rating) => Number(rating.score)).filter((score) => score > 0);
  const teamScore = scored.length > 0 ? scored.reduce((sum, score) => sum + score, 0) / scored.length : 0;

  return {
    memberScores,
    teamScore: Number(teamScore.toFixed(1)),
  };
}

function toPublicPlace(place: PlaceRecord, list: PublicListRecord, ratings: RatingRecord[]): PublicPlace {
  const ratingSummary = buildRatingSummary(place.id, ratings);

  return {
    id: getStablePlaceId(place),
    listSlug: list.slug,
    listName: list.name,
    name: place.name,
    category: place.category ?? "",
    tasteTags: place.taste_tags ?? [],
    signatureDishes: place.signature_dishes ?? "",
    review: place.review_summary ?? "",
    region: place.region ?? "",
    locationLabel: place.location_label ?? "",
    parkingNote: place.parking_note ?? "",
    sourceLabel: place.source_label ?? "",
    visited: place.visited,
    memberScores: ratingSummary.memberScores,
    teamScore: ratingSummary.teamScore,
    longitude: place.longitude ?? undefined,
    latitude: place.latitude ?? undefined,
  };
}

function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildImportKey(listSlug: string) {
  return `${listSlug}-${randomUUID().slice(0, 8)}`;
}

function getStatsFromPlaces(places: PublicPlace[]): PublicListStats {
  const scored = places.filter((place) => place.teamScore > 0);
  const avg =
    scored.length > 0
      ? scored.reduce((sum, place) => sum + place.teamScore, 0) / scored.length
      : 0;

  return {
    count: places.length,
    scoredCount: scored.length,
    avgScore: Number(avg.toFixed(1)),
  };
}

async function getPublicPlacesForListRecord(list: PublicListRecord) {
  const rows = await getPlacesForPublicListId(list.id);
  const places = rows.map((row) => row.place);
  const ratings = await getRatingsForPlaces(places.map((place) => place.id));

  return places.map((place) => toPublicPlace(place, list, ratings));
}

export async function getLists(): Promise<PublicList[]> {
  const lists = await getPublicLists();
  const listPlaces = await Promise.all(
    lists.map(async (list) => ({
      list,
      places: await getPublicPlacesForListRecord(list),
    })),
  );

  return listPlaces.map(({ list, places }) => ({
    ...toListBase(list),
    stats: getStatsFromPlaces(places),
  }));
}

export async function getList(slug: string): Promise<PublicList | null> {
  const list = await getPublicListBySlug(slug);

  if (!list) {
    return null;
  }

  const places = await getPublicPlacesForListRecord(list);

  return {
    ...toListBase(list),
    stats: getStatsFromPlaces(places),
  };
}

export async function getPlacesByList(slug: string): Promise<PublicPlace[]> {
  const list = await getPublicListBySlug(slug);

  if (!list) {
    return [];
  }

  return getPublicPlacesForListRecord(list);
}

export async function getPlace(id: string): Promise<PublicPlace | null> {
  const place = await getPublicPlaceByStableId(id);

  if (!place) {
    return null;
  }

  const lists = await getPublicListsForPlace(place.id);

  if (lists.length === 0) {
    return null;
  }

  const ratings = await getRatingsForPlaces([place.id]);

  return toPublicPlace(place, lists[0], ratings);
}

export async function getMapPlaces(): Promise<PublicMapPlace[]> {
  const lists = await getPublicLists();
  const entries = await Promise.all(
    lists.map(async (list) => ({
      list,
      places: await getPublicPlacesForListRecord(list),
    })),
  );
  const uniquePlaces = new Map<string, PublicMapPlace>();

  for (const entry of entries) {
    for (const place of entry.places) {
      if (!uniquePlaces.has(place.id)) {
        uniquePlaces.set(place.id, {
          id: place.id,
          name: place.name,
          region: place.region,
          category: place.category,
          score: place.teamScore,
          longitude: place.longitude,
          latitude: place.latitude,
        });
      }
    }
  }

  return Array.from(uniquePlaces.values());
}

export async function getListStats(slug: string): Promise<PublicListStats | null> {
  const places = await getPlacesByList(slug);

  if (places.length === 0) {
    const list = await getPublicListBySlug(slug);
    return list ? getStatsFromPlaces([]) : null;
  }

  return getStatsFromPlaces(places);
}

function isLegacyListSlug(slug: string): slug is ListSlug {
  return slug === "red-list" || slug === "retry-list";
}

function toLegacyListSummary(list: PublicList): ListSummary {
  if (!isLegacyListSlug(list.slug)) {
    throw new Error(`Unsupported legacy list slug: ${list.slug}`);
  }

  return {
    slug: list.slug,
    name: list.name,
    description: list.description,
    visibility: list.visibility,
  };
}

function toLegacyPlace(place: PublicPlace): Place {
  if (!isLegacyListSlug(place.listSlug)) {
    throw new Error(`Unsupported legacy list slug: ${place.listSlug}`);
  }

  return {
    id: place.id,
    listSlug: place.listSlug,
    listName: place.listName,
    name: place.name,
    category: place.category,
    tasteTags: place.tasteTags,
    signatureDishes: place.signatureDishes,
    review: place.review,
    region: place.region,
    locationLabel: place.locationLabel,
    parkingNote: place.parkingNote,
    sourceLabel: place.sourceLabel,
    visited: place.visited,
    memberScores: {
      yang: place.memberScores["杨"] ?? 0,
      chen: place.memberScores["陈"] ?? 0,
    },
    teamScore: place.teamScore,
    legacyScore: 0,
    longitude: place.longitude,
    latitude: place.latitude,
  };
}

export function getListStatsFromPlaces(places: Place[]): PublicListStats {
  return getStatsFromPlaces(
    places.map((place) => ({
      ...place,
      memberScores: {
        杨: place.memberScores.yang,
        陈: place.memberScores.chen,
      },
    })),
  );
}

export async function getPublicPlaceData() {
  const lists = await getLists();
  const placesByList = await Promise.all(lists.map((list) => getPlacesByList(list.slug)));

  return {
    lists: lists.map(toLegacyListSummary),
    places: placesByList.flat().map(toLegacyPlace),
  };
}

export async function getPublicListPageData(slug: string) {
  const [lists, list, places] = await Promise.all([getLists(), getList(slug), getPlacesByList(slug)]);

  if (!list) {
    return null;
  }

  return {
    lists: lists.map(toLegacyListSummary),
    list: toLegacyListSummary(list),
    places: places.map(toLegacyPlace),
    stats: list.stats,
  };
}

export async function getPublicPlacePageData(id: string) {
  const place = await getPlace(id);

  if (!place) {
    throw new Error(`Public place not found: ${id}`);
  }

  return toLegacyPlace(place);
}

export async function upsertAdminPlace(input: UpsertAdminPlaceInput): Promise<PublicPlace> {
  const list = await getListBySlug(input.listSlug);

  if (!list) {
    throw new PlaceWriteError("List not found.", "list_not_found");
  }

  const membership = await getTeamMembership(list.team_id, input.userId);

  if (!canManageTeamContent(membership?.role)) {
    throw new PlaceWriteError("Current user cannot manage places for this list.", "not_allowed");
  }

  const existingPlace = input.id
    ? await getPlaceByStableId(input.id)
    : input.importKey
      ? await getPlaceByStableId(input.importKey)
      : null;

  if (input.id && !existingPlace) {
    throw new PlaceWriteError("Place not found.", "place_not_found");
  }

  if (existingPlace && existingPlace.team_id !== list.team_id) {
    throw new PlaceWriteError("Place does not belong to the target list team.", "place_team_mismatch");
  }

  const importKey = existingPlace?.import_key ?? input.importKey?.trim() ?? (input.id && !isUuid(input.id) ? input.id : buildImportKey(list.slug));
  const place = await upsertPlaceRecord({
    id: existingPlace?.id,
    teamId: list.team_id,
    importKey,
    name: input.name.trim(),
    category: optionalText(input.category),
    tasteTags: input.tasteTags ?? [],
    signatureDishes: optionalText(input.signatureDishes),
    reviewSummary: optionalText(input.review),
    region: optionalText(input.region),
    locationLabel: optionalText(input.locationLabel),
    parkingNote: optionalText(input.parkingNote),
    sourceLabel: optionalText(input.sourceLabel),
    visited: input.visited ?? existingPlace?.visited ?? false,
    longitude: input.longitude ?? null,
    latitude: input.latitude ?? null,
    createdBy: input.userId,
  });

  await upsertListPlace({
    listId: list.id,
    placeId: place.id,
  });

  return toPublicPlace(place, list, await getRatingsForPlaces([place.id]));
}
