# DND Companion

An online 5e character sheet. Sheets are public read-only by URL; only the
owner can edit. No rules engine — values are entered by hand.

- **Spec:** `docs/superpowers/specs/2026-10-28-character-sheet-design.md`
- **Plan:** `docs/superpowers/plans/2026-10-28-character-sheet-phase-1a.md`

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
