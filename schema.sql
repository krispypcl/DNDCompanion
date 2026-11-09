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
