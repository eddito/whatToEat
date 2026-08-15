import "server-only";

import { randomUUID } from "node:crypto";
import { getMixedScore } from "@/lib/score";
import type { ListSlug, ListSummary, Place } from "@/lib/types";
import {
  archivePlaceRecord,
  deletePhotoRecord,
  getArchivedPlacesForTeam,
  getListBySlug,
  getListPlaceLinks,
  getListsForTeam,
  getListsForPlaces,
  getPlacesForListId,
  getPlacesForTeam,
  getPlacesForPublicListId,
  getPhotosForPlaces,
  getPhotoById,
  getPublicListBySlug,
  getPublicLists,
  getPublicListsForPlace,
  getPlaceByStableId,
  getPublicPlaceByStableId,
  getRatingsForPlaces,
  insertPhotoRecord,
  isUuid,
  type ListVisibility,
  type PhotoRecord,
  type PlaceRecord,
  type PublicListRecord,
  type RatingRecord,
  upsertListPlace,
  upsertListRecord,
  upsertPlaceRecord,
  updatePhotoRecord,
  updateListPlaceSortOrders,
} from "@/server/places/repository";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { canManageTeamContent, canReadTeamContent, getTeamBySlug, getTeamMembership } from "@/server/teams/repository";

const PLACE_PHOTOS_BUCKET = "place-photos";
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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
  externalScore: number;
  externalRatingCount: number;
  mixedScore: number;
  coverPhotoUrl?: string;
  photoCount: number;
  longitude?: number;
  latitude?: number;
};

export type PublicPlacePhoto = {
  id: string;
  url: string;
  isCover: boolean;
  sortOrder: number;
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

export type GetAdminPlaceInput = {
  userId: string;
  id: string;
};

export type GetAdminPlacesInput = {
  userId: string;
  teamSlug?: string;
  query?: string;
  category?: string;
  region?: string;
  includeArchived?: boolean;
  limit?: number;
};

export type GetAdminListPlacesInput = {
  userId: string;
  slug: string;
  includeArchived?: boolean;
};

export type ReorderAdminListPlacesInput = {
  userId: string;
  slug: string;
  placeIds: string[];
};

export type UploadAdminPlacePhotoInput = {
  userId: string;
  placeId: string;
  file: File;
  isCover?: boolean;
  sortOrder?: number;
};

export type UpdateAdminPlacePhotoInput = {
  userId: string;
  placeId: string;
  photoId: string;
  isCover?: boolean;
  sortOrder?: number;
};

export type DeleteAdminPlacePhotoInput = {
  userId: string;
  placeId: string;
  photoId: string;
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

export type ReorderAdminListPlacesResult = {
  listSlug: string;
  updated: number;
};

export type AdminList = PublicList & {
  teamSlug: string;
};

export type AdminPlaceDetail = PublicPlace & {
  teamId: string;
  archivedAt: string | null;
  photos: PublicPlacePhoto[];
  lists: Array<{
    slug: string;
    name: string;
    visibility: ListVisibility;
  }>;
};

export type AdminPlaceSummary = PublicPlace & {
  teamId: string;
  listSlugs: string[];
  listNames: string[];
  archivedAt: string | null;
};

export type AdminPlacePhotoMutationResult = {
  photo: PublicPlacePhoto | null;
  deleted?: boolean;
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

export class ListPlaceOrderError extends Error {
  constructor(
    message: string,
    public readonly code: "list_not_found" | "not_allowed" | "duplicate_place_id" | "place_not_in_list",
  ) {
    super(message);
    this.name = "ListPlaceOrderError";
  }
}

export class PlacePhotoError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "place_not_found"
      | "photo_not_found"
      | "not_allowed"
      | "invalid_file"
      | "file_too_large"
      | "storage_error",
  ) {
    super(message);
    this.name = "PlacePhotoError";
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
  const externalRatings = ratings.filter((rating) => rating.place_id === placeId && rating.source === "external");
  const memberScores = Object.fromEntries(
    teamRatings
      .filter((rating) => rating.rater_label)
      .map((rating) => [rating.rater_label as string, Number(rating.score)]),
  );
  const scored = teamRatings.map((rating) => Number(rating.score)).filter((score) => score > 0);
  const teamScore = scored.length > 0 ? scored.reduce((sum, score) => sum + score, 0) / scored.length : 0;
  const externalScored = externalRatings.map((rating) => Number(rating.score)).filter((score) => score > 0);
  const externalScore =
    externalScored.length > 0 ? externalScored.reduce((sum, score) => sum + score, 0) / externalScored.length : 0;
  const roundedTeamScore = Number(teamScore.toFixed(1));
  const roundedExternalScore = Number(externalScore.toFixed(1));

  return {
    memberScores,
    teamScore: roundedTeamScore,
    externalScore: roundedExternalScore,
    externalRatingCount: externalScored.length,
    mixedScore: getMixedScore(roundedTeamScore, roundedExternalScore, externalScored.length),
  };
}

function toPublicPlacePhoto(photo: PhotoRecord): PublicPlacePhoto {
  return {
    id: photo.id,
    url: photo.url,
    isCover: photo.is_cover,
    sortOrder: photo.sort_order,
  };
}

function getSortedPhotos(photos: PhotoRecord[]) {
  return [...photos].sort(
    (a, b) =>
      Number(b.is_cover) - Number(a.is_cover) ||
      a.sort_order - b.sort_order ||
      a.created_at.localeCompare(b.created_at),
  );
}

function getPhotosByPlace(photos: PhotoRecord[]) {
  const photosByPlace = new Map<string, PhotoRecord[]>();

  for (const photo of photos) {
    const current = photosByPlace.get(photo.place_id) ?? [];
    current.push(photo);
    photosByPlace.set(photo.place_id, current);
  }

  return photosByPlace;
}

function toPublicPlace(
  place: PlaceRecord,
  list: PublicListRecord,
  ratings: RatingRecord[],
  photos: PhotoRecord[] = [],
): PublicPlace {
  const ratingSummary = buildRatingSummary(place.id, ratings);
  const sortedPhotos = getSortedPhotos(photos);

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
    externalScore: ratingSummary.externalScore,
    externalRatingCount: ratingSummary.externalRatingCount,
    mixedScore: ratingSummary.mixedScore,
    coverPhotoUrl: sortedPhotos[0]?.url,
    photoCount: sortedPhotos.length,
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

function getPhotoExtension(file: File) {
  const originalName = file.name.trim().toLowerCase();
  const extension = originalName.match(/\.([a-z0-9]+)$/)?.[1];

  if (extension && ["jpg", "jpeg", "png", "webp", "gif"].includes(extension)) {
    return extension === "jpeg" ? "jpg" : extension;
  }

  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";

  return "bin";
}

async function getManageablePhotoPlace(input: {
  userId: string;
  placeId: string;
}) {
  const place = await getPlaceByStableId(input.placeId);

  if (!place) {
    throw new PlacePhotoError("Place not found.", "place_not_found");
  }

  const membership = await getTeamMembership(place.team_id, input.userId);

  if (!canManageTeamContent(membership?.role)) {
    throw new PlacePhotoError("Current user cannot manage photos for this place.", "not_allowed");
  }

  return place;
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
  const placeIds = places.map((place) => place.id);
  const [ratings, photos] = await Promise.all([getRatingsForPlaces(placeIds), getPhotosForPlaces(placeIds)]);
  const photosByPlace = getPhotosByPlace(photos);

  return places.map((place) => toPublicPlace(place, list, ratings, photosByPlace.get(place.id)));
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

  const [ratings, photos] = await Promise.all([getRatingsForPlaces([place.id]), getPhotosForPlaces([place.id])]);

  return toPublicPlace(place, lists[0], ratings, photos);
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
    externalScore: place.externalScore,
    externalRatingCount: place.externalRatingCount,
    mixedScore: place.mixedScore,
    legacyScore: 0,
    coverPhotoUrl: place.coverPhotoUrl,
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
      externalScore: place.externalScore,
      externalRatingCount: place.externalRatingCount,
      mixedScore: place.mixedScore,
      photoCount: 0,
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

  if (!canReadTeamContent(membership?.role)) {
    throw new ListWriteError("Current user cannot read lists for this team.", "not_allowed");
  }

  const lists = await getListsForTeam(team.id);
  const listPlaces = await Promise.all(
    lists.map(async (list) => {
      const rows = await getPlacesForListId({ listId: list.id });
      const places = rows.map((row) => row.place);
      const placeIds = places.map((place) => place.id);
      const [ratings, photos] = await Promise.all([getRatingsForPlaces(placeIds), getPhotosForPlaces(placeIds)]);
      const photosByPlace = getPhotosByPlace(photos);

      return {
        list,
        places: places.map((place) => toPublicPlace(place, list, ratings, photosByPlace.get(place.id))),
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

  if (!canReadTeamContent(membership?.role)) {
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

export async function getAdminPlace(input: GetAdminPlaceInput): Promise<AdminPlaceDetail> {
  const place = await getPlaceByStableId(input.id);

  if (!place) {
    throw new PlaceWriteError("Place not found.", "place_not_found");
  }

  const membership = await getTeamMembership(place.team_id, input.userId);

  if (!canReadTeamContent(membership?.role)) {
    throw new PlaceWriteError("Current user cannot read this place.", "not_allowed");
  }

  const [listRows, ratings, photos] = await Promise.all([
    getListsForPlaces([place.id]),
    getRatingsForPlaces([place.id]),
    getPhotosForPlaces([place.id]),
  ]);
  const primaryList = listRows[0]?.list ?? {
    id: "",
    team_id: place.team_id,
    slug: "",
    name: "",
    description: null,
    visibility: "private" as ListVisibility,
  };

  return {
    ...toPublicPlace(place, primaryList, ratings, photos),
    teamId: place.team_id,
    archivedAt: place.archived_at,
    photos: getSortedPhotos(photos).map(toPublicPlacePhoto),
    lists: listRows.map((row) => ({
      slug: row.list.slug,
      name: row.list.name,
      visibility: row.list.visibility,
    })),
  };
}

function placeMatchesQuery(place: PlaceRecord, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    place.id,
    place.import_key,
    place.name,
    place.category,
    place.region,
    place.location_label,
    place.signature_dishes,
    place.review_summary,
    place.source_label,
    ...(place.taste_tags ?? []),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase().includes(normalizedQuery));
}

export async function getAdminPlaces(input: GetAdminPlacesInput): Promise<AdminPlaceSummary[]> {
  const team = await getTeamBySlug(input.teamSlug?.trim() || "what-to-eat");

  if (!team) {
    throw new PlaceWriteError("Team not found.", "team_not_found");
  }

  const membership = await getTeamMembership(team.id, input.userId);

  if (!canReadTeamContent(membership?.role)) {
    throw new PlaceWriteError("Current user cannot read places for this team.", "not_allowed");
  }

  const limit = clampLimit(input.limit);
  const places = (
    await getPlacesForTeam({
      teamId: team.id,
      category: optionalText(input.category),
      region: optionalText(input.region),
      includeArchived: input.includeArchived,
      limit: input.query ? 200 : limit,
    })
  )
    .filter((place) => placeMatchesQuery(place, input.query ?? ""))
    .slice(0, limit);
  const placeIds = places.map((place) => place.id);
  const [listRows, ratings, photos] = await Promise.all([
    getListsForPlaces(places.map((place) => place.id)),
    getRatingsForPlaces(placeIds),
    getPhotosForPlaces(placeIds),
  ]);
  const listsByPlace = new Map<string, PublicListRecord[]>();
  const photosByPlace = getPhotosByPlace(photos);

  for (const row of listRows) {
    const lists = listsByPlace.get(row.place_id) ?? [];
    lists.push(row.list);
    listsByPlace.set(row.place_id, lists);
  }

  return places.map((place) => {
    const lists = listsByPlace.get(place.id) ?? [];
    const primaryList = lists[0] ?? {
      id: "",
      team_id: place.team_id,
      slug: "",
      name: "",
      description: null,
      visibility: "private" as ListVisibility,
    };

    return {
      ...toPublicPlace(place, primaryList, ratings, photosByPlace.get(place.id)),
      teamId: place.team_id,
      listSlugs: lists.map((list) => list.slug),
      listNames: lists.map((list) => list.name),
      archivedAt: place.archived_at,
    };
  });
}

export async function getAdminPlacesByList(input: GetAdminListPlacesInput): Promise<AdminListPlace[]> {
  const list = await getListBySlug(input.slug.trim());

  if (!list) {
    throw new PlaceWriteError("List not found.", "list_not_found");
  }

  const membership = await getTeamMembership(list.team_id, input.userId);

  if (!canReadTeamContent(membership?.role)) {
    throw new PlaceWriteError("Current user cannot read places for this list.", "not_allowed");
  }

  const rows = await getPlacesForListId({
    listId: list.id,
    includeArchived: input.includeArchived,
  });
  const places = rows.map((row) => row.place);
  const placeIds = places.map((place) => place.id);
  const [ratings, photos] = await Promise.all([getRatingsForPlaces(placeIds), getPhotosForPlaces(placeIds)]);
  const photosByPlace = getPhotosByPlace(photos);

  return rows.map((row) => ({
    ...toPublicPlace(row.place, list, ratings, photosByPlace.get(row.place.id)),
    sortOrder: row.sort_order,
    archivedAt: row.place.archived_at,
  }));
}

export async function uploadAdminPlacePhoto(input: UploadAdminPlacePhotoInput): Promise<AdminPlacePhotoMutationResult> {
  const place = await getManageablePhotoPlace({
    userId: input.userId,
    placeId: input.placeId,
  });

  if (!ALLOWED_PHOTO_TYPES.has(input.file.type)) {
    throw new PlacePhotoError("Photo must be a jpeg, png, webp, or gif image.", "invalid_file");
  }

  if (input.file.size <= 0) {
    throw new PlacePhotoError("Photo file is empty.", "invalid_file");
  }

  if (input.file.size > MAX_PHOTO_BYTES) {
    throw new PlacePhotoError("Photo exceeds the 10MB limit.", "file_too_large");
  }

  const extension = getPhotoExtension(input.file);
  const storagePath = `${place.team_id}/${place.id}/${randomUUID()}.${extension}`;
  const supabase = createSupabaseAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(PLACE_PHOTOS_BUCKET)
    .upload(storagePath, input.file, {
      contentType: input.file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new PlacePhotoError(uploadError.message, "storage_error");
  }

  const { data } = supabase.storage.from(PLACE_PHOTOS_BUCKET).getPublicUrl(storagePath);
  let photo: PhotoRecord;

  try {
    photo = await insertPhotoRecord({
      placeId: place.id,
      url: data.publicUrl,
      storagePath,
      isCover: input.isCover ?? false,
      sortOrder: input.sortOrder ?? 0,
    });
  } catch (error) {
    await supabase.storage.from(PLACE_PHOTOS_BUCKET).remove([storagePath]);
    throw error;
  }

  return {
    photo: toPublicPlacePhoto(photo),
  };
}

export async function updateAdminPlacePhoto(input: UpdateAdminPlacePhotoInput): Promise<AdminPlacePhotoMutationResult> {
  const place = await getManageablePhotoPlace({
    userId: input.userId,
    placeId: input.placeId,
  });
  const existingPhoto = await getPhotoById(input.photoId);

  if (!existingPhoto || existingPhoto.place_id !== place.id) {
    throw new PlacePhotoError("Photo not found.", "photo_not_found");
  }

  const photo = await updatePhotoRecord({
    photoId: input.photoId,
    placeId: place.id,
    isCover: input.isCover,
    sortOrder: input.sortOrder,
  });

  return {
    photo: photo ? toPublicPlacePhoto(photo) : null,
  };
}

export async function deleteAdminPlacePhoto(input: DeleteAdminPlacePhotoInput): Promise<AdminPlacePhotoMutationResult> {
  const place = await getManageablePhotoPlace({
    userId: input.userId,
    placeId: input.placeId,
  });
  const existingPhoto = await getPhotoById(input.photoId);

  if (!existingPhoto || existingPhoto.place_id !== place.id) {
    throw new PlacePhotoError("Photo not found.", "photo_not_found");
  }

  if (existingPhoto.storage_path) {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage.from(PLACE_PHOTOS_BUCKET).remove([existingPhoto.storage_path]);

    if (error) {
      throw new PlacePhotoError(error.message, "storage_error");
    }
  }

  const photo = await deletePhotoRecord({
    photoId: input.photoId,
    placeId: place.id,
  });

  return {
    photo: photo ? toPublicPlacePhoto(photo) : null,
    deleted: Boolean(photo),
  };
}

export async function reorderAdminListPlaces(
  input: ReorderAdminListPlacesInput,
): Promise<ReorderAdminListPlacesResult> {
  const list = await getListBySlug(input.slug.trim());

  if (!list) {
    throw new ListPlaceOrderError("List not found.", "list_not_found");
  }

  const membership = await getTeamMembership(list.team_id, input.userId);

  if (!canManageTeamContent(membership?.role)) {
    throw new ListPlaceOrderError("Current user cannot reorder places for this list.", "not_allowed");
  }

  const stableIds = input.placeIds.map((placeId) => placeId.trim()).filter(Boolean);

  if (new Set(stableIds).size !== stableIds.length) {
    throw new ListPlaceOrderError("Place ids must be unique.", "duplicate_place_id");
  }

  const [links, places] = await Promise.all([
    getListPlaceLinks(list.id),
    Promise.all(stableIds.map((stableId) => getPlaceByStableId(stableId))),
  ]);
  const linkPlaceIds = new Set(links.map((link) => link.place_id));
  const orders = places.map((place, index) => {
    if (!place || place.team_id !== list.team_id || !linkPlaceIds.has(place.id)) {
      throw new ListPlaceOrderError("All places must already belong to the target list.", "place_not_in_list");
    }

    return {
      placeId: place.id,
      sortOrder: index,
    };
  });

  await updateListPlaceSortOrders({
    listId: list.id,
    orders,
  });

  return {
    listSlug: list.slug,
    updated: orders.length,
  };
}
