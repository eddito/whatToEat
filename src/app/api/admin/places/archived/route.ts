import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { getAdminArchivedPlaces, PlaceWriteError } from "@/server/places/service";

const archivedPlacesQuerySchema = z.object({
  teamSlug: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = archivedPlacesQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Archived places query is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const places = await getAdminArchivedPlaces({
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
        message: "Unexpected archived places read error.",
      },
      { status: 500 },
    );
  }
}
