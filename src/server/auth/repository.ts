import "server-only";

import { createSupabaseAdminClient } from "@/server/supabase/admin";

export type ProfileRecord = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export async function getProfileByUsername(username: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, contact_email, contact_phone")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ProfileRecord | null;
}

export async function getProfileById(id: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, contact_email, contact_phone")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ProfileRecord | null;
}
