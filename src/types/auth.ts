export interface User {
  id: string;
  name: string;
  email?: string;
  isGuest: boolean;
  role?: 'user' | 'admin';
  authProvider?: 'mock' | 'remote';
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
  speechEnabled: boolean;
  vibrationEnabled: boolean;
  calibrationCompleted: boolean;
}
