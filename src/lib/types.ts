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
  externalScore: number;
  externalRatingCount: number;
  mixedScore: number;
  legacyScore: number;
  coverPhotoUrl?: string;
  featuredDishes?: PlaceDish[];
  longitude?: number;
  latitude?: number;
};

export type PlaceDish = {
  id: string;
  name: string;
  description: string;
  photoUrl: string;
  sortOrder: number;
};

export type ListSummary = {
  slug: ListSlug;
  name: string;
  description: string;
  visibility: "private" | "public_view" | "public_rate";
};
