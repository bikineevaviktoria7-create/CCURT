/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Общая строгость распознавания: 1 — по умолчанию, >1 — мягче. */
  readonly VITE_RECOGNITION_TOLERANCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
