import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { getAdminImportBatchRollbackPlan, ImportBatchReadError } from "@/server/imports/service";

const rollbackPlanQuerySchema = z.object({
  teamSlug: z.string().min(1).optional(),
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
  const parsed = rollbackPlanQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success || !context.params.id) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Import batch rollback plan query is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const rollbackPlan = await getAdminImportBatchRollbackPlan({
      actorUserId: user.id,
      batchId: context.params.id,
      ...parsed.data,
    });

    return NextResponse.json({
      ok: true,
      rollbackPlan,
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
        message: "Unexpected import batch rollback plan read error.",
      },
      { status: 500 },
    );
  }
}
