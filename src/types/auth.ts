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

/** Sign-in service used by the app (mock accounts during the hackathon). */
export interface AuthService {
  /** True when accounts live on a remote server (a plain value, not a method). */
  readonly isRemote: boolean;
  /** Signed-in user or guest (arrow field: passed to `useState` without a call). */
  getCurrentUser: () => User | null;
  initialize(): Promise<User | null>;
  onSignedOut(callback: () => void): () => void;
  guest(): User;
  login(credentials: LoginCredentials): Promise<User>;
  logout(): void;
}
