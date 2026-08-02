import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, refreshSession } from "@/server/auth/service";

const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
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

  const parsed = refreshRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Refresh token is required.",
      },
      { status: 400 },
    );
  }

  try {
    const session = await refreshSession(parsed.data);

    return NextResponse.json({
      ok: true,
      session,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          message: "Invalid refresh token.",
        },
        { status: 401 },
      );
    }

    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Unexpected refresh error.",
      },
      { status: 500 },
    );
  }
}
