import { readFileSync } from 'node:fs';
import pg from 'pg';

const URL = process.env.TEST_DATABASE_URL;
export const hasDatabase = Boolean(URL);

/**
 * Supabase provides `auth.users` and `auth.uid()`. Plain Postgres does not,
 * so the tests stand them up the same way Supabase does — `auth.uid()` reads
 * the request's JWT subject claim. The migration itself stays
 * Supabase-targeted and never creates these.
 */
const AUTH_SHIM = `
drop schema if exists auth cascade;
create schema auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;
drop table if exists public.entries, public.sheets, public.campaigns cascade;
`;

export async function freshDatabase() {
  const client = new pg.Client({ connectionString: URL });
  await client.connect();
  await client.query(AUTH_SHIM);
  await client.query(readFileSync('supabase/migrations/0001_init.sql', 'utf8'));
  return client;
}

/** Run a statement as a given user (or anonymously when userId is null). */
export async function asUser<T>(
  client: pg.Client,
  userId: string | null,
  sql: string,
  params: unknown[] = []
): Promise<pg.QueryResult<T extends object ? T : never>> {
  await client.query('begin');
  try {
    await client.query(`set local role ${userId ? 'authenticated' : 'anon'}`);
    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? '']);
    const result = await client.query(sql, params);
    await client.query('commit');
    return result as never;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

export async function makeUser(client: pg.Client, id: string) {
  await client.query('insert into auth.users (id) values ($1) on conflict do nothing', [id]);
}
