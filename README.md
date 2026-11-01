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
- **Conditions**, currency, carried weight, proficiencies, languages and senses.
- **Notes and backstory** in pages, each of which can be made private.
- **Portrait and banner** from a link — Google Drive, Imgur, Dropbox, Pinterest
  and most image hosts — viewable full screen.
- **Themes** per character, light and dark mode, and undo.
- **Share, download and import**: copy a sheet's link, or save it as a readable
  text file and bring it back later.

## Built with

SvelteKit, Supabase (database, sign-in and row-level security) and GitHub
Pages.

## Running it locally

```bash
npm install
touch .env   # your Supabase project URL and anon key
npm run dev
```

In a new Supabase project, run `schema.sql` once in the SQL editor, and turn on
email confirmation under Authentication → Providers → Email.

```bash
npm test
```
