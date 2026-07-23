import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { MemberWriteError, removeAdminMember, upsertAdminMember } from "@/server/teams/service";

const upsertMemberRequestSchema = z.object({
  username: z.string().min(1),
  role: z.enum(["owner", "member", "viewer"]),
  teamSlug: z.string().min(1).optional(),
});

const removeMemberRequestSchema = z.object({
  username: z.string().min(1),
  teamSlug: z.string().min(1).optional(),
});

function invalidRequest(message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: "invalid_request",
      message,
    },
    { status: 400 },
  );
}

function getMemberWriteStatus(error: MemberWriteError) {
  if (error.code === "team_not_found" || error.code === "profile_not_found") {
    return 404;
  }

  if (error.code === "invalid_username") {
    return 400;
  }

  return 403;
}

function handleError(error: unknown) {
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

  if (error instanceof MemberWriteError) {
    return NextResponse.json(
      {
        ok: false,
        error: error.code,
        message: error.message,
      },
      { status: getMemberWriteStatus(error) },
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      ok: false,
      error: "internal_error",
      message: "Unexpected member write error.",
    },
    { status: 500 },
  );
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);

  if (!body) {
    return invalidRequest("Request body must be valid JSON.");
  }

  const parsed = upsertMemberRequestSchema.safeParse(body);

  if (!parsed.success) {
    return invalidRequest("Member payload is invalid.");
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const member = await upsertAdminMember({
      actorUserId: user.id,
      ...parsed.data,
    });

    return NextResponse.json({
      ok: true,
      member,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  const body = await readJson(request);

  if (!body) {
    return invalidRequest("Request body must be valid JSON.");
  }

  const parsed = removeMemberRequestSchema.safeParse(body);

  if (!parsed.success) {
    return invalidRequest("Member payload is invalid.");
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const member = await removeAdminMember({
      actorUserId: user.id,
      ...parsed.data,
    });

    return NextResponse.json({
      ok: true,
      member,
    });
  } catch (error) {
    return handleError(error);
  }
}
