import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type Member = { user_id: string; display_name: string; slot: number };
export type Invitation = { id: string; household_id: string; email: string; expires_at: string };
export type Household = { id: string; name: string; currency: string };

export function useHousehold(userId: string) {
  return useQuery({
    queryKey: ['household', userId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const client = supabase!;
      const membership = await client.from('household_members').select('household_id')
        .eq('user_id', userId).maybeSingle().throwOnError();
      const householdId = membership.data?.household_id;
      if (!householdId) {
        const { data } = await client.from('household_invitations').select('id, household_id, email, expires_at')
          .is('accepted_at', null).order('expires_at', { ascending: false }).throwOnError();
        return { household: null, members: [], invitations: (data ?? []) as Invitation[] };
      }

      const [household, members, invitations] = await Promise.all([
        client.from('households').select('id, name, currency').eq('id', householdId).single().throwOnError(),
        client.from('household_members').select('user_id, display_name, slot').eq('household_id', householdId)
          .order('slot').throwOnError(),
        client.from('household_invitations').select('id, household_id, email, expires_at')
          .eq('household_id', householdId).is('accepted_at', null).throwOnError(),
      ]);
      return { household: household.data as Household, members: (members.data ?? []) as Member[],
        invitations: (invitations.data ?? []) as Invitation[] };
    },
  });
}

export function useHouseholdSync(userId: string, householdId?: string) {
  const cache = useQueryClient();
  useEffect(() => {
    const client = supabase;
    if (!client || !householdId) return;
    const refresh = () => { void cache.invalidateQueries({ queryKey: ['household', userId] }); };
    const filter = 'household_id=eq.' + householdId;
    const channel = client.channel('household:' + householdId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'household_members', filter }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'household_invitations', filter }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'household_invitations', filter }, refresh)
      .subscribe((status) => { if (status === 'SUBSCRIBED') refresh(); });
    return () => { void client.removeChannel(channel); };
  }, [cache, householdId, userId]);
}
