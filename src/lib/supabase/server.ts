import { createClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/config";

export function createSupabaseAdmin() {
  const config = getSupabaseConfig();

  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
