import "server-only";

import { getProfileById, getProfileByUsername } from "@/server/auth/repository";
import { getInternalEmailForUsername, isValidUsername, normalizeUsername } from "@/server/auth/username";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseAuthClient } from "@/server/supabase/auth";
import { getUserTeamMemberships } from "@/server/teams/repository";

export type UsernameLoginInput = {
  username: string;
  password: string;
};

export type UsernameLoginResult = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  tokenType: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

export type RefreshSessionInput = {
  refreshToken: string;
};

export type ChangePasswordInput = {
  username: string;
  contact: string;
  newPassword: string;
};

export type ChangePasswordResult = {
  username: string;
};

export type CurrentUserSession = {
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  memberships: Array<{
    role: "owner" | "member" | "viewer";
    team: {
      id: string;
      slug: string | null;
      name: string;
      description: string | null;
    };
  }>;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "invalid_credentials"
      | "invalid_username"
      | "profile_not_found"
      | "contact_not_configured"
      | "contact_mismatch"
      | "weak_password",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class CurrentUserError extends Error {
  constructor(
    message: string,
    public readonly code: "profile_not_found",
  ) {
    super(message);
    this.name = "CurrentUserError";
  }
}

export async function loginWithUsername(input: UsernameLoginInput): Promise<UsernameLoginResult> {
  const username = normalizeUsername(input.username);

  if (!isValidUsername(username)) {
    throw new AuthError("Invalid username or password.", "invalid_username");
  }

  const profile = await getProfileByUsername(username);

  if (!profile) {
    throw new AuthError("Invalid username or password.", "profile_not_found");
  }

  const supabase = createSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: getInternalEmailForUsername(username),
    password: input.password,
  });

  if (error || !data.session) {
    throw new AuthError("Invalid username or password.", "invalid_credentials");
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at ?? null,
    tokenType: data.session.token_type,
    user: {
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name ?? profile.username,
      avatarUrl: profile.avatar_url,
    },
  };
}

export async function refreshSession(input: RefreshSessionInput): Promise<UsernameLoginResult> {
  const supabase = createSupabaseAuthClient();
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: input.refreshToken,
  });

  if (error || !data.session || !data.user) {
    throw new AuthError("Invalid refresh token.", "invalid_credentials");
  }

  const profile = await getProfileById(data.user.id);

  if (!profile) {
    throw new AuthError("Profile not found.", "profile_not_found");
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at ?? null,
    tokenType: data.session.token_type,
    user: {
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name ?? profile.username,
      avatarUrl: profile.avatar_url,
    },
  };
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.trim().replace(/[\s-]/g, "");
}

function isEmailContact(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhoneContact(value: string) {
  return /^\+?[0-9]{6,20}$/.test(value);
}

function isMatchingContact(inputContact: string, profileContact: string | null, kind: "email" | "phone") {
  if (!profileContact) {
    return false;
  }

  return kind === "email"
    ? normalizeEmail(inputContact) === normalizeEmail(profileContact)
    : normalizePhone(inputContact) === normalizePhone(profileContact);
}

export async function changePassword(input: ChangePasswordInput): Promise<ChangePasswordResult> {
  const username = normalizeUsername(input.username);
  const contact = input.contact.trim();

  if (!isValidUsername(username)) {
    throw new AuthError("Username is invalid.", "invalid_username");
  }

  if (input.newPassword.length < 8) {
    throw new AuthError("Password must be at least 8 characters.", "weak_password");
  }

  const profile = await getProfileByUsername(username);

  if (!profile) {
    throw new AuthError("Profile not found.", "profile_not_found");
  }

  const contactKind = isEmailContact(contact) ? "email" : isPhoneContact(normalizePhone(contact)) ? "phone" : null;

  if (!contactKind) {
    throw new AuthError("Contact must be a valid email or phone number.", "contact_mismatch");
  }

  if (!profile.contact_email && !profile.contact_phone) {
    throw new AuthError("No recovery contact is configured for this account.", "contact_not_configured");
  }

  const matched =
    contactKind === "email"
      ? isMatchingContact(contact, profile.contact_email, "email")
      : isMatchingContact(contact, profile.contact_phone, "phone");

  if (!matched) {
    throw new AuthError("Contact does not match this account.", "contact_mismatch");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(profile.id, {
    password: input.newPassword,
  });

  if (error) {
    throw new AuthError(error.message, "invalid_credentials");
  }

  return {
    username: profile.username,
  };
}

export async function getCurrentUserSession(userId: string): Promise<CurrentUserSession> {
  const [profile, memberships] = await Promise.all([
    getProfileById(userId),
    getUserTeamMemberships(userId),
  ]);

  if (!profile) {
    throw new CurrentUserError("Profile not found.", "profile_not_found");
  }

  return {
    user: {
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
    },
    memberships: memberships.map((membership) => ({
      role: membership.role,
      team: {
        id: membership.team.id,
        slug: membership.team.slug,
        name: membership.team.name,
        description: membership.team.description,
      },
    })),
  };
}
