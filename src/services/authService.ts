import { isRecord, storage } from "../lib/storage";
import { MOCK_AUTH_ENABLED, MOCK_CREDENTIALS } from "../app/constants";
import { currentUser } from "./accessService";
import { supabase } from "../lib/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";
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

async function profileFor(authUser: SupabaseUser): Promise<User> {
  const fallbackName =
    typeof authUser.user_metadata?.name === "string"
      ? authUser.user_metadata.name
      : (authUser.email?.split("@")[0] ?? "Ученик");
  const { data } = supabase
    ? await supabase.from("profiles").select("name, role").eq("id", authUser.id).maybeSingle()
    : { data: null };
  const profile = data as { name?: string; role?: string } | null;
  return {
    id: authUser.id,
    name: profile?.name?.trim() || fallbackName,
    email: authUser.email,
    isGuest: false,
    role: profile?.role === "admin" ? "admin" : "user",
  };
}

function translate(message: string) {
  const text = message.toLowerCase();
  if (text.includes("invalid login")) return "Неверный email или пароль.";
  if (text.includes("already registered")) return "Этот email уже зарегистрирован. Войдите в аккаунт.";
  if (text.includes("expired") || text.includes("invalid") || text.includes("token"))
    return "Код не подходит или устарел. Проверьте цифры или запросите новый код.";
  if (text.includes("rate limit") || text.includes("security purposes"))
    return "Слишком много попыток. Подождите минуту и попробуйте снова.";
  if (text.includes("password")) return "Пароль не подходит: используйте не менее 8 символов.";
  return "Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.";
}

/** Supabase authentication with a real 6-digit email code. */
const remoteAuth = {
  async register({ name, email, password }: RegisterCredentials) {
    if (!supabase) throw new Error("Сервер не настроен");
    const normalized = email.trim().toLowerCase();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.signUp({
      email: normalized,
      password,
      options: {
        data: { name: name.trim() },
        emailRedirectTo: redirectTo,
      },
    });
    if (error) throw new Error(translate(error.message));
    // With email confirmation on, an existing address returns a user without identities.
    if (data.user && data.user.identities?.length === 0)
      throw new Error("Этот email уже зарегистрирован. Войдите в аккаунт.");
    storage.write("pending-email", normalized);
  },
  async verify(code: string, email: string) {
    if (!supabase) throw new Error("Сервер не настроен");
    let result = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (result.error) result = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
    if (result.error || !result.data.user) throw new Error(translate(result.error?.message ?? "invalid"));
    storage.remove("pending-email");
    return remember(await profileFor(result.data.user));
  },
  async resend(email: string) {
    if (!supabase) return;
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) throw new Error(translate(error.message));
  },
  async login({ email, password }: LoginCredentials) {
    if (!supabase) throw new Error("Сервер не настроен");
    const normalized = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password });
    if (error) {
      if (error.code === "email_not_confirmed" || error.message.toLowerCase().includes("not confirmed")) {
        storage.write("pending-email", normalized);
        throw new Error("Email ещё не подтверждён. Проверьте письмо в почте и подтвердите аккаунт, затем войдите снова.");
      }
      throw new Error(translate(error.message));
    }
    return remember(await profileFor(data.user));
  },
};

const connectedAuthService = {
  /** True when accounts live in Supabase and codes are really emailed. */
  isRemote: supabase !== null,
  /** Restores the session on page load. */
  async init(): Promise<User | null> {
    const stored = this.getUser();
    if (!supabase || stored?.isGuest) return stored;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      if (stored) storage.remove("user");
      return null;
    }
    return remember(await profileFor(data.session.user));
  },
  onSignedOut(callback: () => void) {
    if (!supabase) return () => undefined;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") callback();
    });
    return () => data.subscription.unsubscribe();
  },
  async resendCode() {
    const email = this.pendingEmail();
    if (email && supabase) await remoteAuth.resend(email);
  },
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
  async register(credentials: RegisterCredentials) {
    if (supabase) return remoteAuth.register(credentials);
    const { name, email, password } = credentials;
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
    const pending = this.pendingEmail();
    if (supabase && pending) return remoteAuth.verify(code, pending);
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
  async login(credentials: LoginCredentials) {
    if (supabase) return remoteAuth.login(credentials);
    const { email, password } = credentials;
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
    void supabase?.auth.signOut();
  },
};


const mockAuthService = {
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
    if (login.trim() !== MOCK_CREDENTIALS.login || password !== MOCK_CREDENTIALS.password)
      throw new Error("Неверный логин или пароль.");
    return remember({ id: MOCK_CREDENTIALS.userId, name: MOCK_CREDENTIALS.login, isGuest: false, role: "user", authProvider: "mock" });
  },
  async register(credentials: RegisterCredentials): Promise<void> { void credentials; throw new Error("Регистрация временно недоступна. Используйте тестовый вход."); },
  async verify(code: string): Promise<User> { void code; throw new Error("Подтверждение email временно недоступно."); },
  async resendCode() {},
  pendingEmail: () => null,
  logout() { storage.remove("user"); },
};

export const authService = MOCK_AUTH_ENABLED ? mockAuthService : connectedAuthService;
