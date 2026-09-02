export interface UserPreferences {
  theme?: 'dark' | 'light' | 'system';
  reflectionReminder?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  preferences?: UserPreferences;
  createdAt?: unknown;
  lastLoginAt?: unknown;
}

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  name: string | null;
  photoURL?: string | null;
}
