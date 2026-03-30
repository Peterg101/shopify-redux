import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const REFRESH_KEY = 'refresh_token';

// expo-secure-store is native-only — use localStorage on web
const storage = {
  get: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  set: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  remove: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export async function getToken(): Promise<string | null> {
  return storage.get(TOKEN_KEY);
}

export async function setTokens(token: string, refreshToken: string): Promise<void> {
  await storage.set(TOKEN_KEY, token);
  await storage.set(REFRESH_KEY, refreshToken);
}

export async function getRefreshToken(): Promise<string | null> {
  return storage.get(REFRESH_KEY);
}

export async function clearTokens(): Promise<void> {
  await storage.remove(TOKEN_KEY);
  await storage.remove(REFRESH_KEY);
}
