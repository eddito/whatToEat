import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let browserSupabase: SupabaseClient | null = null;

export function getBrowserSupabase() {
  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  if (!browserSupabase) {
    browserSupabase = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storageKey: "what-to-eat-today-auth",
      },
    });
  }

  return browserSupabase;
}

export function getServerSupabase() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    return null;
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
    },
  });
}
