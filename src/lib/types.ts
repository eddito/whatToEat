export type ListSlug = "red-list" | "retry-list";

export type Place = {
  id: string;
  listSlug: ListSlug;
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
  memberScores: {
    yang: number;
    chen: number;
  };
  teamScore: number;
  legacyScore: number;
  longitude?: number;
  latitude?: number;
};

export type ListSummary = {
  slug: ListSlug;
  name: string;
  description: string;
  visibility: "private" | "public_view" | "public_rate";
};
