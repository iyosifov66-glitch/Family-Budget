import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const email = z.string().trim().toLowerCase().email().max(254);
export const password = z.string().min(8, 'Use at least 8 characters.').max(72);
export const verifyUrl = 'familybudget://verify';
export const resetUrl = 'familybudget://reset';

type Auth = Pick<SupabaseClient['auth'],
  'signUp' | 'signInWithPassword' | 'resetPasswordForEmail' | 'exchangeCodeForSession' |
  'updateUser' | 'signOut' | 'resend' | 'verifyOtp'>;

function check<T extends { error: unknown }>(result: T) {
  if (result.error) throw result.error;
  return result;
}

export function authFlows(auth: Auth) {
  return {
    async register(address: string, secret: string) {
      check(await auth.signUp({ email: address, password: secret, options: { emailRedirectTo: verifyUrl } }));
    },
    async login(address: string, secret: string) {
      check(await auth.signInWithPassword({ email: address, password: secret }));
    },
    async resend(address: string) {
      check(await auth.resend({ type: 'signup', email: address, options: { emailRedirectTo: verifyUrl } }));
    },
    async verify(address: string, token: string) {
      check(await auth.verifyOtp({ email: address, token, type: 'email' }));
    },
    async requestReset(address: string) {
      check(await auth.resetPasswordForEmail(address, { redirectTo: resetUrl }));
    },
    async redeem(code: string | string[] | undefined) {
      if (typeof code !== 'string' || !code) throw new Error('This link is missing or has expired. Request a new email.');
      check(await auth.exchangeCodeForSession(code));
    },
    async reset(secret: string) {
      check(await auth.updateUser({ password: secret }));
    },
    async logout() {
      check(await auth.signOut({ scope: 'local' }));
    },
  };
}
