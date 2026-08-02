import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageListPermissions, getAdminContext } from "@/server/admin/context";
import type { ListVisibility } from "@/server/places/repository";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ListBody = z.object({
  listId: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(200).optional(),
  visibility: z.enum(["private", "public_view", "public_rate"]),
});
const CreateListBody = z.object({
  slug: z.string().trim().min(1).max(48).regex(SLUG_PATTERN),
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(200).optional(),
  visibility: z.enum(["private", "public_view", "public_rate"]).default("private"),
});

type ListRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: ListVisibility;
  created_at: string;
};

function toNullableText(value?: string) {
  return value?.trim() || null;
}

function toAdminList(row: ListRow, placeCount = 0) {
  return {
    id: row.slug,
    databaseId: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    visibility: row.visibility,
    placeCount,
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  const context = await getAdminContext(request);

  if (!context.ok) {
    return context.response;
  }

  const { data, error } = await context.supabase
    .from("lists")
    .select("id, slug, name, description, visibility, created_at")
    .eq("team_id", context.team.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ListRow[];
  const counts = await Promise.all(
    rows.map(async (row) => {
      const { count, error: countError } = await context.supabase
        .from("list_places")
        .select("place_id", { count: "exact", head: true })
        .eq("list_id", row.id);

      if (countError) {
        throw countError;
      }

      return [row.id, count ?? 0] as const;
    }),
  );
  const countByListId = new Map(counts);

  return NextResponse.json({
    lists: rows.map((row) => toAdminList(row, countByListId.get(row.id) ?? 0)),
    canManage: canManageListPermissions(context.membership.role),
  });
}

export async function PATCH(request: Request) {
  const context = await getAdminContext(request);

  if (!context.ok) {
    return context.response;
  }

  if (!canManageListPermissions(context.membership.role)) {
    return NextResponse.json({ error: "只有 Owner 可以管理榜单权限。" }, { status: 403 });
  }

  const parsed = ListBody.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "榜单参数不正确。" }, { status: 400 });
  }

  const payload = {
    name: parsed.data.name,
    description: toNullableText(parsed.data.description),
    visibility: parsed.data.visibility,
  };
  const listQuery = context.supabase
    .from("lists")
    .update(payload)
    .eq("team_id", context.team.id)
    .select("id, slug, name, description, visibility, created_at");
  const { data, error } = UUID_PATTERN.test(parsed.data.listId)
    ? await listQuery.eq("id", parsed.data.listId).maybeSingle()
    : await listQuery.eq("slug", parsed.data.listId).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return NextResponse.json({ error: "榜单不存在或不属于当前小队。" }, { status: 404 });
  }

  const { count, error: countError } = await context.supabase
    .from("list_places")
    .select("place_id", { count: "exact", head: true })
    .eq("list_id", data.id);

  if (countError) {
    throw countError;
  }

  return NextResponse.json({
    list: toAdminList(data as ListRow, count ?? 0),
    message: "榜单权限已保存。",
  });
}

export async function POST(request: Request) {
  const context = await getAdminContext(request);

  if (!context.ok) {
    return context.response;
  }

  if (!canManageListPermissions(context.membership.role)) {
    return NextResponse.json({ error: "只有 Owner 可以创建榜单。" }, { status: 403 });
  }

  const parsed = CreateListBody.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "榜单参数不正确，slug 只能包含小写字母、数字和中划线。" }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from("lists")
    .insert({
      team_id: context.team.id,
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: toNullableText(parsed.data.description),
      visibility: parsed.data.visibility,
    })
    .select("id, slug, name, description, visibility, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "这个榜单 slug 已存在。" }, { status: 409 });
    }

    throw error;
  }

  return NextResponse.json({
    list: toAdminList(data as ListRow, 0),
    message: "榜单已创建。",
  });
}

export async function DELETE(request: Request) {
  const context = await getAdminContext(request);

  if (!context.ok) {
    return context.response;
  }

  if (!canManageListPermissions(context.membership.role)) {
    return NextResponse.json({ error: "只有 Owner 可以删除榜单。" }, { status: 403 });
  }

  const listId = new URL(request.url).searchParams.get("listId");

  if (!listId) {
    return NextResponse.json({ error: "缺少榜单参数。" }, { status: 400 });
  }

  const { count: listCount, error: countError } = await context.supabase
    .from("lists")
    .select("id", { count: "exact", head: true })
    .eq("team_id", context.team.id);

  if (countError) {
    throw countError;
  }

  if ((listCount ?? 0) <= 1) {
    return NextResponse.json({ error: "小队至少需要保留一个榜单。" }, { status: 400 });
  }

  const listQuery = context.supabase.from("lists").delete().eq("team_id", context.team.id).select("id, slug, name");
  const { data, error } = UUID_PATTERN.test(listId)
    ? await listQuery.eq("id", listId).maybeSingle()
    : await listQuery.eq("slug", listId).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return NextResponse.json({ error: "榜单不存在或不属于当前小队。" }, { status: 404 });
  }

  return NextResponse.json({
    deletedList: data,
    message: "榜单已删除。",
  });
}
