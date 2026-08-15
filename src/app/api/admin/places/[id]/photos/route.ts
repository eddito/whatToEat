import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import {
  deleteAdminPlacePhoto,
  PlacePhotoError,
  updateAdminPlacePhoto,
  uploadAdminPlacePhoto,
} from "@/server/places/service";

const photoUpdateRequestSchema = z.object({
  photoId: z.string().uuid(),
  isCover: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getPlaceId(params: { id: string }) {
  return decodeURIComponent(params.id);
}

function parseBooleanFormValue(value: FormDataEntryValue | null) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseSortOrderFormValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const sortOrder = Number(value);
  return Number.isInteger(sortOrder) && sortOrder >= 0 && sortOrder <= 10000 ? sortOrder : undefined;
}

function getPhotoStatus(error: PlacePhotoError) {
  if (error.code === "place_not_found" || error.code === "photo_not_found") {
    return 404;
  }

  if (error.code === "invalid_file" || error.code === "file_too_large") {
    return 400;
  }

  if (error.code === "storage_error") {
    return 502;
  }

  return 403;
}

function handlePhotoError(error: unknown) {
  if (error instanceof SessionError) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        message: error.message,
      },
      { status: 401 },
    );
  }

  if (error instanceof PlacePhotoError) {
    return NextResponse.json(
      {
        ok: false,
        error: error.code,
        message: error.message,
      },
      { status: getPhotoStatus(error) },
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      ok: false,
      error: "internal_error",
      message: "Unexpected place photo error.",
    },
    { status: 500 },
  );
}

export async function POST(request: Request, context: RouteContext) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Request body must be multipart/form-data.",
      },
      { status: 400 },
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Photo file is required.",
      },
      { status: 400 },
    );
  }

  try {
    const params = await context.params;
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const result = await uploadAdminPlacePhoto({
      userId: user.id,
      placeId: getPlaceId(params),
      file,
      isCover: parseBooleanFormValue(formData.get("isCover")),
      sortOrder: parseSortOrderFormValue(formData.get("sortOrder")),
    });

    return NextResponse.json({
      ok: true,
      photo: result.photo,
    });
  } catch (error) {
    return handlePhotoError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  const parsed = photoUpdateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Photo payload is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const params = await context.params;
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const result = await updateAdminPlacePhoto({
      userId: user.id,
      placeId: getPlaceId(params),
      ...parsed.data,
    });

    return NextResponse.json({
      ok: true,
      photo: result.photo,
    });
  } catch (error) {
    return handlePhotoError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const photoId = new URL(request.url).searchParams.get("photoId");

  if (!photoId || !z.string().uuid().safeParse(photoId).success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Valid photoId is required.",
      },
      { status: 400 },
    );
  }

  try {
    const params = await context.params;
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const result = await deleteAdminPlacePhoto({
      userId: user.id,
      placeId: getPlaceId(params),
      photoId,
    });

    return NextResponse.json({
      ok: true,
      photo: result.photo,
      deleted: result.deleted,
    });
  } catch (error) {
    return handlePhotoError(error);
  }
}
