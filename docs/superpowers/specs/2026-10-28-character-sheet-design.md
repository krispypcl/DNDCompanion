# Online Character Sheet — Design Spec

**Date:** 2026-10-28
**Status:** Awaiting review (revision 2)
**Supersedes:** revision 1 of the same date

---

## Purpose

An online 5e character sheet for a D&D group. Each sheet lives at a URL anyone
can open read-only; only its owner can edit it. No rules engine and no bundled
content — values are entered by hand, and a shared library lets the group write
things up once and reuse them.

**Success looks like:** during a session, a player reaches for this instead of
paper or a PDF, and nothing about it slows them down.

### Who it is for

The author and his table — perhaps five or six people, one character each per
campaign. Everyone is trusted. The DM wants to glance at the party's sheets, not
edit them.

### Constraints

- Hosted independently of Claude
- Static hosting (GitHub Pages assumed)
- Phone and laptop equally important
- Must handle homebrew, specifically Valda's Spire of Secrets
- Sleek and minimal, with animation used deliberately

### Non-goals

- No dice rolling
- No scraping or bundling of third-party content
- No offline support (the group plays where wifi is good)
- No shared edit access on sheets
- No character creation wizard — later phase

---

## Two decisions worth recording

**No rules engine.** Every open 5e dataset is SRD-only, so none contain Valda's
Spire of Secrets. An app built around a rules database could not render the
character it was built for. Rendering from hand-entered data makes homebrew the
normal case rather than an exception, and is the smallest thing that works.

**No fetching from 5e.tools.** Browser CORS blocks it outright; routing around
that needs a server, which would make this app the host of someone else's
copyrighted text. The library solves the same problem better — entries are
written by users, work offline, cover homebrew, and never break when a third
party changes their data format.

---

## Architecture

```
Browser  →  GitHub Pages  →  HTML, CSS, JS      (once, on load)
Browser  →  Supabase      →  Postgres            (every read and write)
```

No server-side code. The browser renders and computes; Supabase stores,
authenticates and authorises.

The Supabase anon key ships in the bundle, by design. It grants nothing on its
own — row-level security decides what each request may do.

### Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | SvelteKit, static adapter | Compiles away; strong built-in transitions; closest to Blade |
| Build | Vite | SvelteKit default |
| Backend | Supabase | Postgres, Auth and RLS in one; free tier far exceeds this use |
| Hosting | GitHub Pages | Deploy on push; the repo is the deployment |

---

## Data model

Supabase Auth owns users. Three tables of our own.

```sql
create table campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table sheets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  campaign_id  uuid references campaigns(id) on delete set null,
  name         text not null,
  retired      boolean not null default false,
  definition   jsonb not null default '{}',
  state        jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table entries (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  campaign_id  uuid references campaigns(id) on delete set null,
  visibility   text not null default 'campaign'
               check (visibility in ('personal','campaign','global')),
  name         text not null,
  category     text not null
               check (category in ('item','spell','feature','condition','other')),
  body         text not null default '',
  source       text,
  forked_from  uuid references entries(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

A sheet's `id` is its public URL: `/s/<uuid>`. Unguessable, so an unshared sheet
stays effectively private, and there is no slug uniqueness to manage.

### definition vs state

**`definition`** is the character as written — set once, edited rarely.
**`state`** is what moves during a session.

Keeping them apart means a damage roll writes a few bytes and cannot touch the
character, and a long rest becomes one clean operation: reset `state`, leave
`definition` alone.

```
definition
  identity    name, class, subclass, level, ancestry, background, player,
              alignment, portraitUrl, lookupUrl
  abilities   str, dex, con, int, wis, cha        (scores only)
  proficiency bonus
  combat      ac, speed, initiative, hpMax, hitDice
  saves       which abilities are proficient
  skills      which are proficient, which have expertise
  attacks     [{ name, bonus, damage, notes, source, entryId? }]
  features    [{ title, body, source, entryId? }]
  spells      [{ name, save, time, range, components, duration, notes,
                 source, entryId? }]
  trackers    [ see below ]
  equipment   [{ name, qty, weight, notes, source, entryId? }]
  currency    cp, sp, ep, gp, pp
  notes       free text

state
  hpCurrent, hpTemp
  hitDiceUsed
  trackers      { trackerId: spentCount }
  deathSaves    { successes, failures }
  conditions    [string]
```

### Derived values are never stored

Ability modifiers, save bonuses, skill totals, passive scores and spell save DCs
are computed at render time from the scores and the proficiency bonus.

This is deliberate and non-negotiable. The PDF this replaces carried twelve
wrong numbers after a level-up moved proficiency from +2 to +3. One source of
truth makes that class of error impossible.

---

## Trackers

A tracker is the interactive heart of the sheet, and it is deliberately generic
so it can carry any class's resource without the app knowing what one is.

```
id            string
label         "Risk Dice"
description   optional — shown on tap
max           4  │  "level"  │  "cha"  │  "prof+1"  │  "level/2"
die           optional — "d8", rendered on the pips
type          pips │ counter │ gauge
direction     spend   (starts full, ticks down)
              accrue  (starts empty, ticks up)
reset         { on: short │ long │ dawn │ manual,
                amount: full │ 2 │ "level/2" }
group         optional — clusters related trackers
source        optional — for the lookup link
entryId       optional — library reference
```

### Why each field exists

**Formula maxima.** Monk ki is your level; Bardic Inspiration is your Charisma
modifier. A hardcoded number has to be edited every level-up — the exact drift
this design exists to prevent.

**Direction.** Exhaustion counts up to 6; sorcery points count down. One flag,
same component.

**Partial reset.** Wizard Arcane Recovery returns half your level in slot
levels, not everything.

**Groups.** Spell slots are nine trackers that belong together; a group renders
them as one block rather than nine loose rows.

### Formula grammar

Deliberately tiny, and a real parser — never `eval`.

```
expr    := term (('+' | '-') term)*
term    := factor ('/' factor)*          -- floor division
factor  := integer | identifier
identifier := level | prof | str | dex | con | int | wis | cha
```

Ability identifiers resolve to **modifiers**, not scores. Division floors.
An unparseable formula renders the tracker with a visible error rather than
silently reading zero.

This covers ki, rage, superiority dice, sorcery points, Channel Divinity,
Bardic Inspiration, exhaustion, spell slots, Risk Dice and the Sheriff's Star.

---

## The library

A shared store of written-up entries, so the group defines a thing once and
everyone reuses it.

### Visibility

| Value | Who sees it |
|---|---|
| `personal` | Only the creator |
| `campaign` | Anyone owning a sheet in that campaign |
| `global` | Everyone using the app |

**Default is `campaign`.** Global is a deliberate per-entry choice.

The distinction matters: homebrew shared globally is pure upside — nobody is
selling the Sheriff's Star. A global library of published spell text is a public
copy of a commercial book, which is a different thing. The app does not police
this; the user chooses knowingly, and the default is the cautious one.

### Editing and forking

**Only the creator may edit an entry.** Anyone else may **fork** it — copy it
into their own library, where they own the copy. `forked_from` records the
lineage.

This stops a widely-used entry being altered under the people depending on it,
while still letting someone route around a typo.

### Search before create

Adding a spell, item or feature to a sheet starts by typing the name. Matching
library entries appear first; you pick one or create new. Without this the
library accumulates five slightly different Shields within a month.

### How a sheet uses an entry

Any sheet entry may carry an `entryId`. When present, the library entry supplies
the name, body and source; the sheet keeps only what is local to this character
(quantity, prepared, attack bonus). When absent, the sheet entry is inline and
self-contained.

Clicking a linked entry opens a popup with its body — instantly, no tab switch,
no network call.

---

## 5e.tools lookup

A link out, used two ways: as a reference on the sheet, and as a **research aid
while writing a library entry** — open the page, copy the lines that matter into
the body.

### URL pattern

```
https://5e.tools/<category>.html#<name>_<source>
```

`<name>` lowercased and `encodeURIComponent`-encoded — spaces become `%20`,
parentheses are left alone. `<category>` comes from where the entry lives.

Verified against real examples:

| Entry | Fragment |
|---|---|
| Command | `spells.html#command_xphb` |
| Revolver | `items.html#revolver_valdagunslinger` |
| Tiefling (Glasya) | `races.html#tiefling%20(glasya)_mtf` |
| Archery | `feats.html#archery_xphb` |
| Artisan | `backgrounds.html#artisan_xphb` |

### Source codes

Mandatory and underivable — one character may span `xphb`, `mtf` and
`valdagunslinger`. Each entry has a `source` field, defaulting to `xphb`.

It earns its place independently: knowing an item is from Valda's rather than
the PHB is worth showing.

### Homebrew

`source: "homebrew"` renders a small **Homebrew** tag and suppresses the link
icon. Explicit beats a silently missing affordance.

### Full-URL override

Classes encode subclass selection into the fragment:

```
classes.html#gunslinger_valdagunslinger,state:feature=s2-0~sub_white%20hat_valdagunslinger=b1
```

Not worth reconstructing for one link per sheet. Class and subclass use a pasted
full URL on `identity.lookupUrl`. The override also covers anything hosted
elsewhere.

**No source and no override means no icon.** A missing link beats a dead one.

---

## The sheet

### Modes

Read-only by default for everyone, owner included. A logged-in owner sees an
Edit toggle. Edit does not navigate — fields become editable in place. Changes
autosave with a quiet indicator; there is no Save button.

### Layout

One responsive layout, the same on both devices.

**A sticky vitals strip** at the top: current HP, temp HP, AC, and death saves
when at zero. Reached every round, so never scrolled away.

**Five tabs below it:**

| Tab | Holds |
|---|---|
| **Play** | Trackers, attacks, conditions, undo |
| **Character** | Abilities, skills, saves, proficiencies, features |
| **Spells** | The spell table |
| **Library** | Browse, search, write and fork entries |
| **Notes** | Equipment, currency, backstory, free text |

Tabs rather than one long scroll: minimal means not showing a backstory during
combat. A session is spent almost entirely on **Play**.

### Undo

`state` is small, so snapshotting is cheap. The last **ten** states are held in
memory.

- Any major action (short rest, long rest, bulk change) raises a toast —
  *"Long rest taken — Undo"* — lasting about ten seconds
- A persistent undo control sits on the Play tab, labelled with what it would
  reverse

Covers the misclick without becoming version history. Undo is session-local; it
does not survive a reload.

### Animation

One orchestrated moment, not effects scattered through the page.

**The moment is rest.** Short Rest refills every `short` tracker in a staggered
sweep. Long Rest does the same for everything, plus HP. The only time the whole
sheet moves at once, and it marks a real beat in play.

Everything else stays restrained: HP counts rather than jumps and the bar drains
behind it; pips fill with a quick spring; tabs crossfade; the save indicator
pulses once and fades.

**Nothing animates on page load.** `prefers-reduced-motion` respected
throughout.

---

## Campaigns and the DM view

A sheet may belong to a campaign. `/c/<campaign-id>` shows a condensed card per
sheet: name, class, level, HP, AC, passive Perception.

No new permissions — every sheet is already public-read.

**Retired characters.** `retired` drops a sheet out of the campaign view without
deleting it. Covers a character dying and the player starting a new one, which
is the only way a player has two sheets in one campaign.

---

## Auth and permissions

Supabase Auth, email and password. Sign-up requires email confirmation — that
address is the only recovery route, and an unverified one is worthless when the
password is forgotten. Reset uses Supabase's own email flow. Sessions persist.

```sql
-- sheets: anyone reads, owner writes
create policy "sheets read"   on sheets for select using (true);
create policy "sheets insert" on sheets for insert with check (auth.uid() = owner_id);
create policy "sheets update" on sheets for update using (auth.uid() = owner_id);
create policy "sheets delete" on sheets for delete using (auth.uid() = owner_id);

-- campaigns: anyone reads, creator manages
create policy "campaigns read"   on campaigns for select using (true);
create policy "campaigns insert" on campaigns for insert with check (auth.uid() = created_by);
create policy "campaigns write"  on campaigns for update using (auth.uid() = created_by);
create policy "campaigns delete" on campaigns for delete using (auth.uid() = created_by);

-- entries: visibility-scoped read, creator-only write
create policy "entries read" on entries for select using (
  visibility = 'global'
  or owner_id = auth.uid()
  or (visibility = 'campaign'
      and campaign_id in (select campaign_id from sheets where owner_id = auth.uid()))
);
create policy "entries insert" on entries for insert with check (auth.uid() = owner_id);
create policy "entries update" on entries for update using (auth.uid() = owner_id);
create policy "entries delete" on entries for delete using (auth.uid() = owner_id);
```

Enforced in Postgres, where the browser cannot argue with it.

### Routes

| Route | Purpose |
|---|---|
| `/` | Your sheets, or sign in |
| `/s/<uuid>` | A sheet — read-only, or editable if you own it |
| `/c/<uuid>` | Campaign / DM view |
| `/library` | Browse and search the library |
| `/login`, `/signup`, `/reset` | Auth |

---

## Error handling

**A failed save never loses a change.** The value stays on screen, an indicator
shows it unsaved, and it retries. Only closing the tab loses it.

**Session expires mid-session** — prompt to log in again; pending changes held
and sent afterwards.

**Bad or deleted URL** — a plain empty state, not a crash.

**Non-owner** — edit controls are not rendered; a forged request is refused by
the database. Two layers, and the one that counts is the database.

**Two tabs on one sheet** — last write wins. Named rather than engineered
around: one person editing their own character.

**Deleted library entry still referenced by a sheet** — the sheet falls back to
its own stored name and shows the entry as unavailable. A sheet never breaks
because someone else deleted something.

**Unparseable tracker formula** — the tracker renders with a visible error, not
a silent zero.

---

## Testing

**Unit — derived values.** Modifiers, proficiency, save and skill totals,
passives, spell save DCs. Pure functions, and precisely what went wrong on the
PDF this replaces.

**Unit — the formula parser.** Each identifier, floor division, precedence, and
malformed input.

**Unit — the link builder.** Asserted against the eight real 5e.tools URLs
collected during design.

**Integration — the policies.** An anonymous visitor reads a sheet; a logged-in
non-owner cannot write it; a `personal` entry is invisible to others; a
`campaign` entry is visible only to members of that campaign. This is the
security boundary, so it is tested directly.

**Manual.** A pass on a phone and a laptop; responsive behaviour is not
something tests catch.

---

## Build order

The scope grew during design, so phase 1 is split.

**1a — the sheet.** Auth, `sheets`, the sheet UI, trackers with formulas, undo,
5e.tools links, inline entries. This is the first genuinely usable version and
should ship before anything else starts.

**1b — library and campaigns.** `entries`, `campaigns`, the Library tab, search
before create, forking, the DM view, retired characters.

**2 — the editor.** Proper character creation and editing rather than raw
fields.

**3 — content helpers.** SRD lookups and templates. SRD is openly licensed and
can be bundled legitimately; it will not cover Valda's.

---

## Open questions

1. **GitHub Pages or Vercel?** Functionally identical. Pages assumed.
2. **Portrait images** — Supabase Storage, or a pasted URL? A pasted URL is zero
   work; Storage is nicer but adds a bucket and policies.
3. **Sheet deletion** — assumed present with confirmation. Not yet designed.
4. **Campaign membership** — currently implied by owning a sheet in it. No join
   codes, no invitations. Fine for one trusted group; revisit if it spreads.
