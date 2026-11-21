<script lang="ts">
  /**
   * The privacy policy: what the site keeps, where, and how to remove it.
   * Linked from Google's sign-in screen, so it must stay true to the code.
   */
  import { onMount } from 'svelte';
  import { base } from '#lib/base.ts';
  import { appVersion } from '#lib/version.ts';
  import Logo from '#lib/components/Logo.svelte';
  import BackLink from '#lib/components/BackLink.svelte';
  import ModeToggle from '#lib/components/ModeToggle.svelte';
  import PhoneTop from '#lib/components/PhoneTop.svelte';
  import { phone } from '#lib/stores/phone.svelte.ts';

  /** Opened from the account page (?from=account): Back goes there. */
  let back = $state(`${base}/`);
  onMount(() => {
    if (new URLSearchParams(location.search).get('from') === 'account') back = `${base}/account`;
  });
</script>

<svelte:head><title>Privacy | DND Companion</title></svelte:head>

<main class="policy">
  {#if phone.current}
    <!-- A phone's top bar, as every page's: the mode at the left, Back at the right. -->
    <PhoneTop>
      {#snippet left()}<ModeToggle />{/snippet}
      {#snippet right()}<BackLink href={back} />{/snippet}
    </PhoneTop>
  {:else}
    <!-- Back at the left, light or dark at the right. -->
    <div class="policyhead"><BackLink href={back} /><ModeToggle /></div>
  {/if}
  <!-- The same mark as signing in, so it reads as the same place; a phone has it in its top bar already. -->
  <div class="policybrand">
    {#if !phone.current}<Logo size={60} />{/if}
    <span>DND Companion</span>
  </div>
  <h1>Privacy</h1>
  <p class="dim">Last updated November 21, 2026. DND Companion {appVersion}, in alpha.</p>

  <p>DND Companion is a free, hobby D&amp;D 5e character sheet. It keeps only what it needs to run your sheets and campaigns, and it never sells, rents, or shares it for advertising.</p>

  <h2>What It Keeps</h2>
  <ul>
    <li><b>Your account:</b> your email address, the display name you choose, and a profile picture if you add one. If you sign in with Google, it receives your name, email address, and profile picture from Google, and nothing else from your Google account.</li>
    <li><b>What you write:</b> your character sheets, notes, lore, campaigns (with their monsters and NPCs, and the links you give them), and anything you put on a campaign's board.</li>
    <li><b>On your device:</b> small settings such as light or dark mode and the music's volume, shuffle, and mute, and the app's own files (its code and sound effects) so it opens quickly.</li>
  </ul>

  <h2>Who Can See It</h2>
  <p>A sheet or campaign page can be opened by anyone who has its link. Private notes on a sheet can be read by you, and by the DM of a campaign the sheet is in. A campaign's board can be changed by the people in that campaign.</p>
  <p>The rows on your sheets (attacks, spells, items, features, and trackers) are shared in a library that other players can pick from while they type, without your name. Only players you share a campaign with can see that you wrote one. You can turn this off on the <a href="{base}/account">Account</a> page, which takes your rows back out of it. A row another player has also put on their own sheet stays, as theirs, without your name.</p>

  <h2>In Owlbear Rodeo</h2>
  <p>The extension keeps its campaign's link and the order of its characters in the room, and a token placed or tied from it carries the character's or creature's id. Owlbear Rodeo stores these with the room, under its own privacy policy. Rolls made on a sheet are sent as they happen to the rooms its character is in, and aren't kept. A DM's monsters and NPCs are read only by that DM; players see a revealed one only as hurt as it looks.</p>

  <h2>Where It Is Stored</h2>
  <p>Accounts and sheets are stored with <a href="https://supabase.com/privacy" rel="noopener">Supabase</a>, which runs the database and sign-in. The site itself is served by GitHub Pages, through Cloudflare. Pictures, music, and the Owlbear Rodeo room you link to stay where they are: the page loads them from those sites (for example YouTube for music), and those sites' own policies apply. Fonts are loaded from Google Fonts. Searching and looking up a spell, item, feature, or monster reads 5e.tools' published data (and its homebrew library) from GitHub, which sees only that the file was asked for.</p>

  <h2>The Code</h2>
  <p>DND Companion’s code is open for anyone to read, so you can see exactly what it does with what you give it.</p>
  <p><a class="smallbtn" href="https://github.com/krispypcl/DNDCompanion" target="_blank" rel="noopener noreferrer">GitHub Repository</a></p>

  <h2>Removing It</h2>
  <p>You can delete any sheet or campaign yourself. Deleting your account on the <a href="{base}/account">Account</a> page removes the account and its sheets for good, along with their rows in the shared library. You can also remove the site's access to your Google account at <a href="https://myaccount.google.com/connections" rel="noopener">myaccount.google.com/connections</a>.</p>

  <h2>Questions</h2>
  <p>Write to <a href="mailto:krispypcl@gmail.com">krispypcl@gmail.com</a>.</p>
</main>

<style>
  /* Its buttons as tall as the campaign page's (app.css --btn-h). */
  .policy { max-width: 42rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; line-height: 1.6; --btn-h: 2.125rem; }
  /* A phone: a little room under the top bar (the layout keeps the bar's own height free). */
  @media (max-width: 700px) { .policy { padding-top: 1rem; } }
  .policy .smallbtn { padding-inline: 0.875rem; }
  h1 { margin: 1.5rem 0 0.25rem; font-size: 2rem; }
  .policyhead { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .policybrand {
    display: flex; flex-direction: column; align-items: center; gap: 0.625rem; margin: 0.5rem 0 0; color: var(--text);
  }
  .policybrand span { font-family: var(--font-brand); font-weight: 700; font-size: 2rem; line-height: 1.15; letter-spacing: 0.01em; text-align: center; }
  h2 { margin: 2rem 0 0.5rem; font-size: 1.0625rem; }
  .dim { color: var(--dim); margin-top: 0; font-size: 0.875rem; }
  ul { padding-left: 1.25rem; }
  li { margin: 0.375rem 0; }
  /* Links inside the writing (a policy, an address) read as part of it. */
  p a:not(.smallbtn) { color: var(--a, var(--text)); }
</style>
