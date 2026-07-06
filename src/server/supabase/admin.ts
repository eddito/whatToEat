import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireServerEnv } from "@/server/env";

export function createSupabaseAdminClient() {
  return createClient(requireServerEnv("NEXT_PUBLIC_SUPABASE_URL"), requireServerEnv("SUPABASE_SECRET_KEY"), {
    auth: {
      persistSession: false,
    },
  });
}
