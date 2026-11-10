import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '@/features/auth/session';
import { Button, Card, Heading, Screen, usePalette } from '@/ui/ui';

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <Screen><Heading title="Something went wrong" description="The app could not display this screen." />
    <Card><Button title="Try again" onPress={() => void retry()} /></Card></Screen>;
}

export default function RootLayout() {
  const colors = usePalette();
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));

  useEffect(() => {
    const app = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
    return () => app.remove();
  }, []);

  return <QueryClientProvider client={client}><SessionProvider>
    <StatusBar style={colors.background === '#101A17' ? 'light' : 'dark'} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  </SessionProvider></QueryClientProvider>;
}
