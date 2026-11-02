# DND Companion

An online D&D 5e character sheet for a group of friends. Each player has an
account and their own sheets. Anyone with a sheet's link can read it; only its
owner can change it. It works the same on a phone as on a laptop.

There is no rules engine. Values are written in by hand, so homebrew is as easy
to keep as anything from the books.

## Features

- **Hit points** with temporary HP, hit dice and death saves, damage and
  healing that shake the gauge in proportion to the hit, short and long rests,
  and a reddening screen edge as health runs low.
- **Abilities, saving throws and skills**, with proficiency and expertise, and
  totals worked out from the scores.
- **Combat, spells, equipment, features and trackers** in tables that can be
  reordered by dragging, with spells grouped by level and links to 5e.tools.
- **A dice roller** with advantage, disadvantage and modifiers; tap an attack
  to roll it.
- **Conditions**, each with its own tint at the edges of the screen, plus
  currency, carried weight, proficiencies, languages and senses.
- **Falling to 0** marks the character Incapacitated; three successful death
  saves bring them back to 1 hit point, three failures mark them Dead.
- **Notes and backstory** in pages, each of which can be made private.
- **Portrait and banner** from a link — Google Drive, Imgur, Dropbox, Pinterest
  and most image hosts — viewable full screen.
- **Themes** per character, light and dark mode, and undo.
- **Share, download and import**: copy a sheet's link, or save it as a readable
  text file and bring it back later.
- **Print** on the layout of the official character sheet, with a spell page
  for casters.
- **Install** on a phone's home screen as an app.
- **Accounts** with a display name and profile picture, and the option to
  delete the account and everything in it.
- **Pinned sheets** stay at the top of the list in your own order.
- **Attunement**: up to three attuned items, listed
  first.
- **Keyboard shortcuts** on a computer; press <kbd>?</kbd> on a sheet.
- **Ready-made trackers**: spell slots for every kind of caster and the common
  class resources, growing with the class's level.
- **Sound effects**, off until switched on: dice, criticals, a heartbeat at
  0 hit points and the toll of death saves.

## Built with

SvelteKit, Supabase (database, sign-in and row-level security) and GitHub
Pages.

## Running it locally

Create a `.env` with your Supabase project's URL and anon key:

```
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

```bash
npm install
npm run dev
```

In a new Supabase project, run `schema.sql` once in the SQL editor, and turn on
email confirmation under Authentication → Providers → Email.

```bash
npm test
```
