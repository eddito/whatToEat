import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { getAdminLists, ListWriteError, upsertAdminList } from "@/server/places/service";

const adminListsQuerySchema = z.object({
  teamSlug: z.string().min(1).optional(),
});

const upsertListRequestSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  visibility: z.enum(["private", "public_view", "public_rate"]),
  teamSlug: z.string().min(1).optional(),
});

function handleListError(error: unknown) {
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

  if (error instanceof ListWriteError) {
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
      message: "Unexpected list error.",
    },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = adminListsQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "Admin lists query is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const lists = await getAdminLists({
      userId: user.id,
      ...parsed.data,
    });

    return NextResponse.json({
      ok: true,
      lists,
    });
  } catch (error) {
    return handleListError(error);
  }
}

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

  const parsed = upsertListRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "List payload is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const list = await upsertAdminList({
      userId: user.id,
      ...parsed.data,
    });

    return NextResponse.json({
      ok: true,
      list,
    });
  } catch (error) {
    return handleListError(error);
  }
}
