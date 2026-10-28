<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { sheetRepo } from '$lib/data/sheets';
  import { signOut } from '$lib/data/session';
  import { blankDefinition } from '$lib/sample';
  import { session } from '$lib/stores/session';
  import { isConfigured } from '$lib/supabase';
  import type { Sheet } from '$lib/types';

  let sheets = $state<Sheet[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let creating = $state(false);

  $effect(() => {
    const user = $session.user;
    if (!user) {
      sheets = [];
      return;
    }
    loading = true;
    sheetRepo
      .listMySheets(user.id)
      .then((rows) => (sheets = rows))
      .catch((e) => (error = e instanceof Error ? e.message : 'Could not load your sheets'))
      .finally(() => (loading = false));
  });

  async function create() {
    const user = $session.user;
    if (!user) return;
    creating = true;
    try {
      const sheet = await sheetRepo.createSheet(user.id, 'New character', blankDefinition());
      await goto(`${base}/s/${sheet.id}`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not create a sheet';
    } finally {
      creating = false;
    }
  }
</script>

<svelte:head><title>DND Companion</title></svelte:head>

<main>
  <header>
    <h1>DND Companion</h1>
    {#if $session.user}
      <button class="ghost" onclick={() => signOut()}>Sign out</button>
    {/if}
  </header>

  {#if !isConfigured}
    <p class="warn">
      This copy has no Supabase credentials. Set <code>PUBLIC_SUPABASE_URL</code> and
      <code>PUBLIC_SUPABASE_ANON_KEY</code> and rebuild.
    </p>
  {:else if $session.loading}
    <p class="dim">Loading…</p>
  {:else if !$session.user}
    <p class="lede">
      Character sheets for your table. Each sheet has its own link that anyone can
      open and read; only you can change yours.
    </p>
    <div class="cta">
      <a class="primary" href="{base}/signup">Create an account</a>
      <a href="{base}/login">Sign in</a>
    </div>
  {:else}
    <div class="bar">
      <h2>Your characters</h2>
      <button onclick={create} disabled={creating}>{creating ? 'Creating…' : 'New sheet'}</button>
    </div>

    {#if error}<p class="warn" role="alert">{error}</p>{/if}

    {#if loading}
      <p class="dim">Loading…</p>
    {:else if sheets.length === 0}
      <p class="dim">No characters yet. Make one and start filling it in.</p>
    {:else}
      <ul>
        {#each sheets as sheet (sheet.id)}
          <li class:retired={sheet.retired}>
            <a href="{base}/s/{sheet.id}">
              <strong>{sheet.definition?.identity?.name || sheet.name}</strong>
              <span class="meta">
                {sheet.definition?.identity?.class ?? 'No class'}
                {#if sheet.definition?.identity?.level}· level {sheet.definition.identity.level}{/if}
                {#if sheet.retired}· retired{/if}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</main>

<style>
  main { max-width: 42rem; margin: 0 auto; padding: 2.5rem 1rem 4rem; }
  header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
  h1 { font-size: 1.5rem; margin: 0 0 0.5rem; }
  h2 { font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); margin: 0; }
  .lede { color: var(--dim); max-width: 32rem; }
  .cta { display: flex; gap: 1rem; align-items: center; margin-top: 1.5rem; }
  .primary {
    background: var(--accent); color: #1a1a18; border-radius: 6px;
    padding: 0.55rem 1.1rem; font-weight: 600; text-decoration: none;
  }
  .cta a:not(.primary) { color: var(--dim); }
  .bar { display: flex; align-items: center; justify-content: space-between; margin: 2rem 0 0.75rem; }
  button {
    background: var(--surface); border: 1px solid var(--line); color: var(--text);
    border-radius: 6px; padding: 0.4rem 0.9rem; font: inherit; font-size: 0.875rem; cursor: pointer;
  }
  button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  .ghost { background: none; border: 0; color: var(--dim); padding: 0; font-size: 0.85rem; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
  li a {
    display: block; border: 1px solid var(--line); border-radius: 8px;
    padding: 0.75rem 0.9rem; background: var(--surface); text-decoration: none; color: inherit;
    transition: border-color 0.15s ease;
  }
  li a:hover { border-color: var(--accent); }
  .retired a { opacity: 0.6; }
  .meta { display: block; font-size: 0.8rem; color: var(--dim); margin-top: 0.15rem; }
  .dim { color: var(--dim); }
  .warn { color: var(--accent); font-size: 0.9rem; }
  code { font-size: 0.85em; }
</style>
