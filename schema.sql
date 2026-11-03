-- DND Companion — the whole database, for a fresh Supabase project.
--
-- Run once in the SQL editor. Safe to run again: everything is created only
-- if missing, and policies are replaced.
--
-- Authorization lives here, not in the client: the anon key is public, so
-- these policies are the only thing standing between a request and the data.
--
-- `entries` is not used by the app; it is here in case a shared library is
-- ever wanted. Campaigns are set up in the section at the end.

create table if not exists campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists sheets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  campaign_id  uuid references campaigns(id) on delete set null,
  name         text not null,
  retired      boolean not null default false,
  definition   jsonb not null default '{}'::jsonb,
  state        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists entries (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  campaign_id  uuid references campaigns(id) on delete set null,
  visibility   text not null default 'campaign'
               check (visibility in ('personal', 'campaign', 'global')),
  name         text not null,
  category     text not null
               check (category in ('item', 'spell', 'feature', 'condition', 'other')),
  body         text not null default '',
  source       text,
  forked_from  uuid references entries(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists sheets_owner_idx     on sheets (owner_id);
create index if not exists sheets_campaign_idx  on sheets (campaign_id) where campaign_id is not null;
create index if not exists entries_lookup_idx   on entries (visibility, category, name);

-- updated_at maintenance

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sheets_touch on sheets;
create trigger sheets_touch before update on sheets
  for each row execute function touch_updated_at();

drop trigger if exists entries_touch on entries;
create trigger entries_touch before update on entries
  for each row execute function touch_updated_at();

-- Row-level security

alter table campaigns enable row level security;
alter table sheets    enable row level security;
alter table entries   enable row level security;

grant usage on schema public to anon, authenticated;
grant select on campaigns, sheets, entries to anon, authenticated;
grant insert, update, delete on campaigns, sheets, entries to authenticated;

-- sheets: anyone reads, owner writes.
drop policy if exists "sheets read"   on sheets;
drop policy if exists "sheets insert" on sheets;
drop policy if exists "sheets update" on sheets;
drop policy if exists "sheets delete" on sheets;

create policy "sheets read"   on sheets for select using (true);
create policy "sheets insert" on sheets for insert with check (auth.uid() = owner_id);
create policy "sheets update" on sheets for update using (auth.uid() = owner_id);
create policy "sheets delete" on sheets for delete using (auth.uid() = owner_id);

-- campaigns: anyone reads, creator manages.
drop policy if exists "campaigns read"   on campaigns;
drop policy if exists "campaigns insert" on campaigns;
drop policy if exists "campaigns update" on campaigns;
drop policy if exists "campaigns delete" on campaigns;

create policy "campaigns read"   on campaigns for select using (true);
create policy "campaigns insert" on campaigns for insert with check (auth.uid() = created_by);
create policy "campaigns update" on campaigns for update using (auth.uid() = created_by);
create policy "campaigns delete" on campaigns for delete using (auth.uid() = created_by);

-- entries: visibility-scoped read, creator-only write.
-- "campaign" visibility means: anyone who owns a sheet in that campaign.
drop policy if exists "entries read"   on entries;
drop policy if exists "entries insert" on entries;
drop policy if exists "entries update" on entries;
drop policy if exists "entries delete" on entries;

create policy "entries read" on entries for select using (
  visibility = 'global'
  or owner_id = auth.uid()
  or (
    visibility = 'campaign'
    and campaign_id is not null
    and campaign_id in (select s.campaign_id from sheets s where s.owner_id = auth.uid())
  )
);
create policy "entries insert" on entries for insert with check (auth.uid() = owner_id);
create policy "entries update" on entries for update using (auth.uid() = owner_id);
create policy "entries delete" on entries for delete using (auth.uid() = owner_id);

-- Notes and backstory: their own table, because a sheet's row is readable by
-- anyone with its link and a private flag inside it would hide nothing. This
-- table's read policy is the privacy: a row goes to its owner always, and to
-- everyone else only while it is public.

create table if not exists sheet_text (
  sheet_id    uuid not null references sheets(id) on delete cascade,
  field       text not null check (field in ('notes', 'backstory')),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  body        text not null default '',
  is_public   boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (sheet_id, field)
);

create index if not exists sheet_text_owner_idx on sheet_text (owner_id);

drop trigger if exists sheet_text_touch on sheet_text;
create trigger sheet_text_touch before update on sheet_text
  for each row execute function touch_updated_at();

alter table sheet_text enable row level security;

grant select on sheet_text to anon, authenticated;
grant insert, update, delete on sheet_text to authenticated;

drop policy if exists "sheet_text read"   on sheet_text;
drop policy if exists "sheet_text insert" on sheet_text;
drop policy if exists "sheet_text update" on sheet_text;
drop policy if exists "sheet_text delete" on sheet_text;

-- The whole point: public text is anyone's to read, private text only its owner's.
create policy "sheet_text read" on sheet_text for select
  using (is_public or owner_id = auth.uid());

-- Only on a sheet the writer owns, so nobody can attach text to someone else's.
create policy "sheet_text insert" on sheet_text for insert
  with check (
    owner_id = auth.uid()
    and exists (select 1 from sheets s where s.id = sheet_id and s.owner_id = auth.uid())
  );

create policy "sheet_text update" on sheet_text for update
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (select 1 from sheets s where s.id = sheet_id and s.owner_id = auth.uid())
  );

create policy "sheet_text delete" on sheet_text for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Deleting your own account. Only the owner of the database may delete from
-- auth.users, so this runs as that owner (security definer) and deletes only
-- the caller. Everything a player owns references auth.users with
-- "on delete cascade" and goes with them.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Campaigns: invite links, joining, and the DM's tools. A campaign's page is
-- readable by anyone with its link, like a sheet; joining needs its invite
-- code, which only the DM can read. See database/0004_campaigns.sql.

-- The invite code: ten hex characters, made up for every campaign.
alter table campaigns add column if not exists invite_code text;
update campaigns
  set invite_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
  where invite_code is null;
alter table campaigns
  alter column invite_code set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
alter table campaigns alter column invite_code set not null;
create unique index if not exists campaigns_invite_idx on campaigns (invite_code);

-- An ended campaign is archived: still readable, but its invite opens nothing.
alter table campaigns add column if not exists archived boolean not null default false;

-- Everything but the code is readable; only a name can be written directly.
revoke select, insert, update on campaigns from anon, authenticated;
grant select (id, name, created_by, created_at, archived) on campaigns to anon, authenticated;
grant insert (name, created_by) on campaigns to authenticated;
grant update (name, archived) on campaigns to authenticated;
grant delete on campaigns to authenticated;

-- A sheet's campaign is set only by the functions below (they switch this
-- guard off for their own update). Setting it to nothing, to leave, is free.
create or replace function public.guard_sheet_campaign()
returns trigger
language plpgsql
as $$
begin
  if new.campaign_id is not null
     and (tg_op = 'INSERT' or new.campaign_id is distinct from old.campaign_id)
     and coalesce(current_setting('dnd.campaign_join', true), '') <> 'on' then
    raise exception 'A sheet joins a campaign through its invite link';
  end if;
  return new;
end;
$$;

drop trigger if exists sheets_campaign_guard on sheets;
create trigger sheets_campaign_guard
  before insert or update of campaign_id on sheets
  for each row execute function public.guard_sheet_campaign();

-- Make a campaign, run by the caller, and optionally put one of their sheets in it.
create or replace function public.create_campaign(p_name text, p_sheet uuid default null)
returns table (id uuid, invite_code text, sheet_updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  c campaigns%rowtype;
  stamp timestamptz;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'A campaign needs a name'; end if;
  insert into campaigns (name, created_by) values (trim(p_name), uid) returning * into c;
  if p_sheet is not null then
    perform set_config('dnd.campaign_join', 'on', true);
    update sheets set campaign_id = c.id
      where sheets.id = p_sheet and owner_id = uid
      returning updated_at into stamp;
    perform set_config('dnd.campaign_join', '', true);
  end if;
  return query select c.id, c.invite_code, stamp;
end;
$$;

-- What an invite is for, so the join page can name the campaign first.
create or replace function public.campaign_by_invite(p_code text)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name from campaigns c
  where c.invite_code = lower(trim(p_code)) and not c.archived;
$$;

-- Put one of the caller's sheets in the campaign the invite is for.
create or replace function public.join_campaign(p_code text, p_sheet uuid)
returns table (campaign_id uuid, sheet_updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  cid uuid;
  ended boolean;
  stamp timestamptz;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select c.id, c.archived into cid, ended from campaigns c where c.invite_code = lower(trim(p_code));
  if cid is null then raise exception 'No campaign has that invite'; end if;
  if ended then raise exception 'That campaign has ended'; end if;
  perform set_config('dnd.campaign_join', 'on', true);
  update sheets set campaign_id = cid
    where sheets.id = p_sheet and owner_id = uid
    returning updated_at into stamp;
  perform set_config('dnd.campaign_join', '', true);
  if stamp is null then raise exception 'That sheet is not yours'; end if;
  return query select cid, stamp;
end;
$$;

-- The DM's view of their own invite, and a fresh one if it has spread too far.
create or replace function public.campaign_invite(p_campaign uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.invite_code from campaigns c where c.id = p_campaign and c.created_by = auth.uid();
$$;

create or replace function public.reset_campaign_invite(p_campaign uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
begin
  update campaigns
    set invite_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
    where id = p_campaign and created_by = auth.uid()
    returning invite_code into code;
  if code is null then raise exception 'Only the DM can change the invite'; end if;
  return code;
end;
$$;

-- The DM takes a sheet out of their campaign. (Its owner can simply leave.)
create or replace function public.remove_from_campaign(p_sheet uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update sheets set campaign_id = null
    where id = p_sheet
      and campaign_id in (select c.id from campaigns c where c.created_by = auth.uid());
  if not found then raise exception 'Only the DM can remove a sheet'; end if;
end;
$$;

revoke all on function public.create_campaign(text, uuid) from public, anon;
revoke all on function public.join_campaign(text, uuid) from public, anon;
revoke all on function public.campaign_invite(uuid) from public, anon;
revoke all on function public.reset_campaign_invite(uuid) from public, anon;
revoke all on function public.remove_from_campaign(uuid) from public, anon;
revoke all on function public.campaign_by_invite(text) from public;
grant execute on function public.create_campaign(text, uuid) to authenticated;
grant execute on function public.join_campaign(text, uuid) to authenticated;
grant execute on function public.campaign_invite(uuid) to authenticated;
grant execute on function public.reset_campaign_invite(uuid) to authenticated;
grant execute on function public.remove_from_campaign(uuid) to authenticated;
grant execute on function public.campaign_by_invite(text) to anon, authenticated;
