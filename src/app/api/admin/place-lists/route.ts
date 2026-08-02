import { NextResponse } from "next/server";
import { z } from "zod";
import { canEditTeamData, getAdminContext } from "@/server/admin/context";
import type { ListVisibility } from "@/server/places/repository";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AssignmentBody = z.object({
  placeId: z.string().min(1),
  lists: z
    .array(
      z.object({
        listId: z.string().min(1),
        included: z.boolean(),
        sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
      }),
    )
    .max(80),
});

type ListRow = {
  id: string;
  slug: string;
  name: string;
  visibility: ListVisibility;
};

type PlaceRow = {
  id: string;
  import_key: string | null;
  name: string;
};

type ListPlaceRow = {
  list_id: string;
  sort_order: number;
};

function toPlaceListRows(lists: ListRow[], assignments: ListPlaceRow[]) {
  const assignmentByListId = new Map(assignments.map((assignment) => [assignment.list_id, assignment]));

  return lists.map((list) => {
    const assignment = assignmentByListId.get(list.id);

    return {
      id: list.slug,
      databaseId: list.id,
      slug: list.slug,
      name: list.name,
      visibility: list.visibility,
      included: Boolean(assignment),
      sortOrder: assignment?.sort_order ?? 0,
    };
  });
}

async function findPlace(context: Extract<Awaited<ReturnType<typeof getAdminContext>>, { ok: true }>, placeId: string) {
  const placeQuery = context.supabase
    .from("places")
    .select("id, import_key, name")
    .eq("team_id", context.team.id);

  const { data, error } = UUID_PATTERN.test(placeId)
    ? await placeQuery.eq("id", placeId).maybeSingle()
    : await placeQuery.eq("import_key", placeId).maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlaceRow | null;
}

async function getTeamLists(context: Extract<Awaited<ReturnType<typeof getAdminContext>>, { ok: true }>) {
  const { data, error } = await context.supabase
    .from("lists")
    .select("id, slug, name, visibility")
    .eq("team_id", context.team.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ListRow[];
}

async function getAssignments(context: Extract<Awaited<ReturnType<typeof getAdminContext>>, { ok: true }>, placeId: string) {
  const { data, error } = await context.supabase
    .from("list_places")
    .select("list_id, sort_order")
    .eq("place_id", placeId);

  if (error) {
    throw error;
  }

  return (data ?? []) as ListPlaceRow[];
}

export async function GET(request: Request) {
  const context = await getAdminContext(request);

  if (!context.ok) {
    return context.response;
  }

  const placeId = new URL(request.url).searchParams.get("placeId");

  if (!placeId) {
    return NextResponse.json({ error: "缺少店铺参数。" }, { status: 400 });
  }

  const place = await findPlace(context, placeId);

  if (!place) {
    return NextResponse.json({ error: "店铺不存在或不属于当前小队。" }, { status: 404 });
  }

  const [lists, assignments] = await Promise.all([getTeamLists(context), getAssignments(context, place.id)]);

  return NextResponse.json({
    place: {
      id: place.import_key ?? place.id,
      databaseId: place.id,
      name: place.name,
    },
    lists: toPlaceListRows(lists, assignments),
    canEdit: canEditTeamData(context.membership.role),
  });
}

export async function PATCH(request: Request) {
  const context = await getAdminContext(request);

  if (!context.ok) {
    return context.response;
  }

  if (!canEditTeamData(context.membership.role)) {
    return NextResponse.json({ error: "当前角色不能维护店铺榜单。" }, { status: 403 });
  }

  const parsed = AssignmentBody.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "店铺榜单参数不正确。" }, { status: 400 });
  }

  const place = await findPlace(context, parsed.data.placeId);

  if (!place) {
    return NextResponse.json({ error: "店铺不存在或不属于当前小队。" }, { status: 404 });
  }

  const lists = await getTeamLists(context);
  const listByStableId = new Map(lists.flatMap((list) => [[list.id, list], [list.slug, list]]));
  const desiredByListId = new Map<string, { list_id: string; place_id: string; sort_order: number }>();

  for (const assignment of parsed.data.lists) {
    const list = listByStableId.get(assignment.listId);

    if (!list) {
      return NextResponse.json({ error: "榜单不存在或不属于当前小队。" }, { status: 400 });
    }

    if (assignment.included) {
      desiredByListId.set(list.id, {
        list_id: list.id,
        place_id: place.id,
        sort_order: assignment.sortOrder,
      });
    }
  }

  const desired = [...desiredByListId.values()];

  const listIds = lists.map((list) => list.id);

  if (listIds.length > 0) {
    const { error: deleteError } = await context.supabase
      .from("list_places")
      .delete()
      .eq("place_id", place.id)
      .in("list_id", listIds);

    if (deleteError) {
      throw deleteError;
    }
  }

  if (desired.length > 0) {
    const { error: upsertError } = await context.supabase.from("list_places").upsert(desired);

    if (upsertError) {
      throw upsertError;
    }
  }

  const assignments = await getAssignments(context, place.id);

  return NextResponse.json({
    place: {
      id: place.import_key ?? place.id,
      databaseId: place.id,
      name: place.name,
    },
    lists: toPlaceListRows(lists, assignments),
    canEdit: true,
    message: "店铺榜单已保存。",
  });
}
