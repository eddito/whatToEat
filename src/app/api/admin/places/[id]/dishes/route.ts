import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import {
  deleteAdminPlaceDish,
  PlaceDishError,
  updateAdminPlaceDish,
  uploadAdminPlaceDish,
} from "@/server/places/service";

const dishUpdateRequestSchema = z.object({
  dishId: z.string().uuid(),
  name: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

function getPlaceId(params: { id: string }) {
  return decodeURIComponent(params.id);
}

function parseSortOrderFormValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const sortOrder = Number(value);
  return Number.isInteger(sortOrder) && sortOrder >= 0 && sortOrder <= 10000 ? sortOrder : undefined;
}

function getStringFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function getDishStatus(error: PlaceDishError) {
  if (error.code === "place_not_found" || error.code === "dish_not_found") {
    return 404;
  }

  if (error.code === "invalid_file" || error.code === "file_too_large" || error.code === "invalid_name") {
    return 400;
  }

  if (error.code === "storage_error") {
    return 502;
  }

  return 403;
}

function handleDishError(error: unknown) {
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

  if (error instanceof PlaceDishError) {
    return NextResponse.json(
      {
        ok: false,
        error: error.code,
        message: error.message,
      },
      { status: getDishStatus(error) },
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      ok: false,
      error: "internal_error",
      message: "Unexpected place dish error.",
    },
    { status: 500 },
  );
}

export async function POST(request: Request, context: { params: { id: string } }) {
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
        message: "Dish photo file is required.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const result = await uploadAdminPlaceDish({
      userId: user.id,
      placeId: getPlaceId(context.params),
      file,
      name: getStringFormValue(formData.get("name")),
      description: getStringFormValue(formData.get("description")),
      sortOrder: parseSortOrderFormValue(formData.get("sortOrder")),
    });

    return NextResponse.json({
      ok: true,
      dish: result.dish,
    });
  } catch (error) {
    return handleDishError(error);
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
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

  const parsed = dishUpdateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Dish payload is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const result = await updateAdminPlaceDish({
      userId: user.id,
      placeId: getPlaceId(context.params),
      ...parsed.data,
    });

    return NextResponse.json({
      ok: true,
      dish: result.dish,
    });
  } catch (error) {
    return handleDishError(error);
  }
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  const dishId = new URL(request.url).searchParams.get("dishId");

  if (!dishId || !z.string().uuid().safeParse(dishId).success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Valid dishId is required.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const result = await deleteAdminPlaceDish({
      userId: user.id,
      placeId: getPlaceId(context.params),
      dishId,
    });

    return NextResponse.json({
      ok: true,
      dish: result.dish,
      deleted: result.deleted,
    });
  } catch (error) {
    return handleDishError(error);
  }
}
