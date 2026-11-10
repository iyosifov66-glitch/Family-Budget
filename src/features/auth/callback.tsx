import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Card, Copy, Field, Heading, Loading, Screen } from '@/ui/ui';
import { errorMessage } from '@/lib/supabase';
import { password } from './flows';
import { flows } from './session';

const exchanges = new Map<string, Promise<void>>();

function redeem(code: string | undefined) {
  if (!flows) return Promise.reject(new Error('Supabase is not configured.'));
  if (!code) return flows.redeem(code);
  const pending = exchanges.get(code);
  if (pending) return pending;
  const exchange = flows.redeem(code).finally(() => exchanges.delete(code));
  exchanges.set(code, exchange);
  return exchange;
}

export function AuthCallback({ recovery = false }: { recovery?: boolean }) {
  const { code, error_description } = useLocalSearchParams();
  const authCode = typeof code === 'string' ? code : undefined;
  const linkError = typeof error_description === 'string' ? error_description : undefined;
  const [result, setResult] = useState<{ code?: string; error?: string }>();
  const [submitError, setSubmitError] = useState('');
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(z.object({ password })), defaultValues: { password: '' },
  });

  useEffect(() => {
    let active = true;
    if (!linkError) void redeem(authCode).then(
      () => { if (active) setResult({ code: authCode }); },
      (error: unknown) => { if (active) setResult({ code: authCode, error: errorMessage(error) }); },
    );
    return () => { active = false; };
  }, [authCode, linkError]);

  const failure = linkError || result?.error;
  if (!failure && (!result || result.code !== authCode)) return <Loading label="Checking your link…" />;

  const submit = handleSubmit(async ({ password: secret }) => {
    setSubmitError('');
    try {
      await flows!.reset(secret);
      router.dismissTo('/');
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  });

  return <Screen>
    <Heading title={recovery ? 'Reset password' : 'Verify email'}
      description={failure ? 'Return to the app to request a new link.' :
        recovery ? 'Choose a new password for your account.' : 'Your email is verified.'} />
    <Card>
      {failure ? <Copy tone="danger">{failure}</Copy> : null}
      {recovery && !failure ? <>
        <Controller control={control} name="password" render={({ field, fieldState }) =>
          <Field label="New password" secureTextEntry autoComplete="new-password" value={field.value}
            onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />} />
        {submitError ? <Copy tone="danger">{submitError}</Copy> : null}
        <Button title="Save password" busy={formState.isSubmitting} onPress={() => void submit()} />
      </> : <Button title="Continue" onPress={() => router.dismissTo('/')} />}
    </Card>
  </Screen>;
}
