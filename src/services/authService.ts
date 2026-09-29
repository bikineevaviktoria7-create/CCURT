import { isRecord, storage } from "../lib/storage";
import { DEMO_PASSWORD, DEMO_USERS } from "../app/constants";
import { currentUser } from "./accessService";
import type { LoginCredentials, User } from "../types/auth";

function remember(user: User) {
  storage.write("user", user);
  return user;
}

// Hackathon accounts only; lesson progress remains keyed by each stable user ID.
export const authService = {
  isRemote: false,
  getUser: currentUser,
  async init() { return currentUser(); },
  onSignedOut(callback: () => void) { void callback; return () => undefined; },
  guest() {
    const previous = storage.read("guest");
    const user: User = {
      id: isRecord(previous) && typeof previous.id === "string" ? previous.id : crypto.randomUUID(),
      name: "Гость", isGuest: true,
    };
    storage.write("guest", user);
    return remember(user);
  },
  async login({ email: login, password }: LoginCredentials): Promise<User> {
    const account = DEMO_USERS.find(user => user.name === login.trim());
    if (!account || password !== DEMO_PASSWORD)
      throw new Error("Неверный логин или пароль");
    return remember({ id: account.id, name: account.name, isGuest: false, role: "user", authProvider: "mock" });
  },
  logout() { storage.remove("user"); },
};
