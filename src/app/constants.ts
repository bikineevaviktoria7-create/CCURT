export const APP_NAME = "SignStep";
export const MOCK_AUTH_ENABLED = true;
export const DEMO_PASSWORD = "1237890q";
export const DEMO_USERS = [
  { name: "Руслана", id: "mock-ruslana" },
  { name: "Камилла", id: "mock-kamilla" },
  { name: "Мария", id: "mock-maria" },
] as const;

export const ROUTES = {
  home: "/",
  login: "/login",
  dashboard: "/dashboard",
  preview: "/preview",
  previewResult: "/preview/result",
  lesson: (lessonId: string) => `/lessons/${encodeURIComponent(lessonId)}`,
  play: (lessonId: string) => `/lessons/${encodeURIComponent(lessonId)}/play`,
  results: (sessionId: string) => `/results/${encodeURIComponent(sessionId)}`,
} as const;
