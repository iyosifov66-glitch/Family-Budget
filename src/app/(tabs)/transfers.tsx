import { Card, Copy, Heading, Screen } from '@/ui/ui';

export default function Transfers() {
  return <Screen>
    <Heading title="Transfers" description="Your shared household budget in EUR." />
    <Card><Copy tone="muted">Category transfers and their history will appear here when transfers are available.</Copy></Card>
  </Screen>;
}
