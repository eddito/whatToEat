import { NextResponse } from "next/server";
import { z } from "zod";
import { PHONE_PATTERN } from "@/lib/accounts";
import { canManageMembers, getAdminContext } from "@/server/admin/context";

const emailSchema = z.string().trim().email().max(160);
const phoneSchema = z.string().trim().regex(PHONE_PATTERN);
const PasswordBody = z.object({
  account: z.string().trim().min(1).max(160),
  password: z.string().min(8).max(72),
});

function isValidAccount(account: string) {
  return emailSchema.safeParse(account).success || phoneSchema.safeParse(account).success;
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
    data.users.find((user) => user.email?.toLowerCase() === normalized || user.phone === account.trim()) ?? null
  );
}

export async function PATCH(request: Request) {
  const context = await getAdminContext(request);

  if (!context.ok) {
    return context.response;
  }

  if (!canManageMembers(context.membership.role)) {
    return NextResponse.json({ error: "只有 Owner 可以重置成员密码。" }, { status: 403 });
  }

  const parsed = PasswordBody.safeParse(await request.json().catch(() => null));

  if (!parsed.success || !isValidAccount(parsed.success ? parsed.data.account : "")) {
    return NextResponse.json({ error: "账号必须是邮箱或手机号，不能包含中文或其它账号格式。" }, { status: 400 });
  }

  const user = await findAuthUserByAccount(context, parsed.data.account);

  if (!user) {
    return NextResponse.json({ error: "没有找到这个 Auth 账号。" }, { status: 404 });
  }

  const { data: membership, error: membershipError } = await context.supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", context.team.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (!membership) {
    return NextResponse.json({ error: "只能重置当前小队成员的密码。" }, { status: 403 });
  }

  const { error } = await context.supabase.auth.admin.updateUserById(user.id, {
    password: parsed.data.password,
  });

  if (error) {
    throw error;
  }

  return NextResponse.json({
    message: "成员密码已重置。",
  });
}
