import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authFlows, email, password, resetUrl, verifyUrl } from '../src/features/auth/flows';

const auth = {
  signUp: vi.fn(), signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn(),
  exchangeCodeForSession: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), resend: vi.fn(), verifyOtp: vi.fn(),
};
const flows = authFlows(auth);

beforeEach(() => {
  for (const method of Object.values(auth)) method.mockReset().mockResolvedValue({ error: null });
});

describe('email and password flows', () => {
  it('normalizes email and validates registration passwords', () => {
    expect(email.parse(' MEMBER@Example.com ')).toBe('member@example.com');
    expect(email.safeParse('not-an-email').success).toBe(false);
    expect(password.safeParse('short').success).toBe(false);
  });

  it('registers and resends confirmation with the verification redirect', async () => {
    await flows.register('member@example.com', 'some-password');
    await flows.resend('member@example.com');
    await flows.verify('member@example.com', '123456');
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'member@example.com', token: '123456', type: 'email' });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'member@example.com', password: 'some-password', options: { emailRedirectTo: verifyUrl },
    });
    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup', email: 'member@example.com', options: { emailRedirectTo: verifyUrl },
    });
  });

  it('signs in and signs out the current device', async () => {
    await flows.login('member@example.com', 'some-password');
    await flows.logout();
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'member@example.com', password: 'some-password' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('requests recovery, redeems a PKCE code, and changes the password', async () => {
    await flows.requestReset('member@example.com');
    await flows.redeem('pkce-code');
    await flows.reset('new-password');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('member@example.com', { redirectTo: resetUrl });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code');
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-password' });
  });

  it('rejects malformed links and reports Supabase errors', async () => {
    await expect(flows.redeem(['first', 'second'])).rejects.toThrow('missing or has expired');
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    const failure = new Error('Email not confirmed');
    auth.signInWithPassword.mockResolvedValue({ error: failure });
    await expect(flows.login('member@example.com', 'some-password')).rejects.toBe(failure);
  });
});
