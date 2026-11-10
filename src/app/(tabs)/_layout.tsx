import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSession } from '@/features/auth/session';
import { useHousehold, useHouseholdSync } from '@/features/household/data';
import { Onboarding } from '@/features/household/screens';
import { errorMessage, supabase } from '@/lib/supabase';
import { Button, Card, Copy, Heading, Loading, Screen, usePalette } from '@/ui/ui';

const tabIcons: Record<string, string> = { dashboard: '▦', budget: '€', transfers: '⇄', analytics: '▥', settings: '⚙' };

function HouseholdTabs({ userId }: { userId: string }) {
  const colors = usePalette();
  const query = useHousehold(userId);
  useHouseholdSync(userId, query.data?.household?.id);

  if (!query.data && query.isPending) return <Loading label="Finding your household…" />;
  if (!query.data) return <Screen>
    <Heading title="Household unavailable" description="We couldn’t load your household." />
    <Card><Copy tone="danger">{errorMessage(query.error)}</Copy>
      <Button title="Try again" busy={query.isFetching} onPress={() => void query.refetch()} /></Card>
  </Screen>;
  if (!query.data.household) return <Onboarding userId={userId} invitations={query.data.invitations} />;

  return <Tabs screenOptions={({ route }) => ({
    headerShown: false, sceneStyle: { backgroundColor: colors.background },
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
    tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted,
    tabBarIcon: ({ color }) => <Text accessibilityElementsHidden importantForAccessibility="no"
      style={{ color, fontSize: 16, fontWeight: '700' }}>{tabIcons[route.name]}</Text>,
    tabBarLabelPosition: 'below-icon',
    tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
  })}>
    <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
    <Tabs.Screen name="budget" options={{ title: 'Budget' }} />
    <Tabs.Screen name="transfers" options={{ title: 'Transfers' }} />
    <Tabs.Screen name="analytics" options={{ title: 'Analytics' }} />
    <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
  </Tabs>;
}

export default function TabLayout() {
  const { session, loading } = useSession();
  if (!supabase) return <Redirect href="/" />;
  if (loading) return <Loading label="Restoring your session…" />;
  if (!session) return <Redirect href="/" />;
  return <HouseholdTabs key={session.user.id} userId={session.user.id} />;
}
