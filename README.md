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

An online D&D 5e character sheet for a group of friends, on a phone, a tablet
or a computer. Each player keeps their own characters, and a sheet's link lets
anyone read it.

- **Sheets** work out the numbers that follow from others and leave the rest
  to write by hand, so homebrew is as easy to keep as anything from the
  books. Rules open straight from [5e.tools](https://5e.tools/), and a sheet
  exports to a printable PDF.
- **Campaigns** bring the party together: the DM sees everyone's hit points
  and conditions live, runs initiative, keeps monsters and NPCs, plays music
  for the table and shares a board everyone can draw on.
- **Owlbear Rodeo extension**: the same party, live, on an Owlbear map.
- **Installable**: it can be added to a home screen and opens like an app.

## Usage

### In app

1. Open the app and create an account: email and password, Google or Discord.
2. Press **New sheet** to make a character, then **Edit** to fill it in. It
   saves as you go; **Done** leaves edit mode. Press <kbd>?</kbd> on a computer
   for the keyboard shortcuts.
3. Share a character by copying its link from the sheet's header. Notes and
   backstory pages can each be kept private, or every sheet at once from the
   account page (Preferences → Keep my sheets private).
   The PDF button saves a printable sheet with the character inside it:
   **Import** in the main menu brings it back as a new sheet. Edits made in
   the PDF itself don't come back, and saving the PDF again from another app
   can leave the character out.
4. **Campaigns:** the DM presses **New campaign** in the main menu's Campaigns
   area and sends the players the invite link (**Copy invite link**, beside
   the Characters title on the campaign page). Each player opens it and picks
   which character joins. The DM's cog, beside **Back**, opens the campaign's
   settings: its name, next session, crest, banner, Owlbear Rodeo room, font
   and color, and ending or deleting it.
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
   **Campaign**, at the top right beside the brand, opens its page; the swap
   button next to it brings in another campaign in its place.
3. **Place token** puts a character on the map wearing their portrait, or
   right-click any character token and **Tie to a character**. Its hit point
   bar and condition dots follow the sheet. **Find token** brings the view to
   it. Rolls made on the sheets pop up for everyone in the room.
4. **Sign in** inside the panel (email, Google or Discord) to change hit
   points from a token's right-click menu. Owlbear keeps its own sign-in;
   Google and Discord open a small window, so allow pop-ups for owlbear.rodeo.
5. **The DM**, signed in, runs the fight from the panel: the initiative order
   (the card and token whose turn it is light up) and, under the characters,
   the monsters and NPCs, each with **Stat block** (beside the map),
   **Find token** and **Place token**. Their bars show on the map only once
   revealed, and only as hurt as they look.
6. Everything in the panel follows changes as they happen, made in the room or
   on the campaign page.

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
- Sound effects from CC0 packs by [Kenney](https://kenney.nl/) and
  artisticdude, through [OpenGameArt](https://opengameart.org/) (credits in
  `static/sounds/LICENSE.txt`)
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
