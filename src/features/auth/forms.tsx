import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Card, Copy, Field, Heading, Screen } from '@/ui/ui';
import { errorMessage } from '@/lib/supabase';
import { email, password } from './flows';
import { flows } from './session';

const schema = z.object({ email, password: z.string(), token: z.string() }).superRefine(({ password: secret }, ctx) => {
  if (secret.length > 72) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Use at most 72 characters.' });
});
type Mode = 'login' | 'register' | 'reset' | 'resend' | 'verify';

const labels = {
  login: 'Sign in', register: 'Create account', reset: 'Send reset link', resend: 'Resend verification', verify: 'Verify email',
};

export function AuthForm() {
  const [mode, setMode] = useState<Mode>('login');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { control, handleSubmit, setError: fieldError, resetField, formState } = useForm({
    resolver: zodResolver(schema), defaultValues: { email: '', password: '', token: '' },
  });
  const needsPassword = mode === 'login' || mode === 'register';

  function switchTo(next: Mode) {
    resetField('password');
    resetField('token');
    setMessage('');
    setError('');
    setMode(next);
  }

  const submit = handleSubmit(async (input) => {
    setMessage('');
    setError('');
    if (needsPassword && (mode === 'register' ? !password.safeParse(input.password).success : !input.password)) {
      fieldError('password', { message: mode === 'register' ? 'Use at least 8 characters.' : 'Enter your password.' });
      return;
    }
    if (mode === 'verify' && !/^\d{6,10}$/.test(input.token.trim())) {
      fieldError('token', { message: 'Enter the code from your verification email.' });
      return;
    }
    if (!flows) return;
    try {
      if (mode === 'login') await flows.login(input.email, input.password);
      if (mode === 'register') {
        await flows.register(input.email, input.password);
        switchTo('verify');
        setMessage('Enter the verification code from your email.');
      }
      if (mode === 'verify') await flows.verify(input.email, input.token.trim());
      if (mode === 'reset') {
        await flows.requestReset(input.email);
        setMessage('If an account exists, a reset link will arrive shortly.');
      }
      if (mode === 'resend') {
        await flows.resend(input.email);
        switchTo('verify');
        setMessage('Enter the new verification code from your email.');
      }
    } catch (failure) {
      setError(errorMessage(failure));
    }
  });

  return <Screen>
    <Heading title={labels[mode]} description="A shared place to plan and track your household budget." />
    <Card>
      <Controller control={control} name="email" render={({ field, fieldState }) =>
        <Field label="Email address" keyboardType="email-address" autoCapitalize="none" autoComplete="email"
          value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />} />
      {needsPassword && <Controller control={control} name="password" render={({ field, fieldState }) =>
        <Field label="Password" secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />} />}
      {mode === 'verify' && <Controller control={control} name="token" render={({ field, fieldState }) =>
        <Field label="Verification code" keyboardType="number-pad" autoComplete="one-time-code"
          value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />} />}
      {message ? <Copy>{message}</Copy> : null}
      {error ? <Copy tone="danger">{error}</Copy> : null}
      <Button title={labels[mode]} onPress={() => void submit()} busy={formState.isSubmitting} />
    </Card>
    <Card>
      {(Object.keys(labels) as Mode[]).filter((option) => option !== mode).map((option) =>
        <Button key={option} title={option === 'reset' ? 'Forgot password?' : labels[option]} secondary
          disabled={formState.isSubmitting} onPress={() => switchTo(option)} />)}
    </Card>
  </Screen>;
}
