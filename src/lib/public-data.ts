import "server-only";

import {
  getCategories as getSeedCategories,
  getList as getSeedList,
  getPlace as getSeedPlace,
  getPlacesByList as getSeedPlacesByList,
  getRegions as getSeedRegions,
  getTopPlaces as getSeedTopPlaces,
  lists as seedLists,
  places as seedPlaces,
} from "@/lib/places";
import type { ListSummary, Place } from "@/lib/types";
import {
  getPublicListPageData,
  getPublicPlaceData,
  getPublicPlacePageData,
  getListStatsFromPlaces,
  type PublicListStats,
} from "@/server/places/service";

export type PublicDataSource = "supabase" | "seed";

export type ListWithStats = {
  list: ListSummary;
  stats: PublicListStats;
};

function getStats(places: Place[]) {
  return getListStatsFromPlaces(places);
}

function getSeedListsWithStats(): ListWithStats[] {
  return seedLists.map((list) => ({
    list,
    stats: getStats(seedPlaces.filter((place) => place.listSlug === list.slug)),
  }));
}

function getRegionsFromPlaces(places: Place[]) {
  return Array.from(new Set(places.map((place) => place.region).filter(Boolean))).sort();
}

function getCategoriesFromPlaces(places: Place[]) {
  return Array.from(new Set(places.map((place) => place.category).filter(Boolean))).sort();
}

async function trySupabase<T>(load: () => Promise<T>) {
  try {
    return await load();
  } catch {
    return null;
  }
}

export async function getHomeData() {
  const supabaseData = await trySupabase(getPublicPlaceData);

  if (supabaseData) {
    const places = supabaseData.places;
    const listsWithStats = supabaseData.lists.map((list) => ({
      list,
      stats: getStats(places.filter((place) => place.listSlug === list.slug)),
    }));

    return {
      source: "supabase" as PublicDataSource,
      lists: supabaseData.lists,
      listsWithStats,
      places,
      topPlaces: [...places].sort((a, b) => b.teamScore - a.teamScore || a.name.localeCompare(b.name, "zh-Hans-CN")).slice(0, 9),
      regions: getRegionsFromPlaces(places),
      categories: getCategoriesFromPlaces(places),
    };
  }

  return {
    source: "seed" as PublicDataSource,
    lists: seedLists,
    listsWithStats: getSeedListsWithStats(),
    places: seedPlaces,
    topPlaces: getSeedTopPlaces(9),
    regions: getSeedRegions(),
    categories: getSeedCategories(),
  };
}

export async function getListPageData(slug: string) {
  const supabaseData = await trySupabase(() => getPublicListPageData(slug));

  if (supabaseData) {
    return {
      source: "supabase" as PublicDataSource,
      lists: supabaseData.lists,
      list: supabaseData.list,
      places: supabaseData.places,
      stats: supabaseData.stats,
    };
  }

  const list = getSeedList(slug);

  if (!list) {
    return null;
  }

  const places = getSeedPlacesByList(list.slug);

  return {
    source: "seed" as PublicDataSource,
    lists: seedLists,
    list,
    places,
    stats: getStats(places),
  };
}

export async function getPlacePageData(id: string) {
  const supabaseData = await trySupabase(() => getPublicPlacePageData(id));

  if (supabaseData) {
    return {
      source: "supabase" as PublicDataSource,
      place: supabaseData,
    };
  }

  const place = getSeedPlace(id);

  if (!place) {
    return null;
  }

  return {
    source: "seed" as PublicDataSource,
    place,
  };
}

export async function getMapPageData() {
  const supabaseData = await trySupabase(getPublicPlaceData);

  if (supabaseData) {
    return {
      source: "supabase" as PublicDataSource,
      places: supabaseData.places,
    };
  }

  return {
    source: "seed" as PublicDataSource,
    places: seedPlaces,
  };
}
