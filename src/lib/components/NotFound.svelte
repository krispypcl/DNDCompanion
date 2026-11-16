<script lang="ts">
  /**
   * A page that can't be shown: a sheet that was deleted, a mistyped link, a
   * page that needs signing in first. The die landed on a natural 1, a
   * light-hearted line, and a way on (back to the sheets unless `action`
   * says otherwise). It names the tab too (`tab`), so the tab says what
   * happened rather than the page that isn't there.
   */
  import { base } from '$app/paths';
  import { pageTitle } from '$lib/title';
  import D20Loader from './D20Loader.svelte';

  let {
    title,
    message,
    tab = 'Not found',
    action
  }: {
    title: string;
    message: string;
    tab?: string;
    /** Where the button goes instead of the sheets, and what it says. */
    action?: { href: string; label: string };
  } = $props();
</script>

<svelte:head><title>{pageTitle(tab)}</title></svelte:head>

<div class="lost">
  <div class="mark"><D20Loader result={1} size={72} failedLabel={title} /></div>
  <h1>{title}</h1>
  <p>{message}</p>
  <div class="ways">
    {#if action}<a class="home primary" href={action.href}>{action.label}</a>{/if}
    <a class="home" href="{base}/">Back to your sheets</a>
  </div>
</div>

<style>
  .lost {
    min-height: 70vh; display: grid; place-items: center; align-content: center; gap: 0.75rem;
    text-align: center; padding: 2rem 1rem;
  }
  /* The loading die, landed on a natural 1: the same die, so a sheet that
     will not load and a sheet that is not there read as the same roll. */
  .mark { animation: arrive 0.45s ease-out backwards; }
  @keyframes arrive { from { opacity: 0; transform: translateY(-10px); } }
  h1 { margin: 0.5rem 0 0; font-size: 1.5rem; font-weight: 650; letter-spacing: -0.01em; }
  p { margin: 0; color: var(--dim); max-width: 26rem; line-height: 1.5; }
  .ways { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; margin-top: 0.75rem; }
  .home {
    text-decoration: none; color: var(--text); font-size: 0.875rem;
    background: var(--raised); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 0.5rem 1rem;
    transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
  }
  .home:hover { border-color: var(--a-edge); color: var(--a); }
  .home.primary { border-color: var(--a-edge); background: var(--a-wash); color: var(--a); }
</style>
