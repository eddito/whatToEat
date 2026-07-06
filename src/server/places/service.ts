import "server-only";

import type { ListSlug, ListSummary, Place } from "@/lib/types";
import {
  getPlacesForPublicListId,
  getPublicListBySlug,
  getPublicLists,
  getPublicListsForPlace,
  getPublicPlaceByStableId,
  getRatingsForPlaces,
  type ListVisibility,
  type PlaceRecord,
  type PublicListRecord,
  type RatingRecord,
} from "@/server/places/repository";

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
