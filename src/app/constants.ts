export const APP_NAME = "SignStep";
export const MOCK_AUTH_ENABLED = false;
export const MOCK_CREDENTIALS = { login: "Руслана", password: "12345678", userId: "mock-ruslana" } as const;

export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  verifyEmail: "/verify-email",
  dashboard: "/dashboard",
  admin: "/admin",
  preview: "/preview",
  previewResult: "/preview/result",
  lesson: (lessonId: string) => `/lessons/${encodeURIComponent(lessonId)}`,
  play: (lessonId: string) => `/lessons/${encodeURIComponent(lessonId)}/play`,
  results: (sessionId: string) => `/results/${encodeURIComponent(sessionId)}`,
} as const;
