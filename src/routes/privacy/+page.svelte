<script lang="ts">
  /**
   * The privacy policy: what the site keeps, where, and how to remove it.
   * Linked from Google's sign-in screen, so it must stay true to the code.
   */
  import { base } from '$app/paths';
</script>

<svelte:head><title>Privacy · DND Companion</title></svelte:head>

<main class="policy">
  <a class="back" href="{base}/">← DND Companion</a>
  <h1>Privacy</h1>
  <p class="dim">Last updated 9 November 2026.</p>

  <p>DND Companion is a free, hobby D&amp;D 5e character sheet. It keeps only what it needs to run your sheets and campaigns, and it never sells, rents or shares it for advertising.</p>

  <h2>What it keeps</h2>
  <ul>
    <li><b>Your account:</b> your email address, the display name you choose, and a profile picture if you add one. If you sign in with Google, it receives your name, email address and profile picture from Google, and nothing else from your Google account.</li>
    <li><b>What you write:</b> your character sheets, notes, backstories, campaigns, and anything you put on a campaign's board.</li>
    <li><b>Small settings in your browser:</b> such as light or dark mode, volume and shuffle, kept on your device.</li>
  </ul>

  <h2>Who can see it</h2>
  <p>A sheet or campaign page can be opened by anyone who has its link. Private notes on a sheet can be read by you, and by the DM of a campaign the sheet is in. A campaign's board can be changed by the people in that campaign.</p>

  <h2>Where it is stored</h2>
  <p>Accounts and sheets are stored with <a href="https://supabase.com/privacy" rel="noopener">Supabase</a>, which runs the database and sign-in. The site itself is served by GitHub Pages. Pictures and music you link to stay where they are: the page loads them from those sites (for example YouTube for music), and those sites' own policies apply. Fonts are loaded from Google Fonts.</p>

  <h2>Removing it</h2>
  <p>You can delete any sheet or campaign yourself. Deleting your account on the <a href="{base}/account">Account</a> page removes the account and its sheets for good. You can also remove the site's access to your Google account at <a href="https://myaccount.google.com/connections" rel="noopener">myaccount.google.com/connections</a>.</p>

  <h2>Questions</h2>
  <p>Write to <a href="mailto:krispypcl@gmail.com">krispypcl@gmail.com</a>.</p>
</main>

<style>
  .policy { max-width: 42rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; line-height: 1.6; }
  .back { color: var(--dim); text-decoration: none; font-size: 0.875rem; }
  .back:hover { color: var(--a, var(--text)); }
  h1 { margin: 1rem 0 0.25rem; font-size: 2rem; }
  h2 { margin: 2rem 0 0.5rem; font-size: 1.0625rem; }
  .dim { color: var(--dim); margin-top: 0; font-size: 0.875rem; }
  ul { padding-left: 1.25rem; }
  li { margin: 0.375rem 0; }
  a { color: var(--a, var(--text)); }
</style>
