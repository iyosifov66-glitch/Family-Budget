import { router } from 'expo-router';
import { useSession } from '@/features/auth/session';
import { useHousehold } from '@/features/household/data';
import { Button, Card, Copy, Heading, Screen } from '@/ui/ui';

export default function Dashboard() {
  const { session } = useSession();
  const { data } = useHousehold(session!.user.id);
  return <Screen>
    <Heading title={data?.household?.name ?? 'Dashboard'} description="Your shared budget workspace." />
    <Card><Copy>{data?.members.length ?? 0} of 2 household members</Copy>
      <Button title="Manage household" secondary onPress={() => router.navigate('/settings')} /></Card>
    <Card><Copy tone="muted">Your monthly overview will appear here once planning and expense tracking are available.</Copy></Card>
  </Screen>;
}
