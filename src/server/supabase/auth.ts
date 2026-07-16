import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireServerEnv } from "@/server/env";

export function createSupabaseAuthClient() {
  return createClient(
    requireServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireServerEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        persistSession: false,
      },
    },
  );
}
