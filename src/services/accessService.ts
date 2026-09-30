import { MOCK_USERS } from "../app/constants.ts";
import { isRecord, storage } from "../lib/storage.ts";
import type { User } from "../types/auth";

/** Вошедший пользователь или гость из хранилища; для неизвестных аккаунтов — null. */
export function getCurrentUser(): User | null {
  const value = storage.read("user");
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;
  if (value.isGuest === true) return { id: value.id, name: "Гость", isGuest: true };
  const account = MOCK_USERS.find(user => user.id === value.id);
  return account && value.authProvider === "mock" && value.isGuest === false
    ? { id: account.id, name: account.name, isGuest: false, role: "user", authProvider: "mock" }
    : null;
}

/** True для вошедшего аккаунта; гостям доступно только пробное упражнение. */
export function canUsePlatform(user: User | null) {
  return Boolean(user && !user.isGuest);
}

/** True, если текущий пользователь может читать и менять прогресс `userId`. */
export function canReadProgress(userId: string) {
  const user = getCurrentUser();
  return canUsePlatform(user) && user?.id === userId;
}

/** Бросает ошибку, если уроки недоступны текущему пользователю. */
export function requirePlatform() {
  if (!canUsePlatform(getCurrentUser())) throw new Error("Войдите, чтобы открыть уроки.");
}
