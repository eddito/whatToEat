import "server-only";

import { getProfileByUsername } from "@/server/auth/repository";
import { getInternalEmailForUsername, isValidUsername, normalizeUsername } from "@/server/auth/username";
import { createSupabaseAuthClient } from "@/server/supabase/auth";

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

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: "invalid_credentials" | "invalid_username" | "profile_not_found",
  ) {
    super(message);
    this.name = "AuthError";
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
