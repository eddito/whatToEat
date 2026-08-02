import { NextResponse } from "next/server";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { CurrentUserError, getCurrentUserSession } from "@/server/auth/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authUser = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const session = await getCurrentUserSession(authUser.id);

    return NextResponse.json({
      ok: true,
      session,
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

    if (error instanceof CurrentUserError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          message: error.message,
        },
        { status: 404 },
      );
    }

    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Unexpected current user read error.",
      },
      { status: 500 },
    );
  }
}
