import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, changePassword } from "@/server/auth/service";

const changePasswordRequestSchema = z.object({
  username: z.string().min(1),
  contact: z.string().min(1),
  newPassword: z.string().min(8),
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

  const parsed = changePasswordRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Username, contact, and a new password of at least 8 characters are required.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await changePassword(parsed.data);

    return NextResponse.json({
      ok: true,
      user: result,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const status = error.code === "weak_password" || error.code === "contact_mismatch" ? 400 : 401;

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
        message: "Unexpected password change error.",
      },
      { status: 500 },
    );
  }
}
