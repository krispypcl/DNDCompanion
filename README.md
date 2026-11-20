<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/readme/brand-dark.png">
    <img src=".github/readme/brand-light.png" alt="DND Companion" width="400">
  </picture>
</p>

<p align="center">
  <a href="https://dndcompanion.krispypcl.workers.dev/DNDCompanion/"><b>Try the app</b></a>
  &nbsp;·&nbsp;
  <a href="https://dndcompanion.krispypcl.workers.dev/DNDCompanion/owlbear/manifest.json"><b>Owlbear Rodeo manifest</b></a>
</p>

## Overview

An online D&D 5e character sheet for a group of friends. Each player has an
account and their own characters; anyone with a sheet's link can read it
(unless its player keeps their sheets private), and only its owner can change
it. It works on a phone, a tablet and a laptop; on a phone each page is laid
out for the thumb, its parts on a bar at the bottom and its windows rising
from the bottom of the screen.

- **Sheets** work out what follows from other numbers (modifiers, saving
  throws, armor class, spell save DC, exhaustion's penalties) and leave the
  rest to be written by hand, so homebrew is as easy to keep as anything from
  the books. Ready-made trackers cover spell slots, class resources and
  exhaustion. Any class, species, background, feature, spell or item opens a
  pop-up straight from [5e.tools](https://5e.tools/), and a sheet exports to a
  printable PDF.
- **Search** (<kbd>/</kbd>) finds anything on 5e.tools by name, from every
  book: spells, items, feats, species, classes and subclasses, monsters,
  deities, languages, rules and more, as well as the classes and subclasses
  of 5e.tools' homebrew library. Each opens in a window of its own.
- **Campaigns** bring characters together: the DM sees the whole party's hit
  points, armor class and conditions live, gives and takes conditions, plays
  music for the table, sets the next session's date, and shares a board
  everyone can draw and write on. Each campaign has its own crest, banner,
  colour and name font, and can link the table's Owlbear Rodeo room. The
  header says who is here ("DM and 3 players here"), and portraits open full
  screen.
- **Fights**: the DM calls for initiative and each player rolls their own
  on the campaign page (their sheet points them there); the order and whose
  turn it is follow live for everyone, and a tie is settled by dragging. The
  DM keeps monsters and NPCs with their stat blocks (from 5e.tools or their
  own homebrew) and reveals them to the players when the party finds them:
  the players see how hurt each looks, and the expression the DM gives it.
- **Owlbear Rodeo extension**: the same party in an Owlbear room, with live hit
  points and conditions on the map's tokens, rolls from the sheets, the
  initiative order, the DM's monsters and NPCs as tokens, the campaign's board
  and its music.
- **Progressive Web App**: install it on a phone's home screen or a computer
  and it opens like an app of its own. Pages update themselves after each new
  release.

## Usage

### In app

1. Open the app and create an account: email and password, Google or Discord.
2. Press **New sheet** to make a character, then **Edit** to fill it in. It
   saves as you go; **Done** leaves edit mode. Press <kbd>?</kbd> on a computer
   for the keyboard shortcuts.
3. Share a character by copying its link from the sheet's header. Notes and
   backstory pages can each be kept private, or every sheet at once from the
   account page (Preferences → Keep my sheets private).
4. **Campaigns:** the DM presses **New campaign** in the main menu's Campaigns
   area and sends the players the invite link (**Copy invite link**, beside
   the Characters title on the campaign page). Each player opens it and picks
   which character joins. The DM's cog, beside **Back**, opens the campaign's
   settings: its name, next session, crest, banner, Owlbear Rodeo room, font
   and colour, and ending or deleting it.
5. **Your account:** a name and picture, connected sign-ins (Google, Discord),
   light, dark or your device's own look, reduced motion, the dice style, and
   a few statistics.
6. **Install it:** in your browser's menu choose *Add to Home Screen*
   (iPhone and iPad: Safari's share button) or *Install app* (Chrome and Edge
   on a computer).

### In Owlbear Rodeo

1. In an Owlbear room, choose **Extensions → Add custom extension** and paste
   the manifest link above.
2. Open the DND Companion button in the toolbar and paste your campaign's link
   (or its invite link). Every character in it joins the room.
3. **Place token** puts a character on the map wearing their portrait, or
   right-click any character token and **Tie to a character**. Its hit point
   bar and condition dots follow the sheet.
4. **Sign in** inside the panel (email, Google or Discord) to change hit
   points from a token's right-click menu and draw on the campaign's board.
   Owlbear keeps its own sign-in; Google and Discord
   open a small window, so allow pop-ups for owlbear.rodeo.
5. **The DM**, signed in, runs the fight from the panel: the initiative order
   (the token whose turn it is gets selected) and the monsters and NPCs, each
   with **Place token**. Their bars show on the map only once revealed, and
   only as hurt as they look.
6. **Board** opens the campaign's board over the room; **Music** opens a
   small player that follows the DM's table music. Browsers need one press of
   play before they make sound, and phones don't play music inside Owlbear.

## Framework

- [SvelteKit](https://svelte.dev/docs/kit) 3 with Svelte 5 and Vite, built as
  a static site (`@sveltejs/adapter-static`) and written in TypeScript
- [Supabase](https://supabase.com/): PostgreSQL with row-level security for
  the data, Supabase Auth for sign-in (email, Google, Discord) and Realtime for
  live updates and who is online
- [GitHub Pages](https://pages.github.com/) for hosting, served through
  Cloudflare; every push to `main` is tested and deployed by GitHub Actions
- The [Owlbear Rodeo SDK](https://docs.owlbear.rodeo/) for the extension
- [5e.tools](https://5e.tools/) data, read in the browser, for the rules pop-ups,
  and a search index of it built by `npm run search-index`
- [Vitest](https://vitest.dev/) and Testing Library for the tests

## Local Development

The app runs on [Supabase](https://supabase.com/): its database, sign-in and
live updates all come from one Supabase project.

1. Create a Supabase project. In its SQL editor, run `schema.sql` once. Turn on
   email confirmation under Authentication → Providers → Email; Google and
   Discord are optional there too.
2. Create a `.env` in the project folder with the project's URL and anon key
   (Project Settings → API):

   ```
   PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Install and start it (Node 24.15 or newer, or Node 26):

   ```bash
   npm install
   npm run dev
   ```

4. Check it: `npm test` runs the tests and `npm run check` the type checker.
   `npm run build` makes the static site in `build/`. Set `PUBLIC_SITE_URL`
   to the site's public address (it names the link previews), and
   `BASE_PATH` (for example `/DNDCompanion`) when it will be served from a
   sub-folder.
