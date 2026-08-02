import "server-only";

import { createSupabaseAuthClient } from "@/server/supabase/auth";

export type AuthenticatedUser = {
  id: string;
};

export class SessionError extends Error {
  constructor(
    message: string,
    public readonly code: "missing_bearer_token" | "invalid_bearer_token",
  ) {
    super(message);
    this.name = "SessionError";
  }
}

export function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function getUserFromAuthorizationHeader(authorizationHeader: string | null): Promise<AuthenticatedUser> {
  const token = getBearerToken(authorizationHeader);

  if (!token) {
    throw new SessionError("Missing bearer token.", "missing_bearer_token");
  }

  const supabase = createSupabaseAuthClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new SessionError("Invalid bearer token.", "invalid_bearer_token");
  }

  return {
    id: data.user.id,
  };
}
