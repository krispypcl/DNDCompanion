-- DND Companion: the whole database, for a fresh Supabase project.
--
-- Run once in the SQL editor (Supabase Studio, or psql against a local or
-- self-hosted Supabase). Safe to run again: everything is created only if
-- missing, and functions and policies are replaced.
--
-- Authorization lives here, not in the client: the anon key is public, so
-- these policies are the only thing standing between a request and the data.
--
-- The tables:
--
--   profiles          one row per player: name, picture, preferences,
--                     privacy, pinned lists
--   characters        characters, one sheet each (what is written on it, and
--                     how it stands in play)
--   character_pages   a character's notes and backstory, public or private
--   campaigns         a DM's campaign; characters join it by invite
--   campaign_state    what is happening in a campaign now (music, invite,
--                     initiative)
--   board_items       the campaign's table board
--   campaign_creatures monsters and NPCs the DM keeps on the campaign page
--   homebrew_creatures a DM's own monsters and NPCs, kept to add to any campaign
--   shared_rows       rows players wrote, offered to others as they type
--   shared_row_uses   which characters use which shared rows
--
-- Functions the app calls live in the `private` schema (not served by the
-- API) with a thin public face running as the caller. An existing database
-- from before 16 Nov 2026 is brought up to this by database/0015 to 0020.

create extension if not exists pgcrypto;

create schema if not exists private;
grant usage on schema public to anon, authenticated;
grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tables.

create table if not exists public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  invite_code  text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  archived     boolean not null default false,
  details      jsonb not null default '{}'::jsonb
               constraint campaigns_details_size check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 64000)
);
create index if not exists campaigns_created_by_idx on public.campaigns (created_by);

create table if not exists public.characters (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  campaign_id  uuid references public.campaigns(id) on delete set null,
  name         text not null,
  retired      boolean not null default false,
  definition   jsonb not null default '{}'::jsonb,
  state        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists characters_owner_idx on public.characters (owner_id);
create index if not exists characters_campaign_idx on public.characters (campaign_id) where campaign_id is not null;

create table if not exists public.character_pages (
  character_id uuid not null references public.characters(id) on delete cascade,
  field        text not null check (field in ('notes', 'backstory')),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  body         text not null default '',
  is_public    boolean not null default true,
  updated_at   timestamptz not null default now(),
  primary key (character_id, field)
);
create index if not exists character_pages_owner_idx on public.character_pages (owner_id);

create table if not exists public.campaign_state (
  campaign_id  uuid primary key references public.campaigns(id) on delete cascade,
  playback     jsonb not null default '{}'::jsonb
               constraint campaign_state_playback_size check (jsonb_typeof(playback) = 'object' and octet_length(playback::text) <= 4000),
  invite_rev   integer not null default 0,
  initiative   jsonb not null default '{}'::jsonb
               constraint campaign_state_initiative_size check (jsonb_typeof(initiative) = 'object' and octet_length(initiative::text) <= 8000),
  updated_at   timestamptz not null default now()
);

create table if not exists public.board_items (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  kind         text not null constraint board_items_kind_check check (kind in ('note', 'text', 'stroke', 'page')),
  data         jsonb not null default '{}'::jsonb
               constraint board_items_data_size check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 24000),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists board_items_campaign_idx on public.board_items (campaign_id);
create index if not exists board_items_created_by_idx on public.board_items (created_by);
-- Deletes announce the whole row, so open boards know which item went.
alter table public.board_items replica identity full;

create table if not exists public.campaign_creatures (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  kind         text not null default 'monster'
               constraint campaign_creatures_kind_check check (kind in ('monster', 'npc')),
  name         text not null constraint campaign_creatures_name_check check (char_length(name) between 1 and 80),
  hp_max       integer constraint campaign_creatures_hp_max_check check (hp_max is null or hp_max between 0 and 100000),
  hp_current   integer constraint campaign_creatures_hp_current_check check (hp_current is null or hp_current between -100000 and 100000),
  hp_temp      integer not null default 0 constraint campaign_creatures_hp_temp_check check (hp_temp between 0 and 100000),
  ac           integer constraint campaign_creatures_ac_check check (ac is null or ac between 0 and 100),
  conditions   text[] not null default '{}'
               constraint campaign_creatures_conditions_check check (cardinality(conditions) <= 40),
  notes        text not null default '' constraint campaign_creatures_notes_check check (char_length(notes) <= 4000),
  link         text not null default '' constraint campaign_creatures_link_check check (char_length(link) <= 500),
  position     integer not null default 0,
  initiative   integer constraint campaign_creatures_initiative_check check (initiative is null or initiative between -50 and 100),
  visible      boolean not null default false,
  statblock    jsonb not null default '{}'::jsonb
               constraint campaign_creatures_statblock_size check (jsonb_typeof(statblock) = 'object' and octet_length(statblock::text) <= 60000),
  portrait     text not null default '' constraint campaign_creatures_portrait_check check (char_length(portrait) <= 2000),
  condition_looks jsonb not null default '{}'::jsonb
               constraint campaign_creatures_condition_looks_size check (jsonb_typeof(condition_looks) = 'object' and octet_length(condition_looks::text) <= 4000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists campaign_creatures_campaign_idx on public.campaign_creatures (campaign_id);

create table if not exists public.homebrew_creatures (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind         text not null default 'monster'
               constraint homebrew_creatures_kind_check check (kind in ('monster', 'npc')),
  name         text not null constraint homebrew_creatures_name_check check (char_length(name) between 1 and 80),
  statblock    jsonb not null default '{}'::jsonb
               constraint homebrew_creatures_statblock_size check (jsonb_typeof(statblock) = 'object' and octet_length(statblock::text) <= 60000),
  portrait     text not null default '' constraint homebrew_creatures_portrait_check check (char_length(portrait) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists homebrew_creatures_owner_idx on public.homebrew_creatures (owner_id);

create table if not exists public.shared_rows (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('attacks', 'spells', 'items', 'features', 'trackers')),
  name         text not null check (char_length(name) between 1 and 120),
  name_key     text not null,
  data         jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 8192),
  fingerprint  text not null,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (kind, fingerprint)
);
create index if not exists shared_rows_name_idx on public.shared_rows (kind, name_key text_pattern_ops);
create index if not exists shared_rows_created_by_idx on public.shared_rows (created_by);

create table if not exists public.shared_row_uses (
  shared_row_id uuid not null references public.shared_rows(id) on delete cascade,
  character_id  uuid not null references public.characters(id) on delete cascade,
  owner_id      uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (shared_row_id, character_id)
);
create index if not exists shared_row_uses_character_idx on public.shared_row_uses (character_id);
create index if not exists shared_row_uses_owner_idx on public.shared_row_uses (owner_id);

create table if not exists public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  display_name            text not null default '' check (char_length(display_name) <= 60),
  picture_url             text check (picture_url is null or char_length(picture_url) <= 2048),
  share_rows              boolean not null default true,
  private_sheets          boolean not null default false,
  preferences             jsonb not null default '{}'::jsonb
                          check (jsonb_typeof(preferences) = 'object' and octet_length(preferences::text) <= 4000),
  pinned_characters       uuid[] not null default '{}',
  pinned_campaigns        uuid[] not null default '{}',
  pinned_joined_campaigns uuid[] not null default '{}',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- A new player gets their row as they sign up (with the name Google or
-- Discord gave them, if any).
create or replace function private.create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name',
                                      new.raw_user_meta_data ->> 'full_name',
                                      new.raw_user_meta_data ->> 'name', '')), 60))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_profile() from public, anon, authenticated;
drop trigger if exists create_profile on auth.users;
create trigger create_profile after insert on auth.users
  for each row execute function private.create_profile();

-- ---------------------------------------------------------------------------
-- Trigger functions, moved out of the API's reach and renamed.

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;

drop trigger if exists characters_touch on public.characters;
create trigger characters_touch before update on public.characters
  for each row execute function private.touch_updated_at();
drop trigger if exists character_pages_touch on public.character_pages;
create trigger character_pages_touch before update on public.character_pages
  for each row execute function private.touch_updated_at();
drop trigger if exists campaign_state_touch on public.campaign_state;
create trigger campaign_state_touch before update on public.campaign_state
  for each row execute function private.touch_updated_at();
drop trigger if exists board_items_touch on public.board_items;
create trigger board_items_touch before update on public.board_items
  for each row execute function private.touch_updated_at();
drop trigger if exists campaign_creatures_touch on public.campaign_creatures;
create trigger campaign_creatures_touch before update on public.campaign_creatures
  for each row execute function private.touch_updated_at();
drop trigger if exists homebrew_creatures_touch on public.homebrew_creatures;
create trigger homebrew_creatures_touch before update on public.homebrew_creatures
  for each row execute function private.touch_updated_at();
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- A character joins a campaign only through an invite (the functions below
-- switch this guard off for their own update). Leaving is free.
create or replace function private.guard_character_campaign()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.campaign_id is not null
     and (tg_op = 'INSERT' or new.campaign_id is distinct from old.campaign_id)
     and coalesce(current_setting('dnd.campaign_join', true), '') <> 'on' then
    raise exception 'A character joins a campaign through its invite link';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_character_campaign() from public, anon, authenticated;
drop trigger if exists characters_campaign_guard on public.characters;
create trigger characters_campaign_guard
  before insert or update of campaign_id on public.characters
  for each row execute function private.guard_character_campaign();

-- A board, not a warehouse.
create or replace function private.cap_board_items()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.board_items b where b.campaign_id = new.campaign_id) >= 4000 then
    raise exception 'The board is full';
  end if;
  return new;
end;
$$;
revoke all on function private.cap_board_items() from public, anon, authenticated;
drop trigger if exists board_items_cap on public.board_items;
create trigger board_items_cap before insert on public.board_items
  for each row execute function private.cap_board_items();

-- A table of foes, not a bestiary.
create or replace function private.cap_campaign_creatures()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.campaign_creatures c where c.campaign_id = new.campaign_id) >= 300 then
    raise exception 'That is a whole army already';
  end if;
  return new;
end;
$$;
revoke all on function private.cap_campaign_creatures() from public, anon, authenticated;
drop trigger if exists campaign_creatures_cap on public.campaign_creatures;
create trigger campaign_creatures_cap before insert on public.campaign_creatures
  for each row execute function private.cap_campaign_creatures();

create or replace function private.cap_homebrew_creatures()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.homebrew_creatures h where h.owner_id = new.owner_id) >= 500 then
    raise exception 'Your bestiary is full';
  end if;
  return new;
end;
$$;
revoke all on function private.cap_homebrew_creatures() from public, anon, authenticated;
drop trigger if exists homebrew_creatures_cap on public.homebrew_creatures;
create trigger homebrew_creatures_cap before insert on public.homebrew_creatures
  for each row execute function private.cap_homebrew_creatures();

-- Every campaign has its live state, made with it.
create or replace function private.create_campaign_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.campaign_state (campaign_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.create_campaign_state() from public, anon, authenticated;
drop trigger if exists campaigns_create_state on public.campaigns;
create trigger campaigns_create_state after insert on public.campaigns
  for each row execute function private.create_campaign_state();

-- Shared rows no character uses any longer go.
create or replace function private.tidy_shared_rows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.shared_rows r
  where r.id in (select shared_row_id from gone)
    and not exists (select 1 from public.shared_row_uses u where u.shared_row_id = r.id);
  return null;
end;
$$;
revoke all on function private.tidy_shared_rows() from public, anon, authenticated;
drop trigger if exists shared_row_uses_tidy on public.shared_row_uses;
create trigger shared_row_uses_tidy after delete on public.shared_row_uses
  referencing old table as gone
  for each statement execute function private.tidy_shared_rows();

-- ---------------------------------------------------------------------------
-- Helpers the policies and functions use.

-- Is the caller in this campaign, as its DM or with a character in it?
create or replace function private.is_campaign_member(p_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.campaigns c where c.id = p_campaign and c.created_by = (select auth.uid()))
      or exists (select 1 from public.characters ch where ch.campaign_id = p_campaign and ch.owner_id = (select auth.uid()));
$$;
revoke all on function private.is_campaign_member(uuid) from public;
grant execute on function private.is_campaign_member(uuid) to anon, authenticated;

-- Has the player made their sheets private (account page)?
create or replace function private.has_private_sheets(p_player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.private_sheets from public.profiles p where p.id = p_player), false);
$$;
revoke all on function private.has_private_sheets(uuid) from public;
grant execute on function private.has_private_sheets(uuid) to anon, authenticated;

-- Do two players share a campaign (as its DM, or with a character in it)?
create or replace function private.in_same_campaign(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select c.id from public.campaigns c where c.created_by = a
    union select ch.campaign_id from public.characters ch where ch.owner_id = a and ch.campaign_id is not null
  ), theirs as (
    select c.id from public.campaigns c where c.created_by = b
    union select ch.campaign_id from public.characters ch where ch.owner_id = b and ch.campaign_id is not null
  )
  select exists (select 1 from mine join theirs using (id));
$$;
revoke all on function private.in_same_campaign(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security, with plain policy names.

alter table public.characters enable row level security;
alter table public.character_pages enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_state enable row level security;
alter table public.board_items enable row level security;
alter table public.campaign_creatures enable row level security;
alter table public.homebrew_creatures enable row level security;
alter table public.shared_rows enable row level security;
alter table public.shared_row_uses enable row level security;
alter table public.profiles enable row level security;

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('characters', 'character_pages', 'campaigns', 'campaign_state', 'board_items', 'campaign_creatures', 'homebrew_creatures', 'profiles')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;

-- characters: read by anyone with the link (unless its player keeps their
-- sheets private: then only by them and their campaign's DM); written by
-- its player.
create policy "Anyone reads, unless the player keeps them private" on public.characters for select
  using (
    owner_id = (select auth.uid())
    or not private.has_private_sheets(owner_id)
    or exists (select 1 from public.campaigns c where c.id = characters.campaign_id and c.created_by = (select auth.uid()))
  );
create policy "The player adds their own" on public.characters for insert with check ((select auth.uid()) = owner_id);
create policy "The player changes their own" on public.characters for update using ((select auth.uid()) = owner_id);
create policy "The player deletes their own" on public.characters for delete using ((select auth.uid()) = owner_id);

-- character_pages: public pages follow the character's privacy; private
-- pages only for the player and their DM.
create policy "Public pages for anyone, private ones for the player and DM" on public.character_pages for select
  using (
    owner_id = (select auth.uid())
    or (is_public and not private.has_private_sheets(owner_id))
    or exists (
      select 1 from public.characters ch join public.campaigns c on c.id = ch.campaign_id
      where ch.id = character_pages.character_id and c.created_by = (select auth.uid())
    )
  );
create policy "The player writes pages on their own characters" on public.character_pages for insert
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.characters ch where ch.id = character_id and ch.owner_id = (select auth.uid()))
  );
create policy "The player changes their own pages" on public.character_pages for update
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.characters ch where ch.id = character_id and ch.owner_id = (select auth.uid()))
  );
create policy "The player deletes their own pages" on public.character_pages for delete using (owner_id = (select auth.uid()));

-- campaigns: read by anyone with the link; managed by its DM.
create policy "Anyone reads" on public.campaigns for select using (true);
create policy "The DM starts it" on public.campaigns for insert with check ((select auth.uid()) = created_by);
create policy "The DM changes it" on public.campaigns for update using ((select auth.uid()) = created_by);
create policy "The DM deletes it" on public.campaigns for delete using ((select auth.uid()) = created_by);

-- campaign_state: read by anyone; the music and the initiative order changed by
-- the DM (a player's own number goes through set_my_initiative, and a tie
-- among characters through set_initiative_ties).
create policy "Anyone reads" on public.campaign_state for select using (true);
create policy "The DM changes the music" on public.campaign_state for update
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.created_by = (select auth.uid())));

-- board_items: read by anyone; drawn on by the campaign's members.
create policy "Anyone reads" on public.board_items for select using (true);
create policy "Members add" on public.board_items for insert
  with check (created_by = (select auth.uid()) and private.is_campaign_member(campaign_id));
create policy "Members change" on public.board_items for update using (private.is_campaign_member(campaign_id));
create policy "Members remove" on public.board_items for delete using (private.is_campaign_member(campaign_id));

-- campaign_creatures: only the campaign's DM, for everything.
create policy "The DM reads them" on public.campaign_creatures for select
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.created_by = (select auth.uid())));
create policy "The DM adds them" on public.campaign_creatures for insert
  with check (exists (select 1 from public.campaigns c where c.id = campaign_id and c.created_by = (select auth.uid())));
create policy "The DM changes them" on public.campaign_creatures for update
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.created_by = (select auth.uid())))
  with check (exists (select 1 from public.campaigns c where c.id = campaign_id and c.created_by = (select auth.uid())));
create policy "The DM removes them" on public.campaign_creatures for delete
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.created_by = (select auth.uid())));

-- homebrew_creatures: each DM's own, for them alone.
create policy "The DM reads their own" on public.homebrew_creatures for select using (owner_id = (select auth.uid()));
create policy "The DM adds their own" on public.homebrew_creatures for insert with check (owner_id = (select auth.uid()));
create policy "The DM changes their own" on public.homebrew_creatures for update
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "The DM removes their own" on public.homebrew_creatures for delete using (owner_id = (select auth.uid()));

-- profiles: each player reads and changes only their own.
create policy "The player reads their own" on public.profiles for select using (id = (select auth.uid()));
create policy "The player adds their own" on public.profiles for insert with check (id = (select auth.uid()));
create policy "The player changes their own" on public.profiles for update using (id = (select auth.uid()));

-- shared_rows and shared_row_uses have no policies: only the functions below
-- read and write them.

grant select on public.characters, public.character_pages, public.campaign_state, public.board_items to anon, authenticated;
grant insert, update, delete on public.characters, public.character_pages to authenticated;
revoke all on public.profiles from anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant update (display_name, picture_url, share_rows, private_sheets, preferences,
              pinned_characters, pinned_campaigns, pinned_joined_campaigns) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- The app's functions: the work in `private`, a thin public face running as
-- the caller (Supabase's advice: no security-definer functions in the API).

create or replace function private.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = uid;
end;
$$;

-- Start a campaign, run by the caller, optionally with one of their characters in it.
create or replace function private.create_campaign(p_name text, p_character uuid default null)
returns table (id uuid, invite_code text, character_updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  c public.campaigns%rowtype;
  stamp timestamptz;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'A campaign needs a name'; end if;
  insert into public.campaigns (name, created_by) values (btrim(p_name), uid) returning * into c;
  if p_character is not null then
    perform set_config('dnd.campaign_join', 'on', true);
    update public.characters set campaign_id = c.id
      where public.characters.id = p_character and owner_id = uid
      returning updated_at into stamp;
    perform set_config('dnd.campaign_join', '', true);
  end if;
  return query select c.id, c.invite_code, stamp;
end;
$$;

-- Which campaign an invite is for, so the join page can name it first.
create or replace function private.campaign_by_invite(p_code text)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name from public.campaigns c
  where c.invite_code = lower(btrim(p_code)) and not c.archived;
$$;

-- Put one of the caller's characters in the campaign the invite is for.
create or replace function private.join_campaign(p_code text, p_character uuid)
returns table (campaign_id uuid, character_updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  cid uuid;
  ended boolean;
  stamp timestamptz;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select c.id, c.archived into cid, ended from public.campaigns c where c.invite_code = lower(btrim(p_code));
  if cid is null then raise exception 'No campaign has that invite'; end if;
  if ended then raise exception 'That campaign has ended'; end if;
  perform set_config('dnd.campaign_join', 'on', true);
  update public.characters set campaign_id = cid
    where public.characters.id = p_character and owner_id = uid
    returning updated_at into stamp;
  perform set_config('dnd.campaign_join', '', true);
  if stamp is null then raise exception 'That character is not yours'; end if;
  return query select cid, stamp;
end;
$$;

-- The invite, for anyone in the campaign.
create or replace function private.campaign_invite(p_campaign uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.invite_code from public.campaigns c
  where c.id = p_campaign and private.is_campaign_member(p_campaign);
$$;

-- A fresh invite from the DM; open pages hear the counter tick.
create or replace function private.reset_campaign_invite(p_campaign uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text;
begin
  update public.campaigns
    set invite_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
    where id = p_campaign and created_by = (select auth.uid())
    returning invite_code into code;
  if code is null then raise exception 'Only the DM can change the invite'; end if;
  insert into public.campaign_state (campaign_id, invite_rev) values (p_campaign, 1)
    on conflict (campaign_id) do update set invite_rev = public.campaign_state.invite_rev + 1;
  return code;
end;
$$;

-- The DM takes a character out of their campaign (its player can simply leave).
create or replace function private.remove_from_campaign(p_character uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.characters set campaign_id = null
    where id = p_character
      and campaign_id in (select c.id from public.campaigns c where c.created_by = (select auth.uid()));
  if not found then raise exception 'Only the DM can remove a character'; end if;
end;
$$;

-- The DM sets a character's conditions: only that list, only in their campaign.
create or replace function private.set_character_conditions(p_character uuid, p_conditions text[])
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  stamp timestamptz;
  list text[] := coalesce(p_conditions, '{}'::text[]);
begin
  if (select auth.uid()) is null then raise exception 'Not signed in'; end if;
  if coalesce(array_length(list, 1), 0) > 40
     or exists (select 1 from unnest(list) n where length(n) > 60 or length(btrim(n)) = 0) then
    raise exception 'Too many conditions';
  end if;
  update public.characters ch
    set state = jsonb_set(coalesce(ch.state, '{}'::jsonb), '{conditions}', to_jsonb(list))
    where ch.id = p_character
      and exists (select 1 from public.campaigns c where c.id = ch.campaign_id and c.created_by = (select auth.uid()))
    returning ch.updated_at into stamp;
  if stamp is null then raise exception 'Only the DM can do that'; end if;
  return stamp;
end;
$$;

-- Hit points from the Owlbear Rodeo map: the player or the DM.
create or replace function private.set_character_hp(
  p_character uuid,
  p_current integer,
  p_temp integer,
  p_conditions text[] default null,
  p_death_saves jsonb default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  stamp timestamptz;
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_current is null or p_current < 0 or p_current > 100000
     or coalesce(p_temp, 0) < 0 or coalesce(p_temp, 0) > 100000 then
    raise exception 'Hit points out of range';
  end if;
  if p_conditions is not null and (
       coalesce(array_length(p_conditions, 1), 0) > 40
       or exists (select 1 from unnest(p_conditions) n where length(n) > 60 or length(btrim(n)) = 0)) then
    raise exception 'Too many conditions';
  end if;
  if p_death_saves is not null and (
       jsonb_typeof(p_death_saves) <> 'object' or octet_length(p_death_saves::text) > 200) then
    raise exception 'Bad death saves';
  end if;
  update public.characters ch
    set state = coalesce(ch.state, '{}'::jsonb)
      || jsonb_build_object('hpCurrent', p_current, 'hpTemp', coalesce(p_temp, 0))
      || case when p_conditions is null then '{}'::jsonb else jsonb_build_object('conditions', to_jsonb(p_conditions)) end
      || case when p_death_saves is null then '{}'::jsonb else jsonb_build_object('deathSaves', p_death_saves) end
    where ch.id = p_character
      and (ch.owner_id = me
           or exists (select 1 from public.campaigns c where c.id = ch.campaign_id and c.created_by = me))
    returning ch.updated_at into stamp;
  if stamp is null then raise exception 'Only the player or the DM can do that'; end if;
  return stamp;
end;
$$;

-- A player's own character's initiative (or null to take it back).
create or replace function private.set_my_initiative(p_character uuid, p_value integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  camp uuid;
  now_init jsonb;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_value is not null and (p_value < -50 or p_value > 100) then raise exception 'Initiative out of range'; end if;
  select ch.campaign_id into camp
    from public.characters ch
    join public.campaigns c on c.id = ch.campaign_id
    where ch.id = p_character and ch.owner_id = me and not ch.retired and not c.archived;
  if camp is null then raise exception 'Only the player of a character in a running campaign can do that'; end if;
  update public.campaign_state s
    set initiative = jsonb_set(
          coalesce(s.initiative, '{}'::jsonb),
          '{pcs}',
          case when p_value is null
               then coalesce(s.initiative -> 'pcs', '{}'::jsonb) - p_character::text
               else coalesce(s.initiative -> 'pcs', '{}'::jsonb) || jsonb_build_object(p_character::text, p_value) end)
    where s.campaign_id = camp
    returning s.initiative into now_init;
  return now_init;
end;
$$;

-- Players settle a tie among characters in the initiative order: a score per
-- "pc:<sheet id>" in initiative.ties, standing in for Dexterity (the DM saves
-- the creatures' with the rest of the order).
create or replace function private.set_initiative_ties(p_campaign uuid, p_ties jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  now_init jsonb;
  k text;
  v jsonb;
  ids uuid[] := '{}';
  vals integer[];
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_ties is null or jsonb_typeof(p_ties) <> 'object' then raise exception 'Bad ties'; end if;
  if (select count(*) from jsonb_object_keys(p_ties)) not between 2 and 30 then raise exception 'Bad ties'; end if;
  for k, v in select * from jsonb_each(p_ties) loop
    if k !~ '^pc:[0-9a-f-]{36}$' or jsonb_typeof(v) <> 'number' or abs(v::numeric) > 1000 then
      raise exception 'Bad ties';
    end if;
    ids := ids || substr(k, 4)::uuid;
  end loop;
  -- Every one a character in this running campaign, one of them the caller's.
  if (select count(*) from public.characters ch join public.campaigns c on c.id = ch.campaign_id
        where ch.id = any(ids) and ch.campaign_id = p_campaign and not ch.retired and not c.archived) <> cardinality(ids)
     or not exists (select 1 from public.characters ch where ch.id = any(ids) and ch.owner_id = me) then
    raise exception 'Only the players of the tied characters can do that';
  end if;
  -- And all on one number: a tie.
  select initiative into now_init from public.campaign_state where campaign_id = p_campaign for update;
  select array_agg(distinct (now_init -> 'pcs' ->> id::text)::integer) into vals from unnest(ids) as id;
  if vals is null or cardinality(vals) <> 1 or vals[1] is null then
    raise exception 'Those characters aren''t tied';
  end if;
  update public.campaign_state s
    set initiative = jsonb_set(coalesce(s.initiative, '{}'::jsonb), '{ties}',
                               coalesce(s.initiative -> 'ties', '{}'::jsonb) || p_ties)
    where s.campaign_id = p_campaign
    returning s.initiative into now_init;
  return now_init;
end;
$$;

-- The DM chooses how a condition they give looks.
create or replace function private.set_character_condition_look(p_character uuid, p_key text, p_look jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  stamp timestamptz;
  me uuid := (select auth.uid());
  k text := lower(btrim(coalesce(p_key, '')));
begin
  if me is null then raise exception 'Not signed in'; end if;
  if length(k) = 0 or length(k) > 60 then raise exception 'Bad condition name'; end if;
  if p_look is not null and (
       jsonb_typeof(p_look) <> 'object'
       or octet_length(p_look::text) > 200
       or (p_look ? 'color' and jsonb_typeof(p_look->'color') <> 'string')
       or (p_look ? 'motion' and coalesce(p_look->>'motion', '') not in ('still', 'pulse', 'shimmer', 'heavy', 'shiver', 'daze'))) then
    raise exception 'Bad condition look';
  end if;
  update public.characters ch
    set definition = case
      when p_look is null then
        jsonb_set(coalesce(ch.definition, '{}'::jsonb), '{conditionLooks}',
                  coalesce(ch.definition->'conditionLooks', '{}'::jsonb) - k)
      else
        jsonb_set(coalesce(ch.definition, '{}'::jsonb), '{conditionLooks}',
                  coalesce(ch.definition->'conditionLooks', '{}'::jsonb) || jsonb_build_object(k, p_look))
      end
    where ch.id = p_character
      and (ch.owner_id = me
           or exists (select 1 from public.campaigns c where c.id = ch.campaign_id and c.created_by = me))
    returning ch.updated_at into stamp;
  if stamp is null then raise exception 'Only the player or the DM can do that'; end if;
  return stamp;
end;
$$;

-- A character's rows, shared: p_rows is [{ kind, name, data }, ...], all it
-- has now. Returns how many shared rows the character uses afterwards.
create or replace function private.sync_shared_rows(p_character uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  kept uuid[] := '{}';
  r jsonb;
  k text;
  n text;
  d jsonb;
  key text;
  fp text;
  rid uuid;
begin
  if me is null then raise exception 'Sign in to share' using errcode = '42501'; end if;
  if not exists (select 1 from public.characters ch where ch.id = p_character and ch.owner_id = me) then
    raise exception 'Not your character' using errcode = '42501';
  end if;
  if not coalesce((select p.share_rows from public.profiles p where p.id = me), true) then
    delete from public.shared_row_uses where character_id = p_character;
    return 0;
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 400 then
    raise exception 'Rows must be a list of at most 400' using errcode = '22023';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    k := r ->> 'kind';
    n := btrim(regexp_replace(coalesce(r ->> 'name', ''), '\s+', ' ', 'g'));
    d := jsonb_strip_nulls(coalesce(r -> 'data', '{}'::jsonb));
    -- Rows that can't be shared are skipped, not refused.
    continue when k is null or k not in ('attacks', 'spells', 'items', 'features', 'trackers');
    continue when char_length(n) not between 1 and 120;
    continue when jsonb_typeof(d) <> 'object' or pg_column_size(d) > 8192;
    key := lower(n);
    fp := md5(k || E'\n' || key || E'\n' || d::text);

    insert into public.shared_rows (kind, name, name_key, data, fingerprint, created_by)
    values (k, n, key, d, fp, me)
    on conflict (kind, fingerprint) do nothing
    returning id into rid;
    if rid is null then
      select sr.id into rid from public.shared_rows sr where sr.kind = k and sr.fingerprint = fp;
    end if;

    insert into public.shared_row_uses (shared_row_id, character_id, owner_id)
    values (rid, p_character, me)
    on conflict do nothing;
    kept := kept || rid;
  end loop;

  delete from public.shared_row_uses u where u.character_id = p_character and not (u.shared_row_id = any (kept));
  return (select count(*) from public.shared_row_uses u where u.character_id = p_character);
end;
$$;

-- Shared rows whose name matches what is being typed, best first. The
-- author's name only for players in a campaign with them.
-- What the players see of the creatures the DM revealed (dropped first: its columns grew in 0020).
drop function if exists public.revealed_creatures(uuid);
drop function if exists private.revealed_creatures(uuid);
create function private.revealed_creatures(p_campaign uuid)
returns table (id uuid, name text, kind text, vital text, conditions text[], initiative integer, "position" integer,
               portrait text, condition_looks jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.kind,
         case when coalesce(c.hp_max, 0) <= 0 then 'unknown'
              when coalesce(c.hp_current, c.hp_max) <= 0 then 'down'
              when coalesce(c.hp_current, c.hp_max)::numeric / c.hp_max <= 0.25 then 'critical'
              when coalesce(c.hp_current, c.hp_max)::numeric / c.hp_max <= 0.5 then 'bloodied'
              else 'healthy' end,
         c.conditions, c.initiative, c.position, c.portrait, c.condition_looks
  from public.campaign_creatures c
  where c.campaign_id = p_campaign and c.visible and private.is_campaign_member(p_campaign)
  order by c.position, c.created_at;
$$;

create or replace function private.search_shared_rows(p_kind text, p_query text, p_limit integer default 12)
returns table (id uuid, name text, data jsonb, uses integer, mine boolean, author text)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select lower(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))) as key
  ), hits as (
    select sr.*,
           case when sr.name_key = q.key then 0
                when starts_with(sr.name_key, q.key) then 1
                else 2 end as rank,
           (select count(*)::integer from public.shared_row_uses u where u.shared_row_id = sr.id) as uses
    from public.shared_rows sr, q
    where sr.kind = p_kind
      and char_length(q.key) >= 2
      and strpos(sr.name_key, q.key) > 0
  )
  select h.id, h.name, h.data, h.uses,
         coalesce(h.created_by = (select auth.uid()), false) as mine,
         case when h.created_by is not null
                   and h.created_by <> (select auth.uid())
                   and private.in_same_campaign((select auth.uid()), h.created_by)
              then (select nullif(p.display_name, '') from public.profiles p where p.id = h.created_by)
         end as author
  from hits h
  where (select auth.uid()) is not null
  order by h.rank, h.uses desc, h.created_at
  limit least(greatest(coalesce(p_limit, 12), 1), 30);
$$;

-- Stop sharing: every character's rows come out, and rows the player first
-- wrote no longer carry their name.
create or replace function private.forget_shared_rows()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  delete from public.shared_row_uses where owner_id = me;
  update public.shared_rows set created_by = null where created_by = me;
end;
$$;

-- The public faces.
create or replace function public.delete_own_account()
returns void language sql security invoker set search_path = ''
as $$ select private.delete_own_account() $$;

create or replace function public.create_campaign(p_name text, p_character uuid default null)
returns table (id uuid, invite_code text, character_updated_at timestamptz) language sql security invoker set search_path = ''
as $$ select * from private.create_campaign(p_name, p_character) $$;

create or replace function public.campaign_by_invite(p_code text)
returns table (id uuid, name text) language sql stable security invoker set search_path = ''
as $$ select * from private.campaign_by_invite(p_code) $$;

create or replace function public.join_campaign(p_code text, p_character uuid)
returns table (campaign_id uuid, character_updated_at timestamptz) language sql security invoker set search_path = ''
as $$ select * from private.join_campaign(p_code, p_character) $$;

create or replace function public.campaign_invite(p_campaign uuid)
returns text language sql stable security invoker set search_path = ''
as $$ select private.campaign_invite(p_campaign) $$;

create or replace function public.reset_campaign_invite(p_campaign uuid)
returns text language sql security invoker set search_path = ''
as $$ select private.reset_campaign_invite(p_campaign) $$;

create or replace function public.remove_from_campaign(p_character uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.remove_from_campaign(p_character) $$;

create or replace function public.set_character_conditions(p_character uuid, p_conditions text[])
returns timestamptz language sql security invoker set search_path = ''
as $$ select private.set_character_conditions(p_character, p_conditions) $$;

create or replace function public.set_character_hp(p_character uuid, p_current integer, p_temp integer,
                                                   p_conditions text[] default null, p_death_saves jsonb default null)
returns timestamptz language sql security invoker set search_path = ''
as $$ select private.set_character_hp(p_character, p_current, p_temp, p_conditions, p_death_saves) $$;

create or replace function public.set_my_initiative(p_character uuid, p_value integer)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.set_my_initiative(p_character, p_value) $$;

create or replace function public.set_initiative_ties(p_campaign uuid, p_ties jsonb)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.set_initiative_ties(p_campaign, p_ties) $$;

create or replace function public.set_character_condition_look(p_character uuid, p_key text, p_look jsonb)
returns timestamptz language sql security invoker set search_path = ''
as $$ select private.set_character_condition_look(p_character, p_key, p_look) $$;

create or replace function public.sync_shared_rows(p_character uuid, p_rows jsonb)
returns integer language sql security invoker set search_path = ''
as $$ select private.sync_shared_rows(p_character, p_rows) $$;

create function public.revealed_creatures(p_campaign uuid)
returns table (id uuid, name text, kind text, vital text, conditions text[], initiative integer, "position" integer,
               portrait text, condition_looks jsonb)
language sql stable security invoker set search_path = ''
as $$ select * from private.revealed_creatures(p_campaign) $$;

create or replace function public.search_shared_rows(p_kind text, p_query text, p_limit integer default 12)
returns table (id uuid, name text, data jsonb, uses integer, mine boolean, author text)
language sql stable security invoker set search_path = ''
as $$ select * from private.search_shared_rows(p_kind, p_query, p_limit) $$;

create or replace function public.forget_shared_rows()
returns void language sql security invoker set search_path = ''
as $$ select private.forget_shared_rows() $$;

-- campaigns: only the DM reads the invite code (through the functions);
-- only the name, the ending and the details are written directly.
revoke select, insert, update on public.campaigns from anon, authenticated;
grant select (id, name, created_by, created_at, archived, details) on public.campaigns to anon, authenticated;
grant insert (name, created_by) on public.campaigns to authenticated;
grant update (name, archived, details) on public.campaigns to authenticated;
grant delete on public.campaigns to authenticated;
revoke all on public.campaign_state from anon, authenticated;
grant select on public.campaign_state to anon, authenticated;
grant update (playback, initiative) on public.campaign_state to authenticated;
revoke all on public.board_items from anon, authenticated;
grant select on public.board_items to anon, authenticated;
grant insert (campaign_id, kind, data, created_by), update (data), delete on public.board_items to authenticated;
revoke all on public.campaign_creatures from anon, authenticated;
grant select, delete on public.campaign_creatures to authenticated;
grant insert (campaign_id, kind, name, hp_max, hp_current, hp_temp, ac, conditions, notes, link, position, initiative, visible, statblock, portrait, condition_looks)
  on public.campaign_creatures to authenticated;
grant update (kind, name, hp_max, hp_current, hp_temp, ac, conditions, notes, link, position, initiative, visible, statblock, portrait, condition_looks)
  on public.campaign_creatures to authenticated;
revoke all on public.homebrew_creatures from anon, authenticated;
grant select, delete on public.homebrew_creatures to authenticated;
grant insert (kind, name, statblock, portrait), update (kind, name, statblock, portrait) on public.homebrew_creatures to authenticated;
revoke all on public.shared_rows from anon, authenticated;
revoke all on public.shared_row_uses from anon, authenticated;

-- Who may call what: signed-in players; the join page's lookup also signed out.
do $$
declare
  f text;
begin
  foreach f in array array[
    'delete_own_account()', 'create_campaign(text, uuid)', 'join_campaign(text, uuid)',
    'campaign_invite(uuid)', 'reset_campaign_invite(uuid)', 'remove_from_campaign(uuid)',
    'set_character_conditions(uuid, text[])', 'set_character_hp(uuid, integer, integer, text[], jsonb)',
    'set_character_condition_look(uuid, text, jsonb)', 'sync_shared_rows(uuid, jsonb)',
    'search_shared_rows(text, text, integer)', 'forget_shared_rows()', 'campaign_by_invite(text)',
    'revealed_creatures(uuid)', 'set_my_initiative(uuid, integer)', 'set_initiative_ties(uuid, jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('revoke all on function private.%s from public, anon, authenticated', f);
    if f = 'campaign_by_invite(text)' then
      execute format('grant execute on function public.%s to anon, authenticated', f);
      execute format('grant execute on function private.%s to anon, authenticated', f);
    else
      execute format('grant execute on function public.%s to authenticated', f);
      execute format('grant execute on function private.%s to authenticated', f);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime: the renamed tables are still announced; profiles are not needed.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'characters') then
    alter publication supabase_realtime add table public.characters;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campaign_state') then
    alter publication supabase_realtime add table public.campaign_state;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'board_items') then
    alter publication supabase_realtime add table public.board_items;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- What everything is, for Supabase's table editor.

comment on table public.profiles is 'One row per player: how they appear, their preferences, privacy and pinned lists.';
comment on column public.profiles.display_name is 'The name the table calls them.';
comment on column public.profiles.picture_url is 'Their profile picture''s link; empty means none on purpose, null means use the one their Google or Discord account brings.';
comment on column public.profiles.share_rows is 'Whether rows they write on their sheets are offered to other players (Preferences, Share my rows).';
comment on column public.profiles.private_sheets is 'When true, only they and their campaigns'' DMs can open their characters.';
comment on column public.profiles.preferences is 'Look (light, dark, system), reduced motion, dice style and music settings.';
comment on column public.profiles.pinned_characters is 'Characters pinned to the top of the main menu, in their order.';
comment on column public.profiles.pinned_campaigns is 'Campaigns they run, pinned, in their order.';
comment on column public.profiles.pinned_joined_campaigns is 'Campaigns they play in, pinned, in their order.';

comment on table public.characters is 'Characters, one sheet each.';
comment on column public.characters.owner_id is 'The player whose character it is.';
comment on column public.characters.campaign_id is 'The campaign it is in, if any (joined through an invite).';
comment on column public.characters.name is 'The character''s name, kept in step with definition for lists.';
comment on column public.characters.retired is 'Retired characters are kept but set aside.';
comment on column public.characters.definition is 'What is written on the sheet: identity, abilities, features, spells, equipment, trackers.';
comment on column public.characters.state is 'How the character stands in play: hit points, conditions, death saves, tracker counts.';

comment on table public.character_pages is 'A character''s notes and backstory, each public or private.';
comment on column public.character_pages.field is 'Which page: notes or backstory.';
comment on column public.character_pages.is_public is 'Public pages can be read with the character; private ones only by its player and their DM.';

comment on table public.campaigns is 'Campaigns: a DM and the characters that joined.';
comment on column public.campaigns.created_by is 'The DM.';
comment on column public.campaigns.invite_code is 'The code in the invite link; only members can read it.';
comment on column public.campaigns.archived is 'An ended campaign: still readable, its invite opens nothing.';
comment on column public.campaigns.details is 'Banner, colour, name font, songs, card order and the next session.';

comment on table public.campaign_state is 'What is happening in a campaign right now: the music, the invite counter and the initiative order.';
comment on column public.campaign_state.playback is 'The DM''s music: which song, playing or paused, and where.';
comment on column public.campaign_state.initiative is
  'The initiative order: {pcs: {characterId: number}, turn: "pc:<id>"|"cr:<id>"|null, round, asking}.';
comment on column public.campaign_state.invite_rev is 'Goes up when the DM makes a new invite, so open pages fetch it.';

comment on table public.board_items is 'The campaign''s table board: pages, sticky notes, text and drawings.';
comment on column public.board_items.kind is 'page, note, text or stroke.';
comment on column public.board_items.data is 'Where it is and what it holds (its page, position, text, colour, points).';

comment on table public.shared_rows is 'Rows players wrote on their sheets (attacks, spells, items, features, trackers), offered to others as they type.';
comment on column public.shared_rows.name_key is 'The name lower-cased with single spaces, for searching.';
comment on column public.shared_rows.fingerprint is 'Identifies identical rows, so the same row is kept once.';
comment on column public.shared_rows.created_by is 'Who first wrote it; shown only to players in a campaign with them.';
comment on table public.shared_row_uses is 'Which characters use which shared rows right now.';
