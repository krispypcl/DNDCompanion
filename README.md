# DND Companion

An online 5e character sheet. Sheets are public read-only by URL; only the
owner can edit. No rules engine — values are entered by hand.

- **Spec:** `docs/superpowers/specs/2026-10-28-character-sheet-design.md`
- **Plan:** `docs/superpowers/plans/2026-10-28-character-sheet-phase-1a.md`

## What a sheet holds

A three-rail layout on a laptop, one column on a phone, with the rails
reordered so the attacks come before the eighteen-row skill list.

- **Always visible** — hit points with temporary HP and death saves,
  abilities and saving throws, skills grouped under the ability that scores
  them, defense, passive scores, trackers, currency, carried weight, and a
  collapsed reminder of what any character can do in combat.
- **Behind tabs** — combat, spells, equipment, features, trackers,
  character, notes, backstory. The four lists share one table.
- **Derived, never stored** — ability modifiers, saving throws, skill
  totals, passive scores, initiative when no override is written, tracker
  maxima from a formula, and carried weight. Everything else is typed in,
  because no open dataset covers the homebrew this was built for.

## Design

The greys are HeroUI's dark tokens. A character's theme is two numbers — a
hue and a chroma scale — and every accent shade derives from them in oklch,
so a theme costs one row in `src/lib/theme.ts` and a picked colour's own
saturation carries through. The ramp is declared on `.themed`, not only on
`:root`: a custom property is substituted where it is declared, so a ramp on
`:root` alone would never follow a hue set deeper in the page.

Dark is the default and light is a second set of the same tokens, chosen per
device and written to the document by `src/app.html` before the first paint,
so a light-mode reader never gets a dark frame. The accent ramp inverts with
it: `--a-hi` is the brightest shade in the dark and the deepest in the light,
because in both cases it is the one carrying the most emphasis.
`tests/theme-contrast.test.ts` recomputes every ramp from `app.css` and
checks each pair a reader has to resolve against all eight presets and a
maximum-chroma custom colour.

Switching a sheet into edit mode moves nothing: both states render the same
`EditableField`, whose two halves share a box. There is a Playwright check
for this — it measures every panel before and after the switch.

## Stack

SvelteKit (static adapter) on GitHub Pages, Supabase for data, auth and
row-level security. No server-side code.

## Setup

```bash
npm install
cp .env.example .env     # fill in your Supabase URL and anon key
npm run dev
```

The Supabase anon key is public by design — row-level security decides what
each request may do. The service role key is never used in this project.

### Supabase project

1. Create a project at supabase.com.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor.
3. **Enable email confirmation** under Authentication → Providers → Email.
   The confirmed address is the only password-recovery route.
4. Put the project URL and anon key in `.env`, and in the repo's Actions
   variables as `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.

## Tests

```bash
npm test
```

Policy tests need a local Postgres and are skipped without one:

```bash
createdb dndcompanion_test
TEST_DATABASE_URL=postgres://postgres@localhost:5432/dndcompanion_test npm test
```

The unit tests pin behaviour, not markup, so they cannot catch a layout
regression. Those are checked by building and driving the real app.

## Deployment

Pushing to `main` builds and publishes to GitHub Pages. The SPA shell is
emitted as `404.html`, because Pages serves that file for any path it has no
file for — which is every shared sheet link.

## What is not here yet

Phase 1b: the shared library with per-entry visibility, campaigns, a DM
view and retired characters. The tables and their policies already ship in
`supabase/migrations/0001_init.sql`, so it needs no migration against live
data. Profiles are a dependency of it: the library has to show who wrote an
entry, and `auth.users` is not readable by other users.
