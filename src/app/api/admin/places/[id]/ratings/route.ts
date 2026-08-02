import { NextResponse } from "next/server";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { getAdminPlaceRatings, RatingError } from "@/server/ratings/service";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: { id: string };
  },
) {
  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const ratings = await getAdminPlaceRatings({
      userId: user.id,
      placeId: params.id,
    });

    return NextResponse.json({
      ok: true,
      ratings,
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

    if (error instanceof RatingError) {
      const status = error.code === "place_not_found" ? 404 : 403;

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
        message: "Unexpected admin place ratings read error.",
      },
      { status: 500 },
    );
  }
}
