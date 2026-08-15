import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { deleteAdminPlaceRating, getAdminPlaceRatings, RatingError } from "@/server/ratings/service";

function getRatingStatus(error: RatingError) {
  if (error.code === "place_not_found" || error.code === "rating_not_found") {
    return 404;
  }

  return 403;
}

function handleRatingError(error: unknown, fallbackMessage: string) {
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
    return NextResponse.json(
      {
        ok: false,
        error: error.code,
        message: error.message,
      },
      { status: getRatingStatus(error) },
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      ok: false,
      error: "internal_error",
      message: fallbackMessage,
    },
    { status: 500 },
  );
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const { id } = await params;

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const ratings = await getAdminPlaceRatings({
      userId: user.id,
      placeId: id,
    });

    return NextResponse.json({
      ok: true,
      ratings,
    });
  } catch (error) {
    return handleRatingError(error, "Unexpected admin place ratings read error.");
  }
}

export async function DELETE(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const { id } = await params;
  const ratingId = new URL(request.url).searchParams.get("ratingId");

  if (!ratingId || !z.string().uuid().safeParse(ratingId).success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Valid ratingId is required.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const result = await deleteAdminPlaceRating({
      userId: user.id,
      placeId: id,
      ratingId,
    });

    return NextResponse.json({
      ok: true,
      rating: result.rating,
      deleted: result.deleted,
    });
  } catch (error) {
    return handleRatingError(error, "Unexpected admin place rating delete error.");
  }
}
