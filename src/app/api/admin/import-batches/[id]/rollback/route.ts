import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { ImportBatchReadError, rollbackAdminImportBatch } from "@/server/imports/service";

const rollbackRequestSchema = z.object({
  confirm: z.literal(true),
  teamSlug: z.string().min(1).optional(),
});

export async function POST(
  request: Request,
  context: {
    params: {
      id: string;
    };
  },
) {
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

  const parsed = rollbackRequestSchema.safeParse(body);

  if (!parsed.success || !context.params.id) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Import batch rollback requires confirm: true.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const rollback = await rollbackAdminImportBatch({
      actorUserId: user.id,
      batchId: context.params.id,
      confirm: parsed.data.confirm,
      teamSlug: parsed.data.teamSlug,
    });

    return NextResponse.json({
      ok: true,
      rollback,
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
      const status =
        error.code === "team_not_found" || error.code === "batch_not_found"
          ? 404
          : error.code === "batch_already_rolled_back"
            ? 409
            : 403;

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
        message: "Unexpected import batch rollback error.",
      },
      { status: 500 },
    );
  }
}
