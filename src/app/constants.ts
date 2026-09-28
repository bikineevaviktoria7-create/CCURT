export const APP_NAME = "SignStep";

export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  verifyEmail: "/verify-email",
  dashboard: "/dashboard",
  lesson: (lessonId: string) => `/lessons/${encodeURIComponent(lessonId)}`,
  play: (lessonId: string) => `/lessons/${encodeURIComponent(lessonId)}/play`,
  results: (sessionId: string) => `/results/${encodeURIComponent(sessionId)}`,
} as const;
