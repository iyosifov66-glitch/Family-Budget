import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { email } from '@/features/auth/flows';
import { flows } from '@/features/auth/session';
import { errorMessage, supabase } from '@/lib/supabase';
import { Button, Card, Copy, Field, Heading, Screen } from '@/ui/ui';
import type { Household, Invitation, Member } from './data';

const name = z.string().trim().min(1, 'Enter a name.').max(80);
const householdForm = z.object({ household: z.string(), member: name });

export function SignOut() {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function logout() {
    setBusy(true);
    setError('');
    try {
      await flows!.logout();
      cache.removeQueries({ queryKey: ['household'] });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return <>{error ? <Copy tone="danger">{error}</Copy> : null}
    <Button title="Sign out" onPress={() => void logout()} secondary busy={busy} /></>;
}

export function Onboarding({ userId, invitations }: { userId: string; invitations: Invitation[] }) {
  const cache = useQueryClient();
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState('');
  const invitation = invitations.find((item) => item.id === selected);
  const { control, handleSubmit, setError: fieldError, formState } = useForm({
    resolver: zodResolver(householdForm), defaultValues: { household: '', member: '' },
  });

  const submit = handleSubmit(async (input) => {
    setError('');
    try {
      if (selected) {
        if (!invitation) throw new Error('This invitation is no longer available.');
        await supabase!.rpc('accept_household_invitation', {
          invitation_id: invitation.id, member_name: input.member,
        }).throwOnError();
      } else {
        const parsed = name.safeParse(input.household);
        if (!parsed.success) {
          fieldError('household', { message: parsed.error.issues[0].message });
          return;
        }
        await supabase!.rpc('create_household', {
          household_name: parsed.data, member_name: input.member,
        }).throwOnError();
      }
      await cache.invalidateQueries({ queryKey: ['household', userId] });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  });

  return <Screen>
    <Heading title="Set up your household" description="Create a household or join one using an invitation sent to your verified email." />
    {invitations.length > 0 ? <Card>
      <Copy>Choose an invitation to accept. The household name appears once you join.</Copy>
      {invitations.map((item) => <Button key={item.id} secondary disabled={formState.isSubmitting}
        title={(selected === item.id ? 'Selected · ' : '') + 'Expires ' + new Date(item.expires_at).toLocaleDateString('en-GB')}
        onPress={() => { setSelected(item.id); setError(''); }} />)}
      {selected ? <Button title="Create a new household instead" secondary disabled={formState.isSubmitting}
        onPress={() => { setSelected(undefined); setError(''); }} /> : null}
    </Card> : null}
    <Card>
      {!selected && <Controller control={control} name="household" render={({ field, fieldState }) =>
        <Field label="Household name" value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} error={fieldState.error?.message} />} />}
      <Controller control={control} name="member" render={({ field, fieldState }) =>
        <Field label="Your display name" value={field.value} onChangeText={field.onChange}
          onBlur={field.onBlur} error={fieldState.error?.message} />} />
      {error ? <Copy tone="danger">{error}</Copy> : null}
      <Button title={selected ? 'Accept invitation' : 'Create household'} busy={formState.isSubmitting}
        onPress={() => void submit()} />
      <Button title="Check for invitations" secondary disabled={formState.isSubmitting}
        onPress={() => void cache.invalidateQueries({ queryKey: ['household', userId] })} />
    </Card>
    <SignOut />
  </Screen>;
}

export function HouseholdSettings({ household, members, invitations, userId }:
  { household: Household; members: Member[]; invitations: Invitation[]; userId: string }) {
  const cache = useQueryClient();
  const [error, setError] = useState('');
  const { control, handleSubmit, formState, reset } = useForm({
    resolver: zodResolver(z.object({ email })), defaultValues: { email: '' },
  });
  const pending = invitations.find((item) => Date.parse(item.expires_at) > Date.now());

  const invite = handleSubmit(async ({ email: address }) => {
    setError('');
    try {
      await supabase!.rpc('invite_household_member', { target_household: household.id, invite_email: address })
        .throwOnError();
      reset();
      await cache.invalidateQueries({ queryKey: ['household', userId] });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  });

  async function emailInvitation(address: string) {
    setError('');
    const subject = encodeURIComponent('Join my household in Family Budget');
    const body = encodeURIComponent('Open Family Budget, register or sign in with this email address, and accept the invitation on the household setup screen. The invitation expires in seven days.');
    try {
      await Linking.openURL('mailto:' + encodeURIComponent(address) + '?subject=' + subject + '&body=' + body);
    } catch {
      setError('Could not open your email app. Ask the recipient to sign in with the invited email address.');
    }
  }

  return <Screen>
    <Heading title="Settings" description="Manage your household and account." />
    <Card>
      <Copy>{household.name} · {members.length} of 2 members</Copy>
      {members.map((member) => <View key={member.user_id}>
        <Copy>{member.display_name}{member.user_id === userId ? ' (you)' : ''}</Copy>
        <Copy tone="muted">{member.slot === 1 ? 'Household creator' : 'Member'}</Copy>
      </View>)}
    </Card>
    {members.length < 2 ? <Card>
      <Copy>{pending ? 'Pending invitation for ' + pending.email :
        'Invite one person using the email address they will verify in Family Budget.'}</Copy>
      {pending ? <Button title="Open email draft" secondary onPress={() => void emailInvitation(pending.email)} /> : null}
      <Controller control={control} name="email" render={({ field, fieldState }) =>
        <Field label="Invitee email" keyboardType="email-address" autoCapitalize="none"
          value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />} />
      {pending ? <Copy tone="muted">Creating another invitation replaces the current one.</Copy> : null}
      {error ? <Copy tone="danger">{error}</Copy> : null}
      <Button title={pending ? 'Replace or renew invitation' : 'Create invitation'}
        onPress={() => void invite()} busy={formState.isSubmitting} />
    </Card> : null}
    <Card><SignOut /></Card>
  </Screen>;
}
