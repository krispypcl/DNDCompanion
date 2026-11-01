# DND Companion

An online 5e character sheet. Sheets are public read-only by URL; only the
owner can edit. No rules engine — values are entered by hand.

- **Spec:** ``
- **Plan:** ``

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
touch .env     # fill in your Supabase URL and anon key
npm run dev
```

The Supabase anon key is public by design — row-level security decides what
each request may do. The service role key is never used in this project.

### Supabase project

1. Create a project at supabase.com.
2. Run `schema.sql`, then `0002_private_text.sql`, in
   the SQL editor. The second adds private notes and backstory; it is safe to
   run before or after deploying, and the app falls back to public text until
   it exists. It moves existing notes and backstory out of the sheet row into
   `sheet_text`, kept public.
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
`schema.sql`, so it needs no migration against live
data. Profiles are a dependency of it: the library has to show who wrote an
entry, and `auth.users` is not readable by other users.

## Behaviour worth knowing

- **Private notes and backstory.** One switch per writing. Enforced by
  row-level security in the `sheet_text` table, so visitors receive nothing,
  not a hidden field; they see an empty section.
- **Pages.** Notes and backstory are books of pages, stored as one text with a
  form feed (`\f`) between pages. Older single-text writing is a one-page book.
  Export writes each break as a `===== PAGE =====` line.
- **Death saves** are covered for everyone, the owner included, until hovered,
  reached by keyboard or tapped; the first tap only uncovers them, and they
  cover again when the pointer leaves or a tap lands elsewhere.
- **Private switch** appears greyed out with a note until
  `0002_private_text.sql` has been run.
- **Dates.** Visitors see Created and Last updated in the header; owners see
  them on the sheet list.
- **Pictures** open full screen from the portrait (reading) or the link
  previews (editing).
- **Visitors** see a status chip (Healthy, Bloodied, Critical, Down, Stable,
  Dead) where the owner has the damage and rest buttons.
- **Images.** Portrait and banner accept direct links and resolve share links
  from Google Drive (`lh3.googleusercontent.com/d/<id>`; file must be shared
  "Anyone with the link"), Dropbox (`raw=1`), OneDrive (the shares API),
  GitHub, Imgur, Gyazo and Google Images results; Pinterest thumbnails are
  sharpened to 736px. Page links that cannot be turned into a picture without
  fetching them (Pinterest pins, ArtStation, DeviantArt, Reddit, ImgBB…) get a
  note saying to copy the image address. The editor previews each link and
  says when it does not load.
- **Spells** have a Level drop-down and a Source column (the 5e.tools book
  code, which sets the lookup link). Spells group by level, cantrips first.
- **Reordering** is by dragging the grip at the left of a row (mouse or touch),
  or with the arrow keys on the grip. Rows only move within their group.
- **Download** (owner only, in the header) saves a readable text file; Import
  on the sheet list recreates it as a new sheet. Imports are sanitised.
- **Passwords** need at least 8 characters, typed twice, and are refused if
  the strength meter rates them "Too weak".
- **Currency** shows CP, SP, GP and PP; electrum is hidden but kept in data.
- Tests alias `$app/paths` to `tests/stubs/app-paths.ts`, and stub
  `ResizeObserver`, `Element.animate` and `PointerEvent` for jsdom.
