import "server-only";

import { createSupabaseAdminClient } from "@/server/supabase/admin";

export type ProfileRecord = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export async function getProfileByUsername(username: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ProfileRecord | null;
}
