import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromAuthorizationHeader, SessionError } from "@/server/auth/session";
import { ListPlaceOrderError, reorderAdminListPlaces } from "@/server/places/service";

const reorderListPlacesRequestSchema = z.object({
  placeIds: z.array(z.string().min(1)).min(1),
});

function getOrderErrorStatus(error: ListPlaceOrderError) {
  if (error.code === "list_not_found") {
    return 404;
  }

  if (error.code === "duplicate_place_id" || error.code === "place_not_in_list") {
    return 400;
  }

  return 403;
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ slug: string }>;
  },
) {
  const { slug } = await params;
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

  const parsed = reorderListPlacesRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: "List place order payload is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getUserFromAuthorizationHeader(request.headers.get("authorization"));
    const result = await reorderAdminListPlaces({
      userId: user.id,
      slug,
      ...parsed.data,
    });

    return NextResponse.json({
      ok: true,
      result,
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

    if (error instanceof ListPlaceOrderError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          message: error.message,
        },
        { status: getOrderErrorStatus(error) },
      );
    }

    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: "Unexpected list place order error.",
      },
      { status: 500 },
    );
  }
}
