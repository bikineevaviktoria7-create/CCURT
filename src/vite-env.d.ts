/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "real" (default) uses MediaPipe; "mock" forces the scripted demonstration. */
  readonly VITE_VISION_MODE?: "real" | "mock";
  /** Global recognition strictness, 1 = default, >1 more forgiving. */
  readonly VITE_RECOGNITION_TOLERANCE?: string;
  /** Shown on the landing page so the jury can log in without registration. */
  readonly VITE_DEMO_EMAIL?: string;
  readonly VITE_DEMO_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
