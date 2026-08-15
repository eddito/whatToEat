import { NextResponse } from "next/server";
import { z } from "zod";
import { PHONE_PATTERN, USERNAME_EMAIL_DOMAIN, USERNAME_PATTERN } from "@/lib/accounts";
import { canManageMembers, getAdminContext, type AdminRole } from "@/server/admin/context";

const roleSchema = z.enum(["owner", "member", "viewer"]);
const emailSchema = z.string().trim().email().max(160);
const phoneSchema = z.string().trim().regex(PHONE_PATTERN);
const usernameSchema = z.string().trim().regex(USERNAME_PATTERN);
const AddMemberBody = z.object({
  account: z.string().trim().min(1).max(160),
  role: roleSchema.default("member"),
});
const UpdateMemberBody = z.object({
  userId: z.string().uuid(),
  role: roleSchema,
});

function getProfileName(profile: { display_name: string | null } | null, fallback: string) {
  return profile?.display_name || fallback || "未命名成员";
}

function getUserLabel(user: {
  email?: string;
  phone?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const username = user.user_metadata?.username;
  const displayName = user.user_metadata?.display_name;

  if (typeof username === "string" && username.trim()) return username.trim();
  if (typeof displayName === "string" && displayName.trim()) return displayName.trim();
  return user.email || user.phone || "未命名账号";
}

function getUsername(user: { email?: string; user_metadata?: Record<string, unknown> }) {
  const username = user.user_metadata?.username;

  if (typeof username === "string" && username.trim()) {
    return username.trim();
  }

  const email = user.email?.toLowerCase() ?? "";
  const suffix = `@${USERNAME_EMAIL_DOMAIN}`;

  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : null;
}

function getFallbackUsername(userId: string) {
  return `user${userId.replaceAll("-", "").slice(0, 12)}`;
}

function isValidMemberAccount(account: string) {
  return (
    emailSchema.safeParse(account).success ||
    phoneSchema.safeParse(account).success ||
    usernameSchema.safeParse(account).success
  );
}

async function getOwnerCount(context: Extract<Awaited<ReturnType<typeof getAdminContext>>, { ok: true }>) {
  const { count, error } = await context.supabase
    .from("team_members")
    .select("user_id", { count: "exact", head: true })
    .eq("team_id", context.team.id)
    .eq("role", "owner");

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function listMembers(context: Extract<Awaited<ReturnType<typeof getAdminContext>>, { ok: true }>) {
  const [membersResult, authUsersResult] = await Promise.all([
    context.supabase
      .from("team_members")
      .select("user_id, role, created_at, profiles(display_name)")
      .eq("team_id", context.team.id)
      .order("created_at", { ascending: true }),
    context.supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (membersResult.error) {
    throw membersResult.error;
  }

  if (authUsersResult.error) {
    throw authUsersResult.error;
  }

  const authUsersById = new Map(authUsersResult.data.users.map((user) => [user.id, user]));

  return (membersResult.data ?? []).map((member) => {
    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
    const authUser = authUsersById.get(member.user_id);
    const email = authUser?.email ?? "";
    const phone = authUser?.phone ?? "";

    return {
      id: member.user_id,
      userId: member.user_id,
      username: getUsername(authUser ?? {}),
      name: getProfileName(profile, getUserLabel(authUser ?? {})),
      email: email || phone,
      role: member.role as AdminRole,
      teamSlug: context.team.slug,
      joinedAt: member.created_at,
    };
  });
}

async function findAuthUserByAccount(
  context: Extract<Awaited<ReturnType<typeof getAdminContext>>, { ok: true }>,
  account: string,
) {
  const normalized = account.trim().toLowerCase();
  const { data, error } = await context.supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    throw error;
  }

  return (
    data.users.find((user) => {
      const username = typeof user.user_metadata?.username === "string" ? user.user_metadata.username.toLowerCase() : "";
      return user.email?.toLowerCase() === normalized || user.phone === account.trim() || username === normalized;
    }) ?? null
  );
}

export async function GET(request: Request) {
  const context = await getAdminContext(request);

  if (!context.ok) {
    return context.response;
  }

  return NextResponse.json({
    members: await listMembers(context),
    canManage: canManageMembers(context.membership.role),
    currentUserId: context.user.id,
  });
}

export async function POST(request: Request) {
  const context = await getAdminContext(request);

  if (!context.ok) {
    return context.response;
  }

  if (!canManageMembers(context.membership.role)) {
    return NextResponse.json({ error: "只有 Owner 可以添加成员。" }, { status: 403 });
  }

  const parsed = AddMemberBody.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "成员参数不正确。" }, { status: 400 });
  }

  if (!isValidMemberAccount(parsed.data.account)) {
    return NextResponse.json(
      { error: "账号必须是邮箱、手机号，或 3-32 位小写字母/数字用户名，不能包含中文或其它特殊字符。" },
      { status: 400 },
    );
  }

  const user = await findAuthUserByAccount(context, parsed.data.account);

  if (!user) {
    return NextResponse.json({ error: "没有找到这个 Auth 账号，请先在 Supabase 创建用户。" }, { status: 404 });
  }

  const { data: profile, error: existingProfileError } = await context.supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfileError) {
    throw existingProfileError;
  }

  const { error: profileError } = await context.supabase.from("profiles").upsert({
    id: user.id,
    username: profile?.username ?? getUsername(user) ?? getFallbackUsername(user.id),
    display_name: getUserLabel(user),
    avatar_url: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
  });

  if (profileError) {
    throw profileError;
  }

  const { error } = await context.supabase.from("team_members").insert({
    team_id: context.team.id,
    user_id: user.id,
    role: parsed.data.role,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "这个账号已经是小队成员。" }, { status: 409 });
    }

    throw error;
  }

  return NextResponse.json({
    members: await listMembers(context),
    message: "成员已添加。",
  });
}

export async function PATCH(request: Request) {
  const context = await getAdminContext(request);

  if (!context.ok) {
    return context.response;
  }

  if (!canManageMembers(context.membership.role)) {
    return NextResponse.json({ error: "只有 Owner 可以管理成员角色。" }, { status: 403 });
  }

  const parsed = UpdateMemberBody.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "成员角色参数不正确。" }, { status: 400 });
  }

  if (parsed.data.userId === context.user.id) {
    return NextResponse.json({ error: "不能在这里修改自己的角色。" }, { status: 400 });
  }

  const ownerCount = await getOwnerCount(context);
  const { data: currentMember, error: currentMemberError } = await context.supabase
    .from("team_members")
    .select("role")
    .eq("team_id", context.team.id)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();

  if (currentMemberError) {
    throw currentMemberError;
  }

  if (!currentMember) {
    return NextResponse.json({ error: "成员不存在。" }, { status: 404 });
  }

  if (currentMember.role === "owner" && parsed.data.role !== "owner" && ownerCount <= 1) {
    return NextResponse.json({ error: "小队至少需要保留一个 Owner。" }, { status: 400 });
  }

  const { error } = await context.supabase
    .from("team_members")
    .update({ role: parsed.data.role })
    .eq("team_id", context.team.id)
    .eq("user_id", parsed.data.userId);

  if (error) {
    throw error;
  }

  return NextResponse.json({
    members: await listMembers(context),
    message: "成员角色已保存。",
  });
}

export async function DELETE(request: Request) {
  const context = await getAdminContext(request);

  if (!context.ok) {
    return context.response;
  }

  if (!canManageMembers(context.membership.role)) {
    return NextResponse.json({ error: "只有 Owner 可以移除成员。" }, { status: 403 });
  }

  const userId = new URL(request.url).searchParams.get("userId");

  if (!userId || !z.string().uuid().safeParse(userId).success) {
    return NextResponse.json({ error: "缺少成员参数。" }, { status: 400 });
  }

  if (userId === context.user.id) {
    return NextResponse.json({ error: "不能在这里移除自己。" }, { status: 400 });
  }

  const ownerCount = await getOwnerCount(context);
  const { data: currentMember, error: currentMemberError } = await context.supabase
    .from("team_members")
    .select("role")
    .eq("team_id", context.team.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (currentMemberError) {
    throw currentMemberError;
  }

  if (!currentMember) {
    return NextResponse.json({ error: "成员不存在。" }, { status: 404 });
  }

  if (currentMember.role === "owner" && ownerCount <= 1) {
    return NextResponse.json({ error: "小队至少需要保留一个 Owner。" }, { status: 400 });
  }

  const { error } = await context.supabase.from("team_members").delete().eq("team_id", context.team.id).eq("user_id", userId);

  if (error) {
    throw error;
  }

  return NextResponse.json({
    members: await listMembers(context),
    message: "成员已移除。",
  });
}
