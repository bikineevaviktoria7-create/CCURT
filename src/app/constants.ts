export const APP_NAME = 'SignStep';

export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  verifyEmail: '/verify-email',
  calibration: '/calibration',
  dashboard: '/dashboard',
  lesson: (lessonId: string) => `/lessons/${encodeURIComponent(lessonId)}`,
  play: (lessonId: string) => `/lessons/${encodeURIComponent(lessonId)}/play`,
  results: (sessionId: string) => `/results/${encodeURIComponent(sessionId)}`,
  profile: '/profile',
  leaderboard: '/leaderboard',
  admin: '/admin',
} as const;
