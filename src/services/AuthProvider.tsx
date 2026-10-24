// ─── Dhun Authentication Provider ─────────────────────────────────────

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, StoredAccount } from '@/types/auth';
import { storage } from '@/utils/storage';

const USER_SESSION_KEY = 'dhun_auth_user_session';
const ACCOUNTS_DB_KEY = 'dhun_registered_accounts_db';
const RECENT_PASSWORD_KEY = 'dhun_recent_generated_pwd';
const RECENT_EMAIL_KEY = 'dhun_recent_signup_email';

export function generateDhunPassword(): string {
  const musicalWords = [
    'raag',
    'alap',
    'taal',
    'sur',
    'swar',
    'tarana',
    'zenith',
    'akash',
    'dhwani',
    'shanti',
    'lossless',
    'clarity',
    'bhairav',
    'malhar',
  ];
  const word = musicalWords[Math.floor(Math.random() * musicalWords.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `dhun-${word}-${digits}`;
}

// Initial demo accounts
const DEFAULT_ACCOUNTS: Record<string, StoredAccount> = {
  'arjun@email.com': {
    user: {
      id: 'usr_arjun_demo',
      name: 'Arjun Mehta',
      email: 'arjun@email.com',
      avatar: null,
      provider: 'email',
      createdAt: '2026-01-15T00:00:00.000Z',
    },
    generatedPassword: 'dhun-alap-2026',
  },
};

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  recentGeneratedPassword: string | null;
  recentEmail: string | null;
  signupWithEmail: (email: string, name?: string) => Promise<{ user: AuthUser; generatedPassword: string }>;
  signupWithGoogle: () => Promise<AuthUser>;
  loginWithEmail: (email: string, password: string) => Promise<AuthUser>;
  loginWithGoogle: () => Promise<AuthUser>;
  logout: () => Promise<void>;
  getGeneratedPassword: (email: string) => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<Record<string, StoredAccount>>(DEFAULT_ACCOUNTS);
  const [recentGeneratedPassword, setRecentGeneratedPassword] = useState<string | null>(null);
  const [recentEmail, setRecentEmail] = useState<string | null>(null);

  // Initialize from storage on mount
  useEffect(() => {
    try {
      // Load accounts database
      const storedAccounts = storage.getItem(ACCOUNTS_DB_KEY);
      if (storedAccounts) {
        const parsed = JSON.parse(storedAccounts);
        setAccounts({ ...DEFAULT_ACCOUNTS, ...parsed });
      }

      // Load active user session
      const storedUser = storage.getItem(USER_SESSION_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        setUser(null);
      }

      // Load recent signup credentials for convenience
      const recentPwd = storage.getItem(RECENT_PASSWORD_KEY);
      if (recentPwd) setRecentGeneratedPassword(recentPwd);

      const savedRecentEmail = storage.getItem(RECENT_EMAIL_KEY);
      if (savedRecentEmail) setRecentEmail(savedRecentEmail);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveAccounts = (newAccounts: Record<string, StoredAccount>) => {
    setAccounts(newAccounts);
    try {
      storage.setItem(ACCOUNTS_DB_KEY, JSON.stringify(newAccounts));
    } catch {
      // Ignore
    }
  };

  const signupWithEmail = async (
    email: string,
    name?: string
  ): Promise<{ user: AuthUser; generatedPassword: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    const userName = name?.trim() || cleanEmail.split('@')[0];
    const generatedPassword = generateDhunPassword();

    const newUser: AuthUser = {
      id: `usr_${Date.now()}`,
      name: userName,
      email: cleanEmail,
      avatar: null,
      provider: 'email',
      createdAt: new Date().toISOString(),
    };

    const newAccounts = {
      ...accounts,
      [cleanEmail]: {
        user: newUser,
        generatedPassword,
      },
    };

    saveAccounts(newAccounts);
    setUser(newUser);
    setRecentGeneratedPassword(generatedPassword);
    setRecentEmail(cleanEmail);

    try {
      storage.setItem(USER_SESSION_KEY, JSON.stringify(newUser));
      storage.setItem(RECENT_PASSWORD_KEY, generatedPassword);
      storage.setItem(RECENT_EMAIL_KEY, cleanEmail);
    } catch {
      // Ignore
    }

    return { user: newUser, generatedPassword };
  };

  const signupWithGoogle = async (): Promise<AuthUser> => {
    // Simulated Google OAuth profile
    const googleUser: AuthUser = {
      id: `usr_google_${Date.now()}`,
      name: 'Arjun Mehta',
      email: 'arjun.mehta@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      provider: 'google',
      createdAt: new Date().toISOString(),
    };

    const newAccounts = {
      ...accounts,
      [googleUser.email]: {
        user: googleUser,
      },
    };

    saveAccounts(newAccounts);
    setUser(googleUser);

    try {
      storage.setItem(USER_SESSION_KEY, JSON.stringify(googleUser));
    } catch {
      // Ignore
    }

    return googleUser;
  };

  const loginWithEmail = async (email: string, password: string): Promise<AuthUser> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!cleanPassword) {
      throw new Error('Please enter your generated password.');
    }

    const account = accounts[cleanEmail];
    if (!account) {
      throw new Error('No account found with this email. Please sign up first.');
    }

    if (account.generatedPassword && account.generatedPassword !== cleanPassword) {
      throw new Error(
        'Incorrect password. Please enter the password that was generated during signup.'
      );
    }

    setUser(account.user);
    try {
      storage.setItem(USER_SESSION_KEY, JSON.stringify(account.user));
    } catch {
      // Ignore
    }

    return account.user;
  };

  const loginWithGoogle = async (): Promise<AuthUser> => {
    // Simulated Google Login
    const googleUser: AuthUser = {
      id: 'usr_google_connected',
      name: 'Arjun Mehta',
      email: 'arjun.mehta@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      provider: 'google',
      createdAt: new Date().toISOString(),
    };

    setUser(googleUser);
    try {
      storage.setItem(USER_SESSION_KEY, JSON.stringify(googleUser));
    } catch {
      // Ignore
    }

    return googleUser;
  };

  const logout = async (): Promise<void> => {
    setUser(null);
    try {
      storage.removeItem(USER_SESSION_KEY);
    } catch {
      // Ignore
    }
  };

  const getGeneratedPassword = (email: string): string | null => {
    const cleanEmail = email.trim().toLowerCase();
    return accounts[cleanEmail]?.generatedPassword ?? null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        recentGeneratedPassword,
        recentEmail,
        signupWithEmail,
        signupWithGoogle,
        loginWithEmail,
        loginWithGoogle,
        logout,
        getGeneratedPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
