<script lang="ts">
  import { base } from '$app/paths';
  import { signOut } from '$lib/data/session';
  import { session } from '$lib/stores/session';

  let { showBack = false }: { showBack?: boolean } = $props();
</script>

<header class="site">
  {#if showBack}
    <a class="back" href="{base}/" aria-label="Back to your sheets">
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.6"
              stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      Sheets
    </a>
  {:else}
    <span class="brand">DND Companion</span>
  {/if}

  {#if $session.user}
    <button class="out" onclick={() => signOut()}>Sign out</button>
  {/if}
</header>

<style>
  .site {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--line);
    font-size: 0.85rem;
  }
  .back, .brand { color: var(--dim); text-decoration: none; display: inline-flex; align-items: center; gap: 0.3rem; }
  .back:hover { color: var(--text); }
  .out { background: none; border: 0; color: var(--dim); font: inherit; font-size: 0.85rem; cursor: pointer; padding: 0; }
  .out:hover { color: var(--text); }
</style>
