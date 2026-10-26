// ─── Dhun Authentication Provider ─────────────────────────────────────
// Connected to real Dhun Express backend with Expo SecureStore token storage.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser } from '@/types/auth';
import { tokenStorage } from './tokenStorage';
import { api, ApiError } from './api/apiClient';

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

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  recentGeneratedPassword: string | null;
  recentEmail: string | null;
  signupWithEmail: (email: string, name?: string) => Promise<{ user: AuthUser; generatedPassword: string }>;
  signupWithGoogle: (email?: string, displayName?: string) => Promise<AuthUser>;
  loginWithEmail: (email: string, password: string) => Promise<AuthUser>;
  loginWithGoogle: (email?: string, displayName?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  getGeneratedPassword: (email: string) => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentGeneratedPassword, setRecentGeneratedPassword] = useState<string | null>(null);
  const [recentEmail, setRecentEmail] = useState<string | null>(null);

  // Initialize session from secure storage on mount
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        const token = await tokenStorage.getAccessToken();
        if (token) {
          // Verify session against real backend
          const meRes = await api.getMe().catch(() => null);
          if (meRes?.success && meRes.data) {
            const rawUser = meRes.data;
            const authUser: AuthUser = {
              id: rawUser.id || rawUser._id,
              name: rawUser.displayName || rawUser.name || 'Dhun Listener',
              email: rawUser.email,
              avatar: rawUser.avatarUrl || null,
              provider: 'email',
              createdAt: rawUser.createdAt || new Date().toISOString(),
            };
            if (isMounted) setUser(authUser);
            await tokenStorage.saveUser(authUser);
          } else {
            // Token is stale or invalid; clear
            await tokenStorage.clearAll();
            if (isMounted) setUser(null);
          }
        } else {
          if (isMounted) setUser(null);
        }
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    // Attach global callback for session expiry
    api.setOnAuthFailure(() => {
      if (isMounted) setUser(null);
    });

    initSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const signupWithEmail = useCallback(async (email: string, name?: string) => {
    const cleanEmail = email.toLowerCase().trim();
    const displayName = (name || cleanEmail.split('@')[0] || 'Listener').trim();
    const generatedPassword = generateDhunPassword();

    const response = await api.register({
      email: cleanEmail,
      password: generatedPassword,
      displayName,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to create account');
    }

    const { user: rawUser, tokens } = response.data;
    await tokenStorage.saveTokens(tokens.accessToken, tokens.refreshToken);

    const authUser: AuthUser = {
      id: rawUser.id,
      name: rawUser.displayName,
      email: rawUser.email,
      avatar: rawUser.avatarUrl || null,
      provider: 'email',
      createdAt: rawUser.createdAt,
    };

    await tokenStorage.saveUser(authUser);
    setUser(authUser);
    setRecentGeneratedPassword(generatedPassword);
    setRecentEmail(cleanEmail);

    return { user: authUser, generatedPassword };
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.toLowerCase().trim();
    const response = await api.login({
      email: cleanEmail,
      password: password.trim(),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Invalid email or password');
    }

    const { user: rawUser, tokens } = response.data;
    await tokenStorage.saveTokens(tokens.accessToken, tokens.refreshToken);

    const authUser: AuthUser = {
      id: rawUser.id,
      name: rawUser.displayName,
      email: rawUser.email,
      avatar: rawUser.avatarUrl || null,
      provider: 'email',
      createdAt: rawUser.createdAt,
    };

    await tokenStorage.saveUser(authUser);
    setUser(authUser);
    setRecentEmail(cleanEmail);

    return authUser;
  }, []);

  const signupWithGoogle = useCallback(async (customEmail?: string, customName?: string) => {
    const emailToUse = customEmail?.trim() || 'listener@dhun.audio';
    const nameToUse = customName?.trim() || (customEmail ? customEmail.split('@')[0] : 'Google Listener');
    const res = await api.loginWithGoogle({
      email: emailToUse,
      displayName: nameToUse,
    });

    if (!res.success || !res.data) {
      throw new Error(res.error?.message || 'Google sign-in failed');
    }

    const { user: rawUser, tokens } = res.data;
    await tokenStorage.saveTokens(tokens.accessToken, tokens.refreshToken);
    const authUser: AuthUser = {
      id: rawUser.id,
      name: rawUser.displayName,
      email: rawUser.email,
      avatar: rawUser.avatarUrl || null,
      provider: 'google',
      createdAt: rawUser.createdAt,
    };
    await tokenStorage.saveUser(authUser);
    setUser(authUser);
    return authUser;
  }, []);

  const loginWithGoogle = useCallback(async (customEmail?: string, customName?: string) => {
    return signupWithGoogle(customEmail, customName);
  }, [signupWithGoogle]);

  const logout = useCallback(async () => {
    try {
      await api.logout().catch(() => {});
    } finally {
      await tokenStorage.clearAll();
      setUser(null);
    }
  }, []);

  const getGeneratedPassword = useCallback((_email: string) => {
    return recentGeneratedPassword;
  }, [recentGeneratedPassword]);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    recentGeneratedPassword,
    recentEmail,
    signupWithEmail,
    signupWithGoogle,
    loginWithEmail,
    loginWithGoogle,
    logout,
    getGeneratedPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
