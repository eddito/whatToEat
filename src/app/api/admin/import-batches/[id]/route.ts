import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { getAdminImportBatch, ImportBatchReadError } from "@/server/imports/service";

const importBatchDetailQuerySchema = z.object({
  teamSlug: z.string().min(1).optional(),
  previewLimit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(
  request: Request,
  context: {
    params: {
      id: string;
    };
  },
) {
  const url = new URL(request.url);
  const parsed = importBatchDetailQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success || !context.params.id) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Import batch detail query is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const importBatch = await getAdminImportBatch({
      actorUserId: user.id,
      batchId: context.params.id,
      ...parsed.data,
    });

    return NextResponse.json({
      ok: true,
      importBatch,
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
      const status = error.code === "team_not_found" || error.code === "batch_not_found" ? 404 : 403;

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
        message: "Unexpected import batch detail read error.",
      },
      { status: 500 },
    );
  }
}
