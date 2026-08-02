import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { getAdminPlacesByList, PlaceWriteError } from "@/server/places/service";

const adminListPlacesQuerySchema = z.object({
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value ? value === "true" : undefined)),
});

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: { slug: string };
  },
) {
  const url = new URL(request.url);
  const parsed = adminListPlacesQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Admin list places query is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const places = await getAdminPlacesByList({
      userId: user.id,
      slug: params.slug,
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
      const status = error.code === "list_not_found" ? 404 : 403;

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
        message: "Unexpected admin list places read error.",
      },
      { status: 500 },
    );
  }
}
