import { isRecord, storage } from "../lib/storage";
import type {
  LoginCredentials,
  RegisterCredentials,
  User,
} from "../types/auth";

interface LocalAccount {
  user: User;
  salt: string;
  hash: string;
  verified: boolean;
}
export const DEMO_CODE = "123456";

function isUser(value: unknown): value is User {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.isGuest === "boolean"
  );
}
function accounts(): LocalAccount[] {
  const value = storage.read("accounts");
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is LocalAccount =>
      isRecord(item) &&
      isUser(item.user) &&
      typeof item.salt === "string" &&
      typeof item.hash === "string" &&
      typeof item.verified === "boolean",
  );
}
async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 100_000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
function remember(user: User) {
  storage.write("user", user);
  return user;
}

// Local demo authentication only. Replace this service with a backend provider.
export const authService = {
  getUser() {
    const value = storage.read("user");
    return isUser(value) ? value : null;
  },
  guest() {
    const previous = storage.read("guest");
    const user: User = isUser(previous)
      ? previous
      : { id: crypto.randomUUID(), name: "Гость", isGuest: true };
    storage.write("guest", user);
    return remember(user);
  },
  async register({ name, email, password }: RegisterCredentials) {
    const list = accounts();
    const normalized = email.trim().toLowerCase();
    if (list.some((account) => account.user.email === normalized))
      throw new Error("Этот email уже зарегистрирован. Войдите в аккаунт.");
    const salt = crypto.randomUUID();
    const user: User = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalized,
      isGuest: false,
      role: "user",
    };
    list.push({
      user,
      salt,
      hash: await hashPassword(password, salt),
      verified: false,
    });
    storage.write("accounts", list);
    storage.write("pending-email", normalized);
  },
  pendingEmail() {
    const value = storage.read("pending-email");
    return typeof value === "string" ? value : null;
  },
  async verify(code: string) {
    if (code !== DEMO_CODE)
      throw new Error("Код не подходит. Проверьте все шесть цифр.");
    const list = accounts();
    const account = list.find(
      (item) => item.user.email === this.pendingEmail(),
    );
    if (!account)
      throw new Error("Сначала зарегистрируйтесь, чтобы подтвердить email.");
    account.verified = true;
    storage.write("accounts", list);
    storage.remove("pending-email");
    return remember(account.user);
  },
  async login({ email, password }: LoginCredentials) {
    const account = accounts().find(
      (item) => item.user.email === email.trim().toLowerCase(),
    );
    if (
      !account ||
      (await hashPassword(password, account.salt)) !== account.hash
    )
      throw new Error("Неверный email или пароль.");
    if (!account.verified) {
      storage.write("pending-email", account.user.email);
      return null;
    }
    return remember(account.user);
  },
  logout() {
    storage.remove("user");
  },
};
