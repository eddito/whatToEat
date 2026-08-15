import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { getAdminSummary, PlaceWriteError } from "@/server/places/service";

const adminSummaryQuerySchema = z.object({
  teamSlug: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = adminSummaryQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Admin summary query is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const summary = await getAdminSummary({
      userId: user.id,
      ...parsed.data,
    });

    return NextResponse.json({
      ok: true,
      summary,
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
        message: "Unexpected admin summary read error.",
      },
      { status: 500 },
    );
  }
}
