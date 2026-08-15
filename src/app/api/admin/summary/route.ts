import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfileById } from "@/server/auth/repository";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { getAdminSummary, PlaceWriteError } from "@/server/places/service";

const summaryQuerySchema = z.object({
  teamSlug: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = summaryQuerySchema.safeParse(Object.fromEntries(url.searchParams));

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
    const profile = await getProfileById(user.id);

    return NextResponse.json({
      ok: true,
      summary,
      currentUser: {
        id: user.id,
        role: summary.team.role,
        name: profile?.display_name || profile?.username || "当前账号",
      },
      stats: {
        places: summary.counts.activePlaces,
        lists: summary.counts.lists,
        ratings: summary.counts.ratings,
        members: summary.counts.members,
      },
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
