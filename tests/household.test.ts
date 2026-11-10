import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const users = {
  owner: '00000000-0000-4000-8000-000000000001',
  invitee: '00000000-0000-4000-8000-000000000002',
  stranger: '00000000-0000-4000-8000-000000000003',
  unverified: '00000000-0000-4000-8000-000000000004',
};
const db = new PGlite();
const tables = ['households', 'household_members', 'household_invitations', 'categories',
  'monthly_allocations', 'expenses', 'transfers'];

beforeAll(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema auth to anon, authenticated;
    create publication supabase_realtime;
  `);
  const migration = new URL('../supabase/migrations/20261110000100_household_foundation.sql', import.meta.url);
  await db.exec(await readFile(migration, 'utf8'));
  for (const [name, id] of Object.entries(users)) {
    await db.query('insert into auth.users values ($1, $2, $3)', [
      id, name + '@example.com', name === 'unverified' ? null : new Date().toISOString(),
    ]);
  }
}, 30_000);

beforeEach(async () => { await db.exec('truncate public.households cascade'); });
afterAll(async () => { await db.close(); });

function run<T>(user: keyof typeof users | 'anon', sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.exec(user === 'anon' ? 'set local role anon' : 'set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user === 'anon' ? '' : users[user]]);
    return (await tx.query<T>(sql, params)).rows;
  });
}

async function create() {
  const [row] = await run<{ id: string }>('owner', 'select create_household($1, $2) as id', ['Home', 'Owner']);
  return row.id;
}

async function invite(household: string, address = 'invitee@example.com') {
  const [row] = await run<{ id: string }>('owner', 'select invite_household_member($1, $2) as id', [household, address]);
  return row.id;
}

const accept = (user: keyof typeof users, id: string) =>
  run(user, 'select accept_household_invitation($1, $2) as id', [id, 'Partner']);

describe('household creation and acceptance', () => {
  it('creates one household, assigns the first member, and seeds 14 categories with one reserve', async () => {
    const home = await create();
    expect(await run('owner', 'select id, currency from households')).toEqual([{ id: home, currency: 'EUR' }]);
    expect(await run('owner', 'select user_id, slot from household_members')).toEqual([{ user_id: users.owner, slot: 1 }]);
    expect(await run('owner', 'select position from categories')).toHaveLength(14);
    expect(await run('owner', 'select name from categories where is_reserve')).toEqual([{ name: 'Savings' }]);
    await expect(create()).rejects.toThrow('already belong');
    await expect(run('unverified', "select create_household('Home', 'New')")).rejects.toThrow('Verify your email');
    await expect(run('anon', "select create_household('Home', 'New')")).rejects.toThrow('permission denied');
  });

  it('matches verified email, normalizes input, and allows a safe replay', async () => {
    const home = await create();
    const id = await invite(home, ' INVITEE@EXAMPLE.COM ');
    expect(await run('stranger', 'select id from household_invitations')).toEqual([]);
    expect(await run('invitee', 'select id from household_invitations')).toEqual([{ id }]);
    expect(await run('invitee', 'select id from households')).toEqual([]);
    await expect(accept('stranger', id)).rejects.toThrow('Invitation unavailable');
    expect(await accept('invitee', id)).toEqual([{ id: home }]);
    expect(await accept('invitee', id)).toEqual([{ id: home }]);
    expect(await run('invitee', 'select slot from household_members order by slot')).toEqual([{ slot: 1 }, { slot: 2 }]);
    await expect(invite(home, 'stranger@example.com')).rejects.toThrow('already has two members');
    await expect(db.query('insert into household_members values ($1, $2, 3, $3)', [home, users.stranger, 'Third']))
      .rejects.toThrow('check constraint');
  });

  it('rejects replaced, expired, and unverified invitations', async () => {
    const home = await create();
    const id = await invite(home);
    const replacement = await invite(home, 'unverified@example.com');
    await expect(accept('invitee', id)).rejects.toThrow('Invitation unavailable');
    expect(await run('unverified', 'select id from household_invitations')).toEqual([]);
    await expect(accept('unverified', replacement)).rejects.toThrow('Verify your email');
    const next = await invite(home);
    await db.query("update household_invitations set expires_at = now() - interval '1 hour' where id = $1", [next]);
    expect(await run('invitee', 'select id from household_invitations')).toEqual([]);
    await expect(accept('invitee', next)).rejects.toThrow('expired');
  });
});

describe('row-level security', () => {
  it('isolates every table and rejects unauthorized mutations and RPCs', async () => {
    const home = await create();
    await invite(home);
    await db.exec(`
      insert into monthly_allocations select household_id, id, date '2026-11-01', 12000 from categories where position = 1;
      insert into expenses (household_id, category_id, spent_on, amount_cents)
        select household_id, id, date '2026-11-02', 1000 from categories where position = 1;
      insert into transfers (household_id, from_category_id, to_category_id, transferred_on, amount_cents)
        select a.household_id, a.id, b.id, date '2026-11-03', 30000
        from categories a join categories b using (household_id) where a.position = 1 and b.position = 2;
    `);
    for (const table of tables) {
      expect(await run('owner', 'select * from ' + table)).not.toHaveLength(0);
      expect(await run('stranger', 'select * from ' + table)).toEqual([]);
      await expect(run('anon', 'select * from ' + table)).rejects.toThrow('permission denied');
      await expect(run('owner', 'delete from ' + table)).rejects.toThrow('permission denied');
    }
    await expect(run('stranger', 'select invite_household_member($1, $2)', [home, 'invitee@example.com']))
      .rejects.toThrow('access denied');
  });

  it('isolates active members of different households and blocks cross-household category references', async () => {
    const first = await create();
    const [second] = await run<{ id: string }>('stranger', "select create_household('Other', 'Other') as id");
    const invitation = await invite(first);
    await expect(accept('stranger', invitation)).rejects.toThrow('Invitation unavailable');
    await expect(run('stranger', 'select id from households')).resolves.toEqual([{ id: second.id }]);
    await expect(run('stranger', 'select id from categories where household_id = $1', [first])).resolves.toEqual([]);

    const categories = await db.query<{ id: string; household_id: string }>(
      'select id, household_id from categories where position = 1',
    );
    const local = categories.rows.find((category) => category.household_id === first)!.id;
    const foreign = categories.rows.find((category) => category.household_id === second.id)!.id;
    await expect(db.query(
      "insert into monthly_allocations values ($1, $2, '2026-11-01', 100)", [first, foreign],
    )).rejects.toThrow('foreign key constraint');
    await expect(db.query(
      "insert into expenses (household_id, category_id, spent_on, amount_cents) values ($1, $2, '2026-11-02', 100)",
      [first, foreign],
    )).rejects.toThrow('foreign key constraint');

    const transfer = "insert into transfers (household_id, from_category_id, to_category_id, transferred_on, amount_cents) " +
      "values ($1, $2, $3, '2026-11-03', 100)";
    await expect(db.query(transfer, [first, local, foreign])).rejects.toThrow('foreign key constraint');
    await expect(db.query(transfer, [first, foreign, local])).rejects.toThrow('foreign key constraint');
  });

  it('leaves monthly amounts for the household to enter', async () => {
    await create();
    expect(await run('owner', 'select amount_cents from monthly_allocations')).toEqual([]);
  });
});
