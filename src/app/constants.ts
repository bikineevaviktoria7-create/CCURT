export const APP_NAME = "SignStep";
export const MOCK_AUTH_ENABLED = true;
export const MOCK_PASSWORD = "1237890q";
export const MOCK_USERS = [
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
  /** Route patterns for the router; `lessonId` and `sessionId` are read with `useParams`. */
  lessonPattern: "/lessons/:lessonId",
  playPattern: "/lessons/:lessonId/play",
  resultsPattern: "/results/:sessionId",
} as const;
