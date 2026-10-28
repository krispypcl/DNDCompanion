-- DND Companion — initial schema.
--
-- Phase 1a uses `sheets` only. `campaigns` and `entries` ship now so phase 1b
-- needs no migration against live data.
--
-- Authorization lives here, not in the client: the anon key is public, so
-- these policies are the only thing standing between a request and the data.

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
