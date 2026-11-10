# DND Companion

An online D&D 5e character sheet for a group of friends. Each player has an
account and their own characters; anyone with a sheet's link can read it, and
only its owner can change it. It works the same on a phone as on a laptop.

Characters can be brought together in **campaigns**: the DM sees the whole
party's hit points, armour class and conditions live, gives and takes
conditions, plays music for the table, and shares a board everyone can draw
and write on. The **Owlbear Rodeo extension** brings the same party into an
Owlbear room: live hit points and conditions on the map's tokens, rolls from
the sheets, the campaign's board and its music. It is also a **Progressive Web
App**: install it on a phone's home screen or a computer and it opens like an
app of its own.

There is no rules engine to fight. Numbers that follow from others (modifiers,
saving throws, armour class, spell save DC) are worked out for you; everything
else is written in by hand, so homebrew is as easy to keep as anything from the
books.

## Links

- **The app:** https://dndcompanion.krispypcl.workers.dev/DNDCompanion/
- **Owlbear Rodeo manifest:** https://dndcompanion.krispypcl.workers.dev/DNDCompanion/owlbear/manifest.json

## Using it

1. Open the app and create an account (email and password, or Google).
2. Press **New sheet** to make a character, then **Edit** to fill it in. It
   saves as you go; **Done** leaves edit mode. Press <kbd>?</kbd> on a computer
   for the keyboard shortcuts.
3. Share a character by copying its link from the sheet's header. Notes and
   backstory pages can each be kept private.
4. **Campaigns:** the DM presses **New campaign** on the front page and sends
   the players the invite link from the campaign page. Each player opens it
   and picks which character joins.
5. **Install it:** in your browser's menu choose *Add to Home Screen*
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
4. **Sign in** inside the panel to change hit points from a token's
   right-click menu and to draw on the campaign's board. (Owlbear keeps its own
   sign-in; Google-only accounts set a password on the account page first.)
5. **Board** opens the campaign's board over the room; **Music** opens a
   small player that follows the DM's table music. Browsers need one press of
   play before they make sound, and phones don't play music inside Owlbear.

## Built with

- [SvelteKit](https://svelte.dev/docs/kit) with Svelte 5, built as a static
  site (`@sveltejs/adapter-static`) and written in TypeScript
- [Supabase](https://supabase.com/) for the database, sign-in, row-level
  security and live updates (Realtime)
- [GitHub Pages](https://pages.github.com/) for hosting, served through
  Cloudflare; every push to `main` is tested and deployed by GitHub Actions
- The [Owlbear Rodeo SDK](https://docs.owlbear.rodeo/) for the extension
- Vitest for the tests

## Running it yourself

1. Create a Supabase project. In its SQL editor, run `schema.sql` once. Turn on
   email confirmation under Authentication → Providers → Email.
2. Create a `.env` in the project folder:

   ```
   PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Install and start it:

   ```bash
   npm install
   npm run dev
   ```

4. Check it: `npm test` runs the tests and `npm run check` the type checker.
   `npm run build` makes the static site in `build/`.
