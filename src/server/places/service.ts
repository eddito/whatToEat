import "server-only";

import { randomUUID } from "node:crypto";
import type { ListSlug, ListSummary, Place } from "@/lib/types";
import {
  archivePlaceRecord,
  getArchivedPlacesForTeam,
  getListBySlug,
  getListsForTeam,
  getListsForPlaces,
  getPlacesForListId,
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
  upsertListRecord,
  upsertPlaceRecord,
} from "@/server/places/repository";
import { canManageTeamContent, getTeamBySlug, getTeamMembership } from "@/server/teams/repository";

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

export type UpsertAdminListInput = {
  userId: string;
  slug: string;
  name: string;
  description?: string | null;
  visibility: ListVisibility;
  teamSlug?: string;
};

export type GetAdminListsInput = {
  userId: string;
  teamSlug?: string;
};

export type ArchiveAdminPlaceInput = {
  userId: string;
  id: string;
  archived?: boolean;
};

export type GetAdminArchivedPlacesInput = {
  userId: string;
  teamSlug?: string;
  limit?: number;
};

export type GetAdminListPlacesInput = {
  userId: string;
  slug: string;
  includeArchived?: boolean;
};

export class PlaceWriteError extends Error {
  constructor(
    message: string,
    public readonly code: "team_not_found" | "list_not_found" | "place_not_found" | "place_team_mismatch" | "not_allowed",
  ) {
    super(message);
    this.name = "PlaceWriteError";
  }
}

export type ArchiveAdminPlaceResult = {
  id: string;
  archivedAt: string | null;
};

export type AdminArchivedPlace = {
  id: string;
  name: string;
  category: string;
  region: string;
  locationLabel: string;
  listSlugs: string[];
  listNames: string[];
  archivedAt: string;
};

export type AdminListPlace = PublicPlace & {
  sortOrder: number;
  archivedAt: string | null;
};

export type AdminList = PublicList & {
  teamSlug: string;
};

export class ListWriteError extends Error {
  constructor(
    message: string,
    public readonly code: "team_not_found" | "not_allowed",
  ) {
    super(message);
    this.name = "ListWriteError";
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

function clampLimit(limit: number | undefined) {
  if (!limit || !Number.isFinite(limit)) {
    return 50;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 200);
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

export async function upsertAdminList(input: UpsertAdminListInput): Promise<PublicList> {
  const slug = input.slug.trim();
  const existingList = await getListBySlug(slug);
  const team = existingList ? null : await getTeamBySlug(input.teamSlug?.trim() || "what-to-eat");
  const teamId = existingList?.team_id ?? team?.id;

  if (!teamId) {
    throw new ListWriteError("Team not found.", "team_not_found");
  }

  const membership = await getTeamMembership(teamId, input.userId);

  if (!canManageTeamContent(membership?.role)) {
    throw new ListWriteError("Current user cannot manage lists for this team.", "not_allowed");
  }

  const list = await upsertListRecord({
    id: existingList?.id,
    teamId,
    slug,
    name: input.name.trim(),
    description: optionalText(input.description),
    visibility: input.visibility,
  });
  const places = await getPublicPlacesForListRecord(list);

  return {
    ...toListBase(list),
    stats: getStatsFromPlaces(places),
  };
}

export async function getAdminLists(input: GetAdminListsInput): Promise<AdminList[]> {
  const team = await getTeamBySlug(input.teamSlug?.trim() || "what-to-eat");

  if (!team) {
    throw new ListWriteError("Team not found.", "team_not_found");
  }

  const membership = await getTeamMembership(team.id, input.userId);

  if (!canManageTeamContent(membership?.role)) {
    throw new ListWriteError("Current user cannot read lists for this team.", "not_allowed");
  }

  const lists = await getListsForTeam(team.id);
  const listPlaces = await Promise.all(
    lists.map(async (list) => {
      const rows = await getPlacesForListId({ listId: list.id });
      const places = rows.map((row) => row.place);
      const ratings = await getRatingsForPlaces(places.map((place) => place.id));

      return {
        list,
        places: places.map((place) => toPublicPlace(place, list, ratings)),
      };
    }),
  );

  return listPlaces.map(({ list, places }) => ({
    ...toListBase(list),
    teamSlug: team.slug ?? "",
    stats: getStatsFromPlaces(places),
  }));
}

export async function archiveAdminPlace(input: ArchiveAdminPlaceInput): Promise<ArchiveAdminPlaceResult> {
  const place = await getPlaceByStableId(input.id);

  if (!place) {
    throw new PlaceWriteError("Place not found.", "place_not_found");
  }

  const membership = await getTeamMembership(place.team_id, input.userId);

  if (!canManageTeamContent(membership?.role)) {
    throw new PlaceWriteError("Current user cannot manage this place.", "not_allowed");
  }

  const archived = await archivePlaceRecord({
    placeId: place.id,
    archived: input.archived ?? true,
  });

  return {
    id: archived.import_key ?? archived.id,
    archivedAt: archived.archived_at,
  };
}

export async function getAdminArchivedPlaces(input: GetAdminArchivedPlacesInput): Promise<AdminArchivedPlace[]> {
  const team = await getTeamBySlug(input.teamSlug?.trim() || "what-to-eat");

  if (!team) {
    throw new PlaceWriteError("Team not found.", "team_not_found");
  }

  const membership = await getTeamMembership(team.id, input.userId);

  if (!canManageTeamContent(membership?.role)) {
    throw new PlaceWriteError("Current user cannot read archived places for this team.", "not_allowed");
  }

  const places = await getArchivedPlacesForTeam({
    teamId: team.id,
    limit: clampLimit(input.limit),
  });
  const listRows = await getListsForPlaces(places.map((place) => place.id));
  const listsByPlace = new Map<string, PublicListRecord[]>();

  for (const row of listRows) {
    const lists = listsByPlace.get(row.place_id) ?? [];
    lists.push(row.list);
    listsByPlace.set(row.place_id, lists);
  }

  return places.map((place) => {
    const lists = listsByPlace.get(place.id) ?? [];

    return {
      id: place.import_key ?? place.id,
      name: place.name,
      category: place.category ?? "",
      region: place.region ?? "",
      locationLabel: place.location_label ?? "",
      listSlugs: lists.map((list) => list.slug),
      listNames: lists.map((list) => list.name),
      archivedAt: place.archived_at as string,
    };
  });
}

export async function getAdminPlacesByList(input: GetAdminListPlacesInput): Promise<AdminListPlace[]> {
  const list = await getListBySlug(input.slug.trim());

  if (!list) {
    throw new PlaceWriteError("List not found.", "list_not_found");
  }

  const membership = await getTeamMembership(list.team_id, input.userId);

  if (!canManageTeamContent(membership?.role)) {
    throw new PlaceWriteError("Current user cannot read places for this list.", "not_allowed");
  }

  const rows = await getPlacesForListId({
    listId: list.id,
    includeArchived: input.includeArchived,
  });
  const places = rows.map((row) => row.place);
  const ratings = await getRatingsForPlaces(places.map((place) => place.id));

  return rows.map((row) => ({
    ...toPublicPlace(row.place, list, ratings),
    sortOrder: row.sort_order,
    archivedAt: row.place.archived_at,
  }));
}
