import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { canEditTeamData, getAdminContext } from "@/server/admin/context";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const PHOTO_BUCKET = process.env.SUPABASE_PLACE_PHOTOS_BUCKET || "place-photos";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function toPhoto(row: { id: string; url: string; is_cover: boolean; sort_order: number; created_at: string }) {
  return {
    id: row.id,
    url: row.url,
    isCover: row.is_cover,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function POST(request: Request) {
  const context = await getAdminContext(request);

  if (!context.ok) {
    return context.response;
  }

  if (!canEditTeamData(context.membership.role)) {
    return NextResponse.json({ error: "当前角色不能上传店铺图片。" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const placeId = formData?.get("placeId");
  const file = formData?.get("file");

  if (typeof placeId !== "string" || !placeId.trim() || !(file instanceof File)) {
    return NextResponse.json({ error: "图片上传参数不正确。" }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json({ error: "只支持 JPG、PNG 或 WebP 图片。" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "图片不能超过 5MB。" }, { status: 400 });
  }

  const placeQuery = context.supabase.from("places").select("id").eq("team_id", context.team.id);
  const { data: place, error: placeError } = UUID_PATTERN.test(placeId)
    ? await placeQuery.eq("id", placeId).maybeSingle()
    : await placeQuery.eq("import_key", placeId).maybeSingle();

  if (placeError) {
    throw placeError;
  }

  if (!place) {
    return NextResponse.json({ error: "店铺不存在或不属于当前小队。" }, { status: 404 });
  }

  const existingPhotos = await context.supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("place_id", place.id);

  if (existingPhotos.error) {
    throw existingPhotos.error;
  }

  const sortOrder = existingPhotos.count ?? 0;
  const storagePath = `${context.team.slug}/${place.id}/${randomUUID()}.${getExtension(file)}`;
  const uploadResult = await context.supabase.storage.from(PHOTO_BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadResult.error) {
    return NextResponse.json({ error: `图片上传失败：${uploadResult.error.message}` }, { status: 400 });
  }

  const publicUrl = context.supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath).data.publicUrl;
  const { data: photo, error: photoError } = await context.supabase
    .from("photos")
    .insert({
      place_id: place.id,
      url: publicUrl,
      is_cover: sortOrder === 0,
      sort_order: sortOrder,
    })
    .select("id, url, is_cover, sort_order, created_at")
    .single();

  if (photoError) {
    throw photoError;
  }

  const coverResult = await context.supabase
    .from("photos")
    .select("url")
    .eq("place_id", place.id)
    .order("is_cover", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (coverResult.error) {
    throw coverResult.error;
  }

  return NextResponse.json({
    photo: toPhoto(photo),
    coverPhotoUrl: coverResult.data?.url ?? publicUrl,
    photoCount: sortOrder + 1,
    message: "图片已上传。",
  });
}
