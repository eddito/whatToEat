import { NextResponse } from "next/server";
import { z } from "zod";
import { canEditTeamData, getAdminContext } from "@/server/admin/context";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PlaceBody = z.object({
  placeId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().max(40).optional(),
  tasteTags: z.array(z.string().trim().min(1).max(20)).max(12).optional(),
  signatureDishes: z.string().trim().max(200).optional(),
  review: z.string().trim().max(800).optional(),
  region: z.string().trim().max(40).optional(),
  locationLabel: z.string().trim().max(160).optional(),
  parkingNote: z.string().trim().max(160).optional(),
  sourceLabel: z.string().trim().max(80).optional(),
  visited: z.boolean().optional(),
});

function toNullableText(value?: string) {
  return value?.trim() || null;
}

function toAdminPlace(row: {
  id: string;
  import_key: string | null;
  name: string;
  category: string | null;
  taste_tags: string[] | null;
  signature_dishes: string | null;
  review_summary: string | null;
  region: string | null;
  location_label: string | null;
  parking_note: string | null;
  source_label: string | null;
  visited: boolean;
  geocode_status: string;
  updated_at: string;
}) {
  return {
    id: row.import_key ?? row.id,
    databaseId: row.id,
    name: row.name,
    category: row.category ?? "",
    tasteTags: row.taste_tags ?? [],
    signatureDishes: row.signature_dishes ?? "",
    review: row.review_summary ?? "",
    region: row.region ?? "",
    locationLabel: row.location_label ?? "",
    parkingNote: row.parking_note ?? "",
    sourceLabel: row.source_label ?? "",
    visited: row.visited,
    geocodeStatus: row.geocode_status,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: Request) {
  const context = await getAdminContext(request);

  if (!context.ok) {
    return context.response;
  }

  const search = new URL(request.url).searchParams.get("q")?.trim();
  let query = context.supabase
    .from("places")
    .select(
      "id, import_key, name, category, taste_tags, signature_dishes, review_summary, region, location_label, parking_note, source_label, visited, geocode_status, updated_at",
    )
    .eq("team_id", context.team.id)
    .order("updated_at", { ascending: false })
    .limit(24);

  if (search) {
    const escaped = search.replaceAll("%", "\\%").replaceAll("_", "\\_");
    query = query.or(`name.ilike.%${escaped}%,category.ilike.%${escaped}%,region.ilike.%${escaped}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return NextResponse.json({
    places: (data ?? []).map(toAdminPlace),
    canEdit: canEditTeamData(context.membership.role),
  });
}

export async function PATCH(request: Request) {
  const context = await getAdminContext(request);

  if (!context.ok) {
    return context.response;
  }

  if (!canEditTeamData(context.membership.role)) {
    return NextResponse.json({ error: "当前角色不能编辑店铺资料。" }, { status: 403 });
  }

  const parsed = PlaceBody.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "店铺资料参数不正确。" }, { status: 400 });
  }

  const payload = {
    name: parsed.data.name,
    category: toNullableText(parsed.data.category),
    taste_tags: parsed.data.tasteTags ?? [],
    signature_dishes: toNullableText(parsed.data.signatureDishes),
    review_summary: toNullableText(parsed.data.review),
    region: toNullableText(parsed.data.region),
    location_label: toNullableText(parsed.data.locationLabel),
    parking_note: toNullableText(parsed.data.parkingNote),
    source_label: toNullableText(parsed.data.sourceLabel),
    visited: parsed.data.visited ?? false,
    updated_at: new Date().toISOString(),
  };
  const placeQuery = context.supabase
    .from("places")
    .update(payload)
    .eq("team_id", context.team.id)
    .select(
      "id, import_key, name, category, taste_tags, signature_dishes, review_summary, region, location_label, parking_note, source_label, visited, geocode_status, updated_at",
    );
  const { data, error } = UUID_PATTERN.test(parsed.data.placeId)
    ? await placeQuery.eq("id", parsed.data.placeId).maybeSingle()
    : await placeQuery.eq("import_key", parsed.data.placeId).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return NextResponse.json({ error: "店铺不存在或不属于当前小队。" }, { status: 404 });
  }

  return NextResponse.json({
    place: toAdminPlace(data),
    message: "店铺资料已保存。",
  });
}
