// ─── Dhun Secure Token Storage ───────────────────────────────────────
// Uses Expo SecureStore on native devices (iOS Keychain, Android Keystore)
// with safe fallback for web browsers and development environments.

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { storage } from '@/utils/storage';
import { AuthUser } from '@/types/auth';

const ACCESS_TOKEN_KEY = 'dhun_sec_access_token';
const REFRESH_TOKEN_KEY = 'dhun_sec_refresh_token';
const USER_DATA_KEY = 'dhun_sec_user_profile';

async function isSecureStoreAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export const tokenStorage = {
  /**
   * Retrieve the current JWT access token.
   */
  async getAccessToken(): Promise<string | null> {
    try {
      if (await isSecureStoreAvailable()) {
        return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      }
      return storage.getItem(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Retrieve the current refresh token.
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      if (await isSecureStoreAvailable()) {
        return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      }
      return storage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Save both access and refresh tokens securely.
   */
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      if (await isSecureStoreAvailable()) {
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      } else {
        storage.setItem(ACCESS_TOKEN_KEY, accessToken);
        storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      }
    } catch (err) {
      // Fallback
      storage.setItem(ACCESS_TOKEN_KEY, accessToken);
      storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  },

  /**
   * Update only the access token (used during access token rotation).
   */
  async saveAccessToken(accessToken: string): Promise<void> {
    try {
      if (await isSecureStoreAvailable()) {
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      } else {
        storage.setItem(ACCESS_TOKEN_KEY, accessToken);
      }
    } catch {
      storage.setItem(ACCESS_TOKEN_KEY, accessToken);
    }
  },

  /**
   * Save sanitized user profile info.
   */
  async saveUser(user: AuthUser): Promise<void> {
    const json = JSON.stringify(user);
    try {
      if (await isSecureStoreAvailable()) {
        await SecureStore.setItemAsync(USER_DATA_KEY, json);
      } else {
        storage.setItem(USER_DATA_KEY, json);
      }
    } catch {
      storage.setItem(USER_DATA_KEY, json);
    }
  },

  /**
   * Retrieve cached user profile info.
   */
  async getUser(): Promise<AuthUser | null> {
    try {
      let raw: string | null = null;
      if (await isSecureStoreAvailable()) {
        raw = await SecureStore.getItemAsync(USER_DATA_KEY);
      } else {
        raw = storage.getItem(USER_DATA_KEY);
      }
      if (!raw) return null;
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },

  /**
   * Clear all authentication tokens and stored credentials (e.g. on logout or invalid session).
   */
  async clearAll(): Promise<void> {
    try {
      if (await isSecureStoreAvailable()) {
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => {});
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
        await SecureStore.deleteItemAsync(USER_DATA_KEY).catch(() => {});
      }
    } catch {
      // Ignore delete errors
    }
    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
    storage.removeItem(USER_DATA_KEY);
  },
};
