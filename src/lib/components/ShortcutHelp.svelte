<script lang="ts">
  /** The keyboard shortcuts, opened with ? or the keyboard button on a sheet or a campaign. */
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion } from '$lib/motion';

  let {
    owner,
    place = 'sheet',
    onclose
  }: { owner: boolean; place?: 'sheet' | 'campaign'; onclose: () => void } = $props();
  const still = prefersReducedMotion();
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  const rows = $derived(
    place === 'campaign'
      ? [
          ...(owner ? [{ keys: ['E'], what: 'Edit, or finish editing' }] : []),
          { keys: ['M'], what: 'The table music on or off' },
          { keys: ['?'], what: 'Show these shortcuts' },
          { keys: ['Esc'], what: 'Close this, or a question' }
        ]
      : [
          ...(owner
            ? [
                { keys: ['E'], what: 'Edit, or finish editing' },
                { keys: [mac ? '⌘' : 'Ctrl', 'Z'], what: 'Undo the last change' }
              ]
            : []),
          { keys: ['1', '–', '9'], what: 'Switch tabs, Combat to Links' },
          { keys: ['M'], what: 'Sound and music on or off' },
          { keys: ['P'], what: 'Print the sheet' },
          { keys: ['?'], what: 'Show these shortcuts' },
          { keys: ['Esc'], what: 'Close a dialog or picture' }
        ]
  );

  let closer = $state<HTMLButtonElement>();
  onMount(() => {
    closer?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onclose();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });
</script>

<div class="scrim" role="presentation" transition:fade={{ duration: still ? 0 : 140 }}
     onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}>
  <div class="box" role="dialog" data-keys aria-modal="true" aria-labelledby="keys-title"
       transition:scale={{ start: 0.96, duration: still ? 0 : 180, easing: cubicOut }}>
    <h2 id="keys-title">Keyboard shortcuts</h2>
    <p class="hint">They work anywhere on the {place === 'campaign' ? 'page' : 'sheet'} except while typing in a field.</p>
    <dl>
      {#each rows as row (row.what)}
        <div>
          <dt>{#each row.keys as k (k)}{#if k === '–'}<span class="to">to</span>{:else}<kbd>{k}</kbd>{/if}{/each}</dt>
          <dd>{row.what}</dd>
        </div>
      {/each}
    </dl>
    <div class="row"><button bind:this={closer} onclick={onclose}>Got it</button></div>
  </div>
</div>

<style>
  .scrim {
    position: fixed; inset: 0; z-index: 55; display: grid; place-items: center; padding: 1rem;
    background: rgb(0 0 0 / 0.55); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
  }
  .box {
    width: min(26rem, 100%); background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--r); padding: 1.25rem; box-shadow: 0 20px 60px rgb(0 0 0 / 0.45);
  }
  h2 { margin: 0; font-size: 1.0625rem; font-weight: 650; }
  .hint { margin: 0.25rem 0 1rem; color: var(--dim); font-size: 0.8125rem; }
  dl { margin: 0; display: grid; gap: 0.5rem; }
  dl > div { display: grid; grid-template-columns: 7rem 1fr; align-items: center; gap: 0.75rem; }
  dt { display: flex; gap: 0.25rem; align-items: center; }
  dd { margin: 0; font-size: 0.875rem; }
  kbd {
    font: inherit; font-size: 0.75rem; font-weight: 600; min-width: 1.5rem; text-align: center;
    padding: 0.125rem 0.4375rem; border-radius: 5px; background: var(--raised);
    border: 1px solid var(--line); border-bottom-width: 2px; color: var(--text);
  }
  .to { color: var(--faint); font-size: 0.75rem; }
  .row { display: flex; justify-content: flex-end; margin-top: 1.125rem; }
  button {
    font: inherit; font-size: 0.875rem; border-radius: var(--r-sm); padding: 0.5rem 0.875rem; cursor: pointer;
    background: var(--a); border: 1px solid var(--a); color: var(--bg); font-weight: 650;
  }
  button:hover { filter: brightness(1.1); }
</style>
