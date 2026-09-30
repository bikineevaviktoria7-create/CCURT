/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Global recognition strictness, 1 = default, >1 more forgiving. */
  readonly VITE_RECOGNITION_TOLERANCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
