import { Redirect } from 'expo-router';
import { AuthForm } from '@/features/auth/forms';
import { useSession } from '@/features/auth/session';
import { errorMessage, supabase } from '@/lib/supabase';
import { Card, Copy, Heading, Loading, Screen } from '@/ui/ui';

export default function Index() {
  const { session, loading, error } = useSession();
  if (!supabase) return <Screen><Heading title="Connect Supabase" description="Add the project URL and publishable key to your local environment." />
    <Card><Copy>See .env.example and the setup steps in README.md.</Copy></Card></Screen>;
  if (loading) return <Loading label="Restoring your session…" />;
  if (session) return <Redirect href="/dashboard" />;
  return <>{error ? <Copy tone="danger">{errorMessage(error)}</Copy> : null}<AuthForm /></>;
}
