import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { RatingError, upsertRating } from "@/server/ratings/service";

const upsertRatingRequestSchema = z.object({
  placeId: z.string().min(1),
  score: z.number().min(0).max(5),
  note: z.string().max(1000).nullable().optional(),
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

  const parsed = upsertRatingRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "placeId, score and note are invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const result = await upsertRating({
      userId: user.id,
      placeId: parsed.data.placeId,
      score: parsed.data.score,
      note: parsed.data.note,
    });

    return NextResponse.json({
      ok: true,
      rating: result.rating,
      source: result.source,
      role: result.role,
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
        message: "Unexpected rating error.",
      },
      { status: 500 },
    );
  }
}
