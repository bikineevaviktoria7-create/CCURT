import { MOCK_AUTH_ENABLED, MOCK_CREDENTIALS } from "../app/constants.ts";
import { isRecord, storage } from "../lib/storage.ts";
import type { User } from "../types/auth";

export function currentUser(): User | null {
  const value = storage.read("user");
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;
  if (value.isGuest === true) return { id: value.id, name: "Гость", isGuest: true };
  if (MOCK_AUTH_ENABLED) {
    return value.id === MOCK_CREDENTIALS.userId && value.authProvider === "mock" && value.isGuest === false
      ? { id: MOCK_CREDENTIALS.userId, name: MOCK_CREDENTIALS.login, isGuest: false, role: "user", authProvider: "mock" }
      : null;
  }
  if (value.isGuest !== false) return null;
  return {
    id: value.id, name: value.name, isGuest: false,
    email: typeof value.email === "string" ? value.email : undefined,
    role: value.role === "admin" ? "admin" : "user",
    authProvider: "remote",
  };
}

export const canUsePlatform = (user: User | null) => Boolean(user && !user.isGuest);
/**
 * Local recording mode: while the app runs from `npm run dev`, the signed-in team
 * account may open /admin to record reference samples into this browser and export
 * them to public/data/samples.json. Production builds never enable it.
 */
function localRecordingMode() {
  const env = (import.meta as { env?: { DEV?: boolean } }).env;
  return env?.DEV === true;
}

export const canUseAdmin = (user: User | null) =>
  Boolean(
    user &&
      !user.isGuest &&
      ((user.role === "admin" && user.authProvider !== "mock") ||
        (user.authProvider === "mock" && localRecordingMode())),
  );
export const canReadProgress = (userId: string) => {
  const user = currentUser();
  return canUsePlatform(user) && user?.id === userId;
};
export function requirePlatform() {
  if (!canUsePlatform(currentUser())) throw new Error("Войдите, чтобы открыть уроки.");
}
export function requireAdmin() {
  if (!canUseAdmin(currentUser())) throw new Error("Доступ разрешён только администратору.");
}
