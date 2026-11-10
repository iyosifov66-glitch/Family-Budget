import { Card, Copy, Heading, Screen } from '@/ui/ui';

export default function Analytics() {
  return <Screen>
    <Heading title="Analytics" description="Your shared household budget in EUR." />
    <Card><Copy tone="muted">Monthly and yearly summaries will appear here once your household starts recording expenses.</Copy></Card>
  </Screen>;
}
