import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, loginWithUsername } from "@/server/auth/service";

const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
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

  const parsed = loginRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Username and password are required.",
      },
      { status: 400 },
    );
  }

  try {
    const session = await loginWithUsername(parsed.data);

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
          message: "Invalid username or password.",
        },
        { status: 401 },
      );
    }

    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Unexpected login error.",
      },
      { status: 500 },
    );
  }
}
