create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  currency text not null default 'EUR' check (currency = 'EUR'),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null unique references auth.users on delete cascade,
  slot smallint not null check (slot in (1, 2)),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (household_id, slot)
);

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  email text not null check (email = lower(btrim(email)) and char_length(email) <= 254),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  unique (household_id, email)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null,
  position smallint not null check (position between 1 and 14),
  is_reserve boolean not null default false,
  unique (household_id, id),
  unique (household_id, position)
);

create table public.monthly_allocations (
  household_id uuid not null references public.households on delete cascade,
  category_id uuid not null,
  month date not null check (extract(day from month) = 1),
  amount_cents integer not null check (amount_cents >= 0),
  primary key (household_id, category_id, month),
  foreign key (household_id, category_id) references public.categories (household_id, id) on delete cascade
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  category_id uuid not null,
  spent_on date not null,
  amount_cents integer not null check (amount_cents > 0),
  description text,
  foreign key (household_id, category_id) references public.categories (household_id, id) on delete cascade
);

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  from_category_id uuid not null,
  to_category_id uuid not null,
  transferred_on date not null,
  amount_cents integer not null check (amount_cents > 0),
  check (from_category_id <> to_category_id),
  foreign key (household_id, from_category_id) references public.categories (household_id, id) on delete cascade,
  foreign key (household_id, to_category_id) references public.categories (household_id, id) on delete cascade
);

create index on public.expenses (household_id, spent_on);
create index on public.transfers (household_id, transferred_on);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_member(target uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select from public.household_members m
    where m.household_id = target and m.user_id = auth.uid()
  )
$$;

create function private.verified_email() returns text
language sql stable security definer set search_path = ''
as $$
  select lower(btrim(u.email)) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null
$$;

revoke all on function private.is_member(uuid), private.verified_email() from public, anon, authenticated;
grant execute on function private.is_member(uuid), private.verified_email() to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'households', 'household_members', 'household_invitations', 'categories',
    'monthly_allocations', 'expenses', 'transfers'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
  end loop;
end
$$;

create policy household_read on public.households for select to authenticated
using (private.is_member(id));
create policy members_read on public.household_members for select to authenticated
using (private.is_member(household_id));
create policy invitations_read on public.household_invitations for select to authenticated
using (private.is_member(household_id) or (
  email = (select private.verified_email()) and accepted_at is null and expires_at > now()
));
create policy categories_read on public.categories for select to authenticated
using (private.is_member(household_id));
create policy allocations_read on public.monthly_allocations for select to authenticated
using (private.is_member(household_id));
create policy expenses_read on public.expenses for select to authenticated
using (private.is_member(household_id));
create policy transfers_read on public.transfers for select to authenticated
using (private.is_member(household_id));

create function public.create_household(household_name text, member_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare new_household uuid;
begin
  if private.verified_email() is null then
    raise exception 'Verify your email first.' using errcode = '42501';
  end if;
  if exists (select from public.household_members where user_id = auth.uid()) then
    raise exception 'You already belong to a household.';
  end if;

  insert into public.households (name) values (btrim(household_name)) returning id into new_household;
  insert into public.household_members (household_id, user_id, slot, display_name)
  values (new_household, auth.uid(), 1, btrim(member_name));

  insert into public.categories (household_id, name, position, is_reserve)
  select new_household, label, position, label = 'Savings'
  from unnest(array[
    'Housing', 'Utilities', 'Groceries', 'Transport', 'Health', 'Insurance',
    'Children', 'Dining Out', 'Entertainment', 'Shopping', 'Subscriptions',
    'Travel', 'Miscellaneous', 'Savings'
  ]) with ordinality as defaults(label, position);

  return new_household;
end
$$;

create function public.invite_household_member(target_household uuid, invite_email text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare invitation uuid;
declare recipient text := lower(btrim(invite_email));
begin
  if not private.is_member(target_household) or private.verified_email() is null then
    raise exception 'Household access denied.' using errcode = '42501';
  end if;
  perform 1 from public.households where id = target_household for update;
  if exists (select from public.household_members where household_id = target_household and slot = 2) then
    raise exception 'This household already has two members.';
  end if;
  if recipient is null or char_length(recipient) > 254
     or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or recipient = private.verified_email() then
    raise exception 'Enter a different, valid email address.';
  end if;

  delete from public.household_invitations
  where household_id = target_household and email <> recipient and accepted_at is null;

  insert into public.household_invitations (household_id, email)
  values (target_household, recipient)
  on conflict (household_id, email) do update
    set expires_at = now() + interval '7 days', accepted_at = null
  returning id into invitation;
  return invitation;
end
$$;

create function public.accept_household_invitation(invitation_id uuid, member_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare target_household uuid;
declare recipient text := private.verified_email();
declare invitation public.household_invitations%rowtype;
begin
  if recipient is null then
    raise exception 'Verify your email first.' using errcode = '42501';
  end if;
  select household_id into target_household from public.household_invitations
  where id = invitation_id and email = recipient;
  if not found then
    raise exception 'Invitation unavailable.' using errcode = '42501';
  end if;

  -- Use the same lock order as invitation creation and recheck after waiting.
  perform 1 from public.households where id = target_household for update;
  select * into invitation from public.household_invitations
  where id = invitation_id and email = recipient for update;
  if not found then
    raise exception 'Invitation unavailable.' using errcode = '42501';
  end if;
  if invitation.accepted_at is not null and private.is_member(target_household) then
    return target_household;
  end if;
  if invitation.accepted_at is not null or invitation.expires_at <= clock_timestamp() then
    raise exception 'Invitation expired or already used.';
  end if;
  if exists (select from public.household_members where user_id = auth.uid()) then
    raise exception 'You already belong to a household.';
  end if;
  if exists (select from public.household_members where household_id = target_household and slot = 2) then
    raise exception 'This household already has two members.';
  end if;

  insert into public.household_members (household_id, user_id, slot, display_name)
  values (target_household, auth.uid(), 2, btrim(member_name));
  update public.household_invitations set accepted_at = now() where id = invitation_id;
  return target_household;
end
$$;

revoke all on function public.create_household(text, text),
  public.invite_household_member(uuid, text),
  public.accept_household_invitation(uuid, text) from public, anon, authenticated;
grant execute on function public.create_household(text, text),
  public.invite_household_member(uuid, text),
  public.accept_household_invitation(uuid, text) to authenticated;

alter publication supabase_realtime add table public.household_members, public.household_invitations;
