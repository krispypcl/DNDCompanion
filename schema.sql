-- DND Companion — the whole database, for a fresh Supabase project.
--
-- Run once in the SQL editor. Safe to run again: everything is created only
-- if missing, and policies are replaced.
--
-- Authorization lives here, not in the client: the anon key is public, so
-- these policies are the only thing standing between a request and the data.
--
-- `entries` was for a shared library that was dropped; it is created here
-- as it once was and removed again (0012). Campaigns are set up in the
-- sections after the first, and the shared library (0013) is the last.

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

-- What the campaign page shows beyond its name: the banner's link and the
-- DM's songs. Small, and written only by the DM (database/0006).
alter table campaigns add column if not exists details jsonb not null default '{}'::jsonb;
alter table campaigns drop constraint if exists campaigns_details_size;
alter table campaigns add constraint campaigns_details_size
  check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 32000);

-- Everything but the code is readable; only a name can be written directly.
revoke select, insert, update on campaigns from anon, authenticated;
grant select (id, name, created_by, created_at, archived, details) on campaigns to anon, authenticated;
grant insert (name, created_by) on campaigns to authenticated;
grant update (name, archived, details) on campaigns to authenticated;
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

-- ---------------------------------------------------------------------------
-- Live campaign pages: changes to sheets are announced (Supabase Realtime),
-- so a campaign page hears hit points change as soon as a sheet saves.
-- See database/0007_live_sheets.sql.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sheets'
  ) then
    alter publication supabase_realtime add table public.sheets;
  end if;
end;
$$;

-- ===========================================================================
-- The campaign as a shared table (database/0008_campaign_table.sql). Kept as
-- one block: it redefines the sheet_text read policy, campaign_invite and
-- reset_campaign_invite above, which it supersedes.
-- ---------------------------------------------------------------------------
-- Membership.
create or replace function public.is_campaign_member(p_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from campaigns c where c.id = p_campaign and c.created_by = auth.uid())
      or exists (select 1 from sheets s where s.campaign_id = p_campaign and s.owner_id = auth.uid());
$$;
revoke all on function public.is_campaign_member(uuid) from public;
grant execute on function public.is_campaign_member(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The DM reads private notes and backstory of characters in their campaign.
drop policy if exists "sheet_text read" on sheet_text;
create policy "sheet_text read" on sheet_text for select
  using (
    is_public
    or owner_id = auth.uid()
    or exists (
      select 1 from sheets s join campaigns c on c.id = s.campaign_id
      where s.id = sheet_text.sheet_id and c.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- The DM sets a player's conditions: only that list, only in their campaign.
create or replace function public.set_sheet_conditions(p_sheet uuid, p_conditions text[])
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  stamp timestamptz;
  list text[] := coalesce(p_conditions, '{}'::text[]);
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if coalesce(array_length(list, 1), 0) > 40
     or exists (select 1 from unnest(list) n where length(n) > 60 or length(trim(n)) = 0) then
    raise exception 'Too many conditions';
  end if;
  update sheets s
    set state = jsonb_set(coalesce(s.state, '{}'::jsonb), '{conditions}', to_jsonb(list))
    where s.id = p_sheet
      and exists (select 1 from campaigns c where c.id = s.campaign_id and c.created_by = auth.uid())
    returning s.updated_at into stamp;
  if stamp is null then raise exception 'Only the DM can do that'; end if;
  return stamp;
end;
$$;
revoke all on function public.set_sheet_conditions(uuid, text[]) from public, anon;
grant execute on function public.set_sheet_conditions(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Hit points from the Owlbear Rodeo map (0011): the player or the DM.
create or replace function public.set_sheet_hp(
  p_sheet uuid,
  p_current integer,
  p_temp integer,
  p_conditions text[] default null,
  p_death_saves jsonb default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
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
       or exists (select 1 from unnest(p_conditions) n where length(n) > 60 or length(trim(n)) = 0)) then
    raise exception 'Too many conditions';
  end if;
  if p_death_saves is not null and (
       jsonb_typeof(p_death_saves) <> 'object' or octet_length(p_death_saves::text) > 200) then
    raise exception 'Bad death saves';
  end if;
  update sheets s
    set state = coalesce(s.state, '{}'::jsonb)
      || jsonb_build_object('hpCurrent', p_current, 'hpTemp', coalesce(p_temp, 0))
      || case when p_conditions is null then '{}'::jsonb else jsonb_build_object('conditions', to_jsonb(p_conditions)) end
      || case when p_death_saves is null then '{}'::jsonb else jsonb_build_object('deathSaves', p_death_saves) end
    where s.id = p_sheet
      and (s.owner_id = me
           or exists (select 1 from campaigns c where c.id = s.campaign_id and c.created_by = me))
    returning s.updated_at into stamp;
  if stamp is null then raise exception 'Only the player or the DM can do that'; end if;
  return stamp;
end;
$$;
revoke all on function public.set_sheet_hp(uuid, integer, integer, text[], jsonb) from public, anon;
grant execute on function public.set_sheet_hp(uuid, integer, integer, text[], jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- The DM chooses how a condition they give looks (0012).
create or replace function public.set_sheet_condition_look(p_sheet uuid, p_key text, p_look jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  stamp timestamptz;
  me uuid := (select auth.uid());
  k text := lower(trim(coalesce(p_key, '')));
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
  update sheets s
    set definition = case
      when p_look is null then
        jsonb_set(coalesce(s.definition, '{}'::jsonb), '{conditionLooks}',
                  coalesce(s.definition->'conditionLooks', '{}'::jsonb) - k)
      else
        jsonb_set(coalesce(s.definition, '{}'::jsonb), '{conditionLooks}',
                  coalesce(s.definition->'conditionLooks', '{}'::jsonb) || jsonb_build_object(k, p_look))
      end
    where s.id = p_sheet
      and (s.owner_id = me
           or exists (select 1 from campaigns c where c.id = s.campaign_id and c.created_by = me))
    returning s.updated_at into stamp;
  if stamp is null then raise exception 'Only the player or the DM can do that'; end if;
  return stamp;
end;
$$;
revoke all on function public.set_sheet_condition_look(uuid, text, jsonb) from public, anon;
grant execute on function public.set_sheet_condition_look(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- The invite, for everyone in the campaign (not only its DM).
create or replace function public.campaign_invite(p_campaign uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.invite_code from campaigns c
  where c.id = p_campaign and public.is_campaign_member(p_campaign);
$$;

-- ---------------------------------------------------------------------------
-- What is happening right now.
create table if not exists campaign_live (
  campaign_id uuid primary key references campaigns(id) on delete cascade,
  playback    jsonb not null default '{}'::jsonb,
  invite_rev  integer not null default 0,
  updated_at  timestamptz not null default now()
);
alter table campaign_live drop constraint if exists campaign_live_playback_size;
alter table campaign_live add constraint campaign_live_playback_size
  check (jsonb_typeof(playback) = 'object' and octet_length(playback::text) <= 4000);

drop trigger if exists campaign_live_touch on campaign_live;
create trigger campaign_live_touch before update on campaign_live
  for each row execute function touch_updated_at();

alter table campaign_live enable row level security;
revoke all on campaign_live from anon, authenticated;
grant select on campaign_live to anon, authenticated;
grant update (playback) on campaign_live to authenticated;

drop policy if exists "campaign_live read" on campaign_live;
drop policy if exists "campaign_live update" on campaign_live;
create policy "campaign_live read" on campaign_live for select using (true);
create policy "campaign_live update" on campaign_live for update
  using (exists (select 1 from campaigns c where c.id = campaign_id and c.created_by = auth.uid()));

-- Every campaign has one, made with it.
insert into campaign_live (campaign_id) select id from campaigns on conflict do nothing;

create or replace function public.make_campaign_live()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into campaign_live (campaign_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists campaigns_make_live on campaigns;
create trigger campaigns_make_live after insert on campaigns
  for each row execute function public.make_campaign_live();

-- A new invite ticks the counter, so open pages fetch it.
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
  insert into campaign_live (campaign_id, invite_rev) values (p_campaign, 1)
    on conflict (campaign_id) do update set invite_rev = campaign_live.invite_rev + 1;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- The shared board.
create table if not exists campaign_board (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  kind        text not null check (kind in ('note', 'text', 'stroke')),
  data        jsonb not null default '{}'::jsonb,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists campaign_board_campaign_idx on campaign_board (campaign_id);
alter table campaign_board drop constraint if exists campaign_board_data_size;
alter table campaign_board add constraint campaign_board_data_size
  check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 24000);
-- Deletes announce the whole row, so open boards know which item went.
alter table campaign_board replica identity full;

drop trigger if exists campaign_board_touch on campaign_board;
create trigger campaign_board_touch before update on campaign_board
  for each row execute function touch_updated_at();

-- A board, not a warehouse.
create or replace function public.campaign_board_cap()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from campaign_board b where b.campaign_id = new.campaign_id) >= 1500 then
    raise exception 'The board is full';
  end if;
  return new;
end;
$$;
drop trigger if exists campaign_board_cap on campaign_board;
create trigger campaign_board_cap before insert on campaign_board
  for each row execute function public.campaign_board_cap();

alter table campaign_board enable row level security;
revoke all on campaign_board from anon, authenticated;
grant select on campaign_board to anon, authenticated;
grant insert (campaign_id, kind, data, created_by), update (data), delete on campaign_board to authenticated;

drop policy if exists "campaign_board read" on campaign_board;
drop policy if exists "campaign_board insert" on campaign_board;
drop policy if exists "campaign_board update" on campaign_board;
drop policy if exists "campaign_board delete" on campaign_board;
create policy "campaign_board read" on campaign_board for select using (true);
create policy "campaign_board insert" on campaign_board for insert
  with check (created_by = auth.uid() and public.is_campaign_member(campaign_id));
create policy "campaign_board update" on campaign_board for update
  using (public.is_campaign_member(campaign_id));
create policy "campaign_board delete" on campaign_board for delete
  using (public.is_campaign_member(campaign_id));

-- ---------------------------------------------------------------------------
-- Room for a playlist's worth of songs in a campaign's details.
alter table campaigns drop constraint if exists campaigns_details_size;
alter table campaigns add constraint campaigns_details_size
  check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 64000);

-- ---------------------------------------------------------------------------
-- Live: both new tables are announced as they change.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campaign_live') then
    alter publication supabase_realtime add table public.campaign_live;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campaign_board') then
    alter publication supabase_realtime add table public.campaign_board;
  end if;
end;
$$;

-- ===========================================================================
-- 0009: pages on the table's board.
--
-- A campaign's board can now have several pages (a map, a plan, a list of
-- names), each its own endless sheet. A page is a row of kind 'page' on the
-- board, holding its name and its paper (plain, dots, grid, lines); what is
-- drawn or stuck on a page says which page in its data. With more room to
-- fill, a board holds up to 4000 things in all.
--
-- Safe to run more than once.

alter table campaign_board drop constraint if exists campaign_board_kind_check;
alter table campaign_board add constraint campaign_board_kind_check
  check (kind in ('note', 'text', 'stroke', 'page'));

create or replace function public.campaign_board_cap()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from campaign_board b where b.campaign_id = new.campaign_id) >= 4000 then
    raise exception 'The board is full';
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- 0010: what Supabase's Security and Performance Advisors asked for.
--
-- 1. Trigger functions get a fixed search_path.
-- 2. The membership check used by the board's rules moves to a schema the
--    API does not serve ("private"), so it cannot be called as an RPC; the
--    public copy stays for the functions that run as the owner only.
-- 3. The trigger that makes a campaign's live row can no longer be called.
-- 4. Row rules read auth.uid() once per query, not once per row.
-- 5. Foreign keys get the indexes they were missing.
--
-- The app's own functions (create_campaign, join_campaign and the rest) stay
-- callable by signed-in players on purpose: they are how the app works, and
-- each checks who is asking. Safe to run more than once.

-- 1. Fixed search paths.
alter function public.touch_updated_at() set search_path = public;
alter function public.guard_sheet_campaign() set search_path = public;
alter function public.campaign_board_cap() set search_path = public;

-- 2. Membership, out of the API's reach.
create schema if not exists private;
grant usage on schema private to anon, authenticated;
create or replace function private.is_campaign_member(p_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from campaigns c where c.id = p_campaign and c.created_by = (select auth.uid()))
      or exists (select 1 from sheets s where s.campaign_id = p_campaign and s.owner_id = (select auth.uid()));
$$;
revoke all on function private.is_campaign_member(uuid) from public;
grant execute on function private.is_campaign_member(uuid) to anon, authenticated;
-- The public one is now only for functions that run as the owner.
revoke execute on function public.is_campaign_member(uuid) from public, anon, authenticated;

-- 3. A trigger function, never an RPC.
revoke execute on function public.make_campaign_live() from public, anon, authenticated;

-- 4. Row rules, auth.uid() read once.
drop policy if exists "sheets insert" on public.sheets;
create policy "sheets insert" on public.sheets for insert with check ((select auth.uid()) = owner_id);

drop policy if exists "sheets update" on public.sheets;
create policy "sheets update" on public.sheets for update using ((select auth.uid()) = owner_id);

drop policy if exists "sheets delete" on public.sheets;
create policy "sheets delete" on public.sheets for delete using ((select auth.uid()) = owner_id);

drop policy if exists "campaigns insert" on public.campaigns;
create policy "campaigns insert" on public.campaigns for insert with check ((select auth.uid()) = created_by);

drop policy if exists "campaigns update" on public.campaigns;
create policy "campaigns update" on public.campaigns for update using ((select auth.uid()) = created_by);

drop policy if exists "campaigns delete" on public.campaigns;
create policy "campaigns delete" on public.campaigns for delete using ((select auth.uid()) = created_by);

drop policy if exists "entries read" on public.entries;
create policy "entries read" on public.entries for select using (
  visibility = 'global'
  or owner_id = (select auth.uid())
  or (
    visibility = 'campaign'
    and campaign_id is not null
    and campaign_id in (select s.campaign_id from sheets s where s.owner_id = (select auth.uid()))
  )
);

drop policy if exists "entries insert" on public.entries;
create policy "entries insert" on public.entries for insert with check ((select auth.uid()) = owner_id);

drop policy if exists "entries update" on public.entries;
create policy "entries update" on public.entries for update using ((select auth.uid()) = owner_id);

drop policy if exists "entries delete" on public.entries;
create policy "entries delete" on public.entries for delete using ((select auth.uid()) = owner_id);

drop policy if exists "sheet_text read" on public.sheet_text;
create policy "sheet_text read" on public.sheet_text for select
  using (
    is_public
    or owner_id = (select auth.uid())
    or exists (
      select 1 from sheets s join campaigns c on c.id = s.campaign_id
      where s.id = sheet_text.sheet_id and c.created_by = (select auth.uid())
    )
  );

drop policy if exists "sheet_text insert" on public.sheet_text;
create policy "sheet_text insert" on public.sheet_text for insert
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from sheets s where s.id = sheet_id and s.owner_id = (select auth.uid()))
  );

drop policy if exists "sheet_text update" on public.sheet_text;
create policy "sheet_text update" on public.sheet_text for update
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from sheets s where s.id = sheet_id and s.owner_id = (select auth.uid()))
  );

drop policy if exists "sheet_text delete" on public.sheet_text;
create policy "sheet_text delete" on public.sheet_text for delete
  using (owner_id = (select auth.uid()));

drop policy if exists "campaign_live update" on public.campaign_live;
create policy "campaign_live update" on public.campaign_live for update
  using (exists (select 1 from campaigns c where c.id = campaign_id and c.created_by = (select auth.uid())));

drop policy if exists "campaign_board insert" on public.campaign_board;
create policy "campaign_board insert" on public.campaign_board for insert
  with check (created_by = (select auth.uid()) and private.is_campaign_member(campaign_id));

drop policy if exists "campaign_board update" on public.campaign_board;
create policy "campaign_board update" on public.campaign_board for update
  using (private.is_campaign_member(campaign_id));

drop policy if exists "campaign_board delete" on public.campaign_board;
create policy "campaign_board delete" on public.campaign_board for delete
  using (private.is_campaign_member(campaign_id));

-- 5. Indexes for the foreign keys.
create index if not exists campaign_board_created_by_idx on public.campaign_board (created_by);
create index if not exists campaigns_created_by_idx on public.campaigns (created_by);
create index if not exists entries_campaign_id_idx on public.entries (campaign_id);
create index if not exists entries_forked_from_idx on public.entries (forked_from);
create index if not exists entries_owner_id_idx on public.entries (owner_id);

-- ===========================================================================
-- Advisor fixes, second round (0012).
--
-- 1. "Security definer function executable" (lints 0028/0029): the app's
--    RPCs ran as their owner straight from the API schema. Each one now
--    lives in the `private` schema (not exposed by the API), and the public
--    function of the same name and arguments is a plain wrapper that runs
--    as the caller and hands over to it. The app calls exactly what it
--    called before. Who may call what is unchanged: signed-in users, plus
--    the not-signed-in join page for campaign_by_invite.
--
-- 2. "Unused index" on entries: the table was for a shared library that
--    was dropped (4 Nov) and nothing uses it. It goes, with its indexes,
--    if it is empty (if it somehow has rows, it is kept and a notice says
--    so).
--
-- campaigns_created_by_idx and campaign_board_created_by_idx stay: they
-- index foreign keys (removing them brings back "unindexed foreign key"),
-- and they show as unused only because the tables are still small enough
-- for Postgres to read them whole.
-- ===========================================================================

create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- Moves a public security-definer function into `private`, once. Run again,
-- it finds the public one already a wrapper and leaves things alone.
create or replace function private.move_to_private(p_name text, p_args text)
returns void
language plpgsql
set search_path = public
as $$
declare
  definer boolean;
begin
  select p.prosecdef into definer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.oid = to_regprocedure(format('public.%I(%s)', p_name, p_args));
  if definer then
    execute format('drop function if exists private.%I(%s)', p_name, p_args);
    execute format('alter function public.%I(%s) set schema private', p_name, p_args);
  end if;
end;
$$;

select private.move_to_private('delete_own_account', '');
select private.move_to_private('create_campaign', 'text, uuid');
select private.move_to_private('campaign_by_invite', 'text');
select private.move_to_private('join_campaign', 'text, uuid');
select private.move_to_private('campaign_invite', 'uuid');
select private.move_to_private('reset_campaign_invite', 'uuid');
select private.move_to_private('remove_from_campaign', 'uuid');
select private.move_to_private('set_sheet_conditions', 'uuid, text[]');
select private.move_to_private('set_sheet_hp', 'uuid, integer, integer, text[], jsonb');
select private.move_to_private('set_sheet_condition_look', 'uuid, text, jsonb');
drop function private.move_to_private(text, text);

-- The public faces: same names, same arguments, running as the caller.
create or replace function public.delete_own_account()
returns void language sql security invoker set search_path = ''
as $$ select private.delete_own_account() $$;

create or replace function public.create_campaign(p_name text, p_sheet uuid default null)
returns table (id uuid, invite_code text, sheet_updated_at timestamptz) language sql security invoker set search_path = ''
as $$ select * from private.create_campaign(p_name, p_sheet) $$;

create or replace function public.campaign_by_invite(p_code text)
returns table (id uuid, name text) language sql stable security invoker set search_path = ''
as $$ select * from private.campaign_by_invite(p_code) $$;

create or replace function public.join_campaign(p_code text, p_sheet uuid)
returns table (campaign_id uuid, sheet_updated_at timestamptz) language sql security invoker set search_path = ''
as $$ select * from private.join_campaign(p_code, p_sheet) $$;

create or replace function public.campaign_invite(p_campaign uuid)
returns text language sql stable security invoker set search_path = ''
as $$ select private.campaign_invite(p_campaign) $$;

create or replace function public.reset_campaign_invite(p_campaign uuid)
returns text language sql security invoker set search_path = ''
as $$ select private.reset_campaign_invite(p_campaign) $$;

create or replace function public.remove_from_campaign(p_sheet uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.remove_from_campaign(p_sheet) $$;

create or replace function public.set_sheet_conditions(p_sheet uuid, p_conditions text[])
returns timestamptz language sql security invoker set search_path = ''
as $$ select private.set_sheet_conditions(p_sheet, p_conditions) $$;

create or replace function public.set_sheet_hp(p_sheet uuid, p_current integer, p_temp integer,
                                               p_conditions text[] default null, p_death_saves jsonb default null)
returns timestamptz language sql security invoker set search_path = ''
as $$ select private.set_sheet_hp(p_sheet, p_current, p_temp, p_conditions, p_death_saves) $$;

create or replace function public.set_sheet_condition_look(p_sheet uuid, p_key text, p_look jsonb)
returns timestamptz language sql security invoker set search_path = ''
as $$ select private.set_sheet_condition_look(p_sheet, p_key, p_look) $$;

-- Who may call them: the wrappers and what they hand over to alike.
do $$
declare
  f text;
begin
  foreach f in array array[
    'delete_own_account()', 'create_campaign(text, uuid)', 'join_campaign(text, uuid)',
    'campaign_invite(uuid)', 'reset_campaign_invite(uuid)', 'remove_from_campaign(uuid)',
    'set_sheet_conditions(uuid, text[])', 'set_sheet_hp(uuid, integer, integer, text[], jsonb)',
    'set_sheet_condition_look(uuid, text, jsonb)', 'campaign_by_invite(text)'
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

-- The unused library table.
do $$
begin
  if to_regclass('public.entries') is not null then
    if exists (select 1 from public.entries) then
      raise notice 'entries has rows, so it was kept';
    else
      drop table public.entries;
    end if;
  end if;
end;
$$;

-- ===========================================================================
-- The shared library (0013).
--
-- Every row a player writes on a sheet (an attack, spell, item, feature or
-- tracker) is shared, without its author's name, so anyone typing the same
-- name on their own sheet can pick it up ready-made. A player turns this off
-- on the account page, which also takes back everything they had shared.
--
-- How it fits together:
--
-- - library_entries: one row per distinct version of an entry. Two players
--   who wrote exactly the same thing share one entry (its fingerprint is the
--   kind, the name and the content). Versions with the same name sit side by
--   side, ranked by how many sheets use them.
-- - library_uses: which sheets have which entries right now. A sheet's set
--   is replaced each time it is shared, so a row deleted or rewritten on the
--   sheet stops counting, and an entry no sheet has any longer goes.
-- - Who wrote an entry is kept (created_by), but only shown to players who
--   are in a campaign with them; everyone else sees it anonymously.
--
-- Nobody reads or writes the tables directly: the three functions below are
-- the only way in, following the private/public pattern from 0012.
-- Safe to run more than once.
-- ===========================================================================

create schema if not exists private;
grant usage on schema private to anon, authenticated;

create table if not exists public.library_entries (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('attacks', 'spells', 'items', 'features', 'trackers')),
  name         text not null check (char_length(name) between 1 and 120),
  -- The name as it is searched and grouped: lower case, single spaces.
  name_key     text not null,
  data         jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 8192),
  fingerprint  text not null,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (kind, fingerprint)
);
create index if not exists library_entries_name_idx on public.library_entries (kind, name_key text_pattern_ops);
create index if not exists library_entries_created_by_idx on public.library_entries (created_by);

create table if not exists public.library_uses (
  entry_id   uuid not null references public.library_entries(id) on delete cascade,
  sheet_id   uuid not null references public.sheets(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, sheet_id)
);
create index if not exists library_uses_sheet_idx on public.library_uses (sheet_id);
create index if not exists library_uses_owner_idx on public.library_uses (owner_id);

-- Locked: no policies, so the API reads and writes nothing here directly.
alter table public.library_entries enable row level security;
alter table public.library_uses enable row level security;
revoke all on public.library_entries from anon, authenticated;
revoke all on public.library_uses from anon, authenticated;

-- An entry no sheet uses any longer goes (a sheet deleted, a row removed,
-- a player who stopped sharing).
create or replace function private.library_tidy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.library_entries e
  where e.id in (select entry_id from gone)
    and not exists (select 1 from public.library_uses u where u.entry_id = e.id);
  return null;
end;
$$;
revoke all on function private.library_tidy() from public, anon, authenticated;
drop trigger if exists library_tidy on public.library_uses;
create trigger library_tidy after delete on public.library_uses
  referencing old table as gone
  for each statement execute function private.library_tidy();

-- Two players share a campaign: as its DM, or with a sheet in it.
create or replace function private.library_same_campaign(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select c.id from public.campaigns c where c.created_by = a
    union select s.campaign_id from public.sheets s where s.owner_id = a and s.campaign_id is not null
  ), theirs as (
    select c.id from public.campaigns c where c.created_by = b
    union select s.campaign_id from public.sheets s where s.owner_id = b and s.campaign_id is not null
  )
  select exists (select 1 from mine join theirs using (id));
$$;
revoke all on function private.library_same_campaign(uuid, uuid) from public, anon, authenticated;

-- Has the player turned sharing off (account page)?
create or replace function private.library_opted_out(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (u.raw_user_meta_data ->> 'library_share') = 'false' from auth.users u where u.id = p_user), false);
$$;
revoke all on function private.library_opted_out(uuid) from public, anon, authenticated;

-- A sheet's rows, shared: p_rows is [{ kind, name, data }, …], everything
-- the sheet has now. Returns how many entries the sheet shares afterwards.
create or replace function private.library_sync(p_sheet uuid, p_rows jsonb)
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
  eid uuid;
begin
  if me is null then
    raise exception 'Sign in to share' using errcode = '42501';
  end if;
  if not exists (select 1 from public.sheets s where s.id = p_sheet and s.owner_id = me) then
    raise exception 'Not your sheet' using errcode = '42501';
  end if;
  if private.library_opted_out(me) then
    delete from public.library_uses where sheet_id = p_sheet;
    return 0;
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 400 then
    raise exception 'Rows must be a list of at most 400' using errcode = '22023';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    k := r ->> 'kind';
    n := btrim(regexp_replace(coalesce(r ->> 'name', ''), '\s+', ' ', 'g'));
    d := jsonb_strip_nulls(coalesce(r -> 'data', '{}'::jsonb));
    -- Rows the library can't hold are skipped, not refused: one odd row
    -- shouldn't stop the rest of the sheet.
    continue when k is null or k not in ('attacks', 'spells', 'items', 'features', 'trackers');
    continue when char_length(n) not between 1 and 120;
    continue when jsonb_typeof(d) <> 'object' or pg_column_size(d) > 8192;
    key := lower(n);
    fp := md5(k || E'\n' || key || E'\n' || d::text);

    insert into public.library_entries (kind, name, name_key, data, fingerprint, created_by)
    values (k, n, key, d, fp, me)
    on conflict (kind, fingerprint) do nothing
    returning id into eid;
    if eid is null then
      select e.id into eid from public.library_entries e where e.kind = k and e.fingerprint = fp;
    end if;

    insert into public.library_uses (entry_id, sheet_id, owner_id)
    values (eid, p_sheet, me)
    on conflict do nothing;
    kept := kept || eid;
  end loop;

  delete from public.library_uses u where u.sheet_id = p_sheet and not (u.entry_id = any (kept));
  return (select count(*) from public.library_uses u where u.sheet_id = p_sheet);
end;
$$;

-- Entries whose name matches what is being typed, best first: the name
-- itself, then names starting with it, then names containing it, and within
-- each the version most sheets use. The author's name only for players in a
-- campaign with them.
create or replace function private.library_search(p_kind text, p_query text, p_limit integer default 12)
returns table (id uuid, name text, data jsonb, uses integer, mine boolean, author text)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select lower(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))) as key
  ), hits as (
    select e.*,
           case when e.name_key = q.key then 0
                when starts_with(e.name_key, q.key) then 1
                else 2 end as rank,
           (select count(*)::integer from public.library_uses u where u.entry_id = e.id) as uses
    from public.library_entries e, q
    where e.kind = p_kind
      and char_length(q.key) >= 2
      and strpos(e.name_key, q.key) > 0
  )
  select h.id, h.name, h.data, h.uses,
         coalesce(h.created_by = (select auth.uid()), false) as mine,
         case when h.created_by is not null
                   and h.created_by <> (select auth.uid())
                   and private.library_same_campaign((select auth.uid()), h.created_by)
              then (select nullif(btrim(coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'full_name', '')), '')
                    from auth.users u where u.id = h.created_by)
         end as author
  from hits h
  where (select auth.uid()) is not null
  order by h.rank, h.uses desc, h.created_at
  limit least(greatest(coalesce(p_limit, 12), 1), 30);
$$;

-- Stop sharing: every sheet's rows come out of the library, and entries the
-- player first wrote no longer carry their name.
create or replace function private.library_forget()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  delete from public.library_uses where owner_id = me;
  update public.library_entries set created_by = null where created_by = me;
end;
$$;

-- The public faces, running as the caller.
create or replace function public.library_sync(p_sheet uuid, p_rows jsonb)
returns integer language sql security invoker set search_path = ''
as $$ select private.library_sync(p_sheet, p_rows) $$;

create or replace function public.library_search(p_kind text, p_query text, p_limit integer default 12)
returns table (id uuid, name text, data jsonb, uses integer, mine boolean, author text)
language sql stable security invoker set search_path = ''
as $$ select * from private.library_search(p_kind, p_query, p_limit) $$;

create or replace function public.library_forget()
returns void language sql security invoker set search_path = ''
as $$ select private.library_forget() $$;

do $$
declare
  f text;
begin
  foreach f in array array['library_sync(uuid, jsonb)', 'library_search(text, text, integer)', 'library_forget()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('revoke all on function private.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
    execute format('grant execute on function private.%s to authenticated', f);
  end loop;
end;
$$;
