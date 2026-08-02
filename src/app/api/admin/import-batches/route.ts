import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { getAdminImportBatches, ImportBatchReadError } from "@/server/imports/service";

const importBatchQuerySchema = z.object({
  teamSlug: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  includeLegacy: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value ? value === "true" : undefined)),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = importBatchQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Import batch query is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const importBatches = await getAdminImportBatches({
      actorUserId: user.id,
      ...parsed.data,
    });

    return NextResponse.json({
      ok: true,
      importBatches,
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

    if (error instanceof ImportBatchReadError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          message: error.message,
        },
        { status: error.code === "team_not_found" ? 404 : 403 },
      );
    }

    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Unexpected import batch read error.",
      },
      { status: 500 },
    );
  }
}
