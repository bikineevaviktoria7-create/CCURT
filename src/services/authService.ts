import { isRecord, storage } from "../lib/storage";
import { MOCK_PASSWORD, MOCK_USERS } from "../app/constants";
import { getCurrentUser } from "./accessService";
import type { AuthService, LoginCredentials, User } from "../types/auth";

/** Хранилище «ключ — значение», в котором лежит вошедший пользователь. */
type AuthStorage = Pick<typeof storage, "read" | "write" | "remove">;

/** Только аккаунты хакатона; прогресс уроков по-прежнему привязан к постоянному ID пользователя. */
export class MockAuthService implements AuthService {
  readonly isRemote: boolean;
  private storage: AuthStorage;
  private readCurrentUser: () => User | null;

  constructor(authStorage: AuthStorage, currentUser: () => User | null) {
    this.isRemote = false;
    this.storage = authStorage;
    this.readCurrentUser = currentUser;
  }

  getCurrentUser = (): User | null => this.readCurrentUser();

  async initialize() { return this.readCurrentUser(); }

  onSignedOut(callback: () => void) { void callback; return () => undefined; }

  guest() {
    const previous = this.storage.read("guest");
    const user: User = {
      id: isRecord(previous) && typeof previous.id === "string" ? previous.id : crypto.randomUUID(),
      name: "Гость", isGuest: true,
    };
    this.storage.write("guest", user);
    return this.remember(user);
  }

  async login({ email: login, password }: LoginCredentials): Promise<User> {
    const account = MOCK_USERS.find(user => user.name === login.trim());
    if (!account || password !== MOCK_PASSWORD)
      throw new Error("Неверный логин или пароль");
    return this.remember({ id: account.id, name: account.name, isGuest: false, role: "user", authProvider: "mock" });
  }

  logout() { this.storage.remove("user"); }

  private remember(user: User) {
    this.storage.write("user", user);
    return user;
  }
}

/** Общий сервис входа приложения. */
export const authService: AuthService = new MockAuthService(storage, getCurrentUser);
