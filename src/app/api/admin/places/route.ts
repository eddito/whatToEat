import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { PlaceWriteError, upsertAdminPlace } from "@/server/places/service";

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
