import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { getAdminPlaces, PlaceWriteError, upsertAdminPlace } from "@/server/places/service";

const includeArchivedQuerySchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

const adminPlacesQuerySchema = z.object({
  teamSlug: z.string().min(1).optional(),
  query: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  includeArchived: includeArchivedQuerySchema,
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const upsertPlaceRequestSchema = z.object({
  id: z.string().min(1).optional(),
  listSlug: z.string().min(1),
  importKey: z.string().min(1).optional(),
  name: z.string().min(1),
  category: z.string().nullable().optional(),
  tasteTags: z.array(z.string()).optional(),
  signatureDishes: z.string().nullable().optional(),
  review: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  locationLabel: z.string().nullable().optional(),
  parkingNote: z.string().nullable().optional(),
  sourceLabel: z.string().nullable().optional(),
  visited: z.boolean().optional(),
  longitude: z.number().nullable().optional(),
  latitude: z.number().nullable().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = adminPlacesQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Admin places query is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const places = await getAdminPlaces({
      userId: user.id,
      ...parsed.data,
    });

    return NextResponse.json({
      ok: true,
      places,
    });
  } catch (error) {
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

    if (error instanceof PlaceWriteError) {
      const status = error.code === "team_not_found" ? 404 : 403;

      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          message: error.message,
        },
        { status },
      );
    }

    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Unexpected admin places read error.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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

  const parsed = upsertPlaceRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Place payload is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const place = await upsertAdminPlace({
      userId: user.id,
      ...parsed.data,
    });

    return NextResponse.json({
      ok: true,
      place,
    });
  } catch (error) {
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

    if (error instanceof PlaceWriteError) {
      const status = error.code === "list_not_found" || error.code === "place_not_found" ? 404 : 403;

      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          message: error.message,
        },
        { status },
      );
    }

    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Unexpected place write error.",
      },
      { status: 500 },
    );
  }
}
