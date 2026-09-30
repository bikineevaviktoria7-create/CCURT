export interface User {
  id: string;
  name: string;
  email?: string;
  isGuest: boolean;
  role?: "user" | "admin";
  authProvider?: "mock" | "remote";
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface UserSettings {
  dominantHand: "right" | "left";
  soundEnabled: boolean;
  speechEnabled: boolean;
  calibrationCompleted: boolean;
}

/** Сервис входа, которым пользуется приложение (тестовые аккаунты на время хакатона). */
export interface AuthService {
  /** True, если аккаунты хранятся на удалённом сервере (простое значение, не метод). */
  readonly isRemote: boolean;
  /** Вошедший пользователь или гость (поле-стрелка: передаётся в `useState` без вызова). */
  getCurrentUser: () => User | null;
  initialize(): Promise<User | null>;
  onSignedOut(callback: () => void): () => void;
  guest(): User;
  login(credentials: LoginCredentials): Promise<User>;
  logout(): void;
}
