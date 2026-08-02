import { NextResponse } from "next/server";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { getAdminPlace, PlaceWriteError } from "@/server/places/service";

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
    const place = await getAdminPlace({
      userId: user.id,
      id: params.id,
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
        message: "Unexpected admin place read error.",
      },
      { status: 500 },
    );
  }
}
