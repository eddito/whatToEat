import seedPlaces from "@/data/seed-places.json";
import type { ListSlug, ListSummary, Place } from "./types";

export const lists: ListSummary[] = [
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

export const places = seedPlaces as Place[];

export function getList(slug: string) {
  return lists.find((list) => list.slug === slug);
}

export function getPlacesByList(slug: string) {
  return places.filter((place) => place.listSlug === slug);
}

export function getPlace(id: string) {
  return places.find((place) => place.id === id);
}

export function getRegions() {
  return Array.from(new Set(places.map((place) => place.region).filter(Boolean))).sort();
}

export function getCategories() {
  return Array.from(new Set(places.map((place) => place.category).filter(Boolean))).sort();
}

export function getTopPlaces(limit = 12) {
  return [...places]
    .sort((a, b) => b.teamScore - a.teamScore || a.name.localeCompare(b.name, "zh-Hans-CN"))
    .slice(0, limit);
}

export function getListStats(slug: ListSlug) {
  const listPlaces = getPlacesByList(slug);
  const scored = listPlaces.filter((place) => place.teamScore > 0);
  const avg =
    scored.length > 0
      ? scored.reduce((sum, place) => sum + place.teamScore, 0) / scored.length
      : 0;

  return {
    count: listPlaces.length,
    scoredCount: scored.length,
    avgScore: Number(avg.toFixed(1)),
  };
}
