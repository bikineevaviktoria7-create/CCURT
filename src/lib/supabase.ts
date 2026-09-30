import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when the project runs without a backend (local demo mode). */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null;

if (!supabase && import.meta.env.DEV)
  console.info(
    "[SignStep] Supabase не настроен: аккаунты и прогресс хранятся локально в браузере.",
  );
