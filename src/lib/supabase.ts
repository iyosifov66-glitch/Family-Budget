import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && key && /^https?:\/\/[^\s/]+(?:\/)?$/.test(url) && !url.includes('YOUR_PROJECT_REF')
  ? createClient(url, key, {
      auth: {
        storage: {
          getItem: SecureStore.getItemAsync,
          setItem: SecureStore.setItemAsync,
          removeItem: SecureStore.deleteItemAsync,
        },
        lock: processLock,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

export function errorMessage(error: unknown) {
  return error instanceof Error || (error && typeof error === 'object' && 'message' in error)
    ? String(error.message)
    : 'Something went wrong. Please try again.';
}
