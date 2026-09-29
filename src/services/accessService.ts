import { DEMO_USERS } from "../app/constants.ts";
import { isRecord, storage } from "../lib/storage.ts";
import type { User } from "../types/auth";

export function currentUser(): User | null {
  const value = storage.read("user");
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;
  if (value.isGuest === true) return { id: value.id, name: "Гость", isGuest: true };
  const account = DEMO_USERS.find(user => user.id === value.id);
  return account && value.authProvider === "mock" && value.isGuest === false
    ? { id: account.id, name: account.name, isGuest: false, role: "user", authProvider: "mock" }
    : null;
}

export const canUsePlatform = (user: User | null) => Boolean(user && !user.isGuest);
export const canReadProgress = (userId: string) => {
  const user = currentUser();
  return canUsePlatform(user) && user?.id === userId;
};
export function requirePlatform() {
  if (!canUsePlatform(currentUser())) throw new Error("Войдите, чтобы открыть уроки.");
}
