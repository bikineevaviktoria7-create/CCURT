export interface User {
  id: string;
  name: string;
  email?: string;
  isGuest: boolean;
  role?: 'user' | 'admin';
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  name: string;
}

export interface UserSettings {
  dominantHand: 'right' | 'left';
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  calibrationCompleted: boolean;
}
