<script lang="ts">
  import { backdrop, movable } from '#lib/actions.ts';
  import InfoTip from './InfoTip.svelte';
  /** The keyboard shortcuts, opened with ? or the keyboard button on a sheet or a campaign. */
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion } from '#lib/motion.ts';

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
          { keys: ['/'], what: 'Search 5e.tools' },
          { keys: ['M'], what: 'The table music on or off' },
          { keys: ['?'], what: 'Show these shortcuts' },
          { keys: ['Esc'], what: 'Close this, or a question' }
        ]
      : [
          ...(owner
            ? [
                { keys: ['E'], what: 'Edit, or finish editing' },
                { keys: [mac ? '⌘' : 'Ctrl', 'Z'], what: 'Undo the last change' },
                { keys: ['P'], what: 'Save the sheet as a PDF, to print or keep' }
              ]
            : []),
          { keys: ['1', '–', '9'], what: 'Switch tabs, Combat to Appearance' },
          { keys: ['/'], what: 'Search 5e.tools' },
          { keys: ['M'], what: 'Music on or off' },
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
     use:backdrop={onclose}>
  <div class="box" use:movable role="dialog" data-keys aria-modal="true" aria-labelledby="keys-title"
       transition:scale={{ start: 0.96, duration: still ? 0 : 180, easing: cubicOut }}>
    <div class="keyshead">
      <h2 id="keys-title">Keyboard shortcuts
        <InfoTip label="About shortcuts">They work anywhere on the {place === 'campaign' ? 'page' : 'sheet'} except while typing in a field.</InfoTip>
      </h2>
      <button class="closex" bind:this={closer} aria-label="Close" title="Close (Esc)" onclick={onclose}>×</button>
    </div>
    <dl>
      {#each rows as row (row.what)}
        <div>
          <dt>{#each row.keys as k (k)}{#if k === '–'}<span class="to">to</span>{:else}<kbd>{k}</kbd>{/if}{/each}</dt>
          <dd>{row.what}</dd>
        </div>
      {/each}
    </dl>
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
  /* The title and its ×, with room under them before the list. */
  .keyshead { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1rem; --x-size: 1.875rem; }
  h2 { margin: 0; display: flex; align-items: center; gap: 0.375rem; font-size: 1.0625rem; font-weight: 650; }
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
</style>
