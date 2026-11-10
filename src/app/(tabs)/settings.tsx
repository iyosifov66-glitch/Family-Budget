import { useSession } from '@/features/auth/session';
import { useHousehold } from '@/features/household/data';
import { HouseholdSettings } from '@/features/household/screens';
import { Loading } from '@/ui/ui';

export default function Settings() {
  const { session } = useSession();
  const userId = session!.user.id;
  const { data } = useHousehold(userId);
  if (!data?.household) return <Loading />;
  return <HouseholdSettings household={data.household} members={data.members} invitations={data.invitations} userId={userId} />;
}
