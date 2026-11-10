import { Card, Copy, Heading, Screen } from '@/ui/ui';

export default function Budget() {
  return <Screen>
    <Heading title="Budget" description="Your shared household budget in EUR." />
    <Card><Copy tone="muted">Monthly allocations and expenses will appear here. Your household starts with 14 categories, including Savings as a reserve.</Copy></Card>
  </Screen>;
}
