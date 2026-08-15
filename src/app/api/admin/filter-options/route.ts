import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { getAdminFilterOptions, PlaceWriteError } from "@/server/places/service";

const filterOptionsQuerySchema = z.object({
  teamSlug: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = filterOptionsQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Filter options query is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const filterOptions = await getAdminFilterOptions({
      userId: user.id,
      ...parsed.data,
    });

    return NextResponse.json({
      ok: true,
      filterOptions,
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
        message: "Unexpected filter options read error.",
      },
      { status: 500 },
    );
  }
}
