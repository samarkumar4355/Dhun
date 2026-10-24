// ─── Dhun Authentication Models ─────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  provider: 'email' | 'google';
  createdAt: string;
}

export interface StoredAccount {
  user: AuthUser;
  generatedPassword?: string;
}
