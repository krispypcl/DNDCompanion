<script lang="ts">
  /**
   * The character's own options, gathered from the Features tab for the
   * moment in play they are wanted: maneuvers, weapon masteries, feats,
   * fighting styles, invocations and metamagic. Laid out like General
   * actions; each one is a button that opens it where it is written.
   */
  import { featuresOpen } from '$lib/stores/tray';
  import Fold from './Fold.svelte';
  import type { Feature } from '$lib/types';

  let { features, onpick }: { features: Feature[]; onpick: (index: number) => void } = $props();

  const KINDS: { kind: string; label: string }[] = [
    { kind: 'Maneuver', label: 'Maneuvers' },
    { kind: 'Weapon Mastery', label: 'Weapon masteries' },
    { kind: 'Fighting Style', label: 'Fighting styles' },
    { kind: 'Feat', label: 'Feats' },
    { kind: 'Invocation', label: 'Invocations' },
    { kind: 'Metamagic', label: 'Metamagic' }
  ];

  const groups = $derived(
    KINDS.map((k) => ({
      ...k,
      items: features
        .map((f, index) => ({ f, index }))
        .filter(({ f }) => f.kind === k.kind && f.title?.trim())
    })).filter((g) => g.items.length > 0)
  );

  /** The first line of what it does, as a hint on hover (whole: nothing is cut short with "…"). */
  const hint = (f: Feature) => (f.body ?? '').trim().split('\n')[0];
</script>

{#if groups.length}
  <Fold label="Combat features" bind:open={$featuresOpen}>
    {#each groups as group (group.kind)}
      <section>
        <h3>{group.label}</h3>
        <ul>
          {#each group.items as { f, index } (index)}
            <li>
              <button onclick={() => onpick(index)} title={hint(f) || `Open ${f.title} in Features`}
                      aria-label="{f.title}: open in Features">{f.title}</button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </Fold>
{/if}

<style>
  section { margin-top: 0.875rem; }
  h3 {
    margin: 0;
    height: 1rem;
    display: flex;
    align-items: center;
    font-size: 0.5875rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--dim);
    font-weight: 600;
  }
  ul {
    list-style: none;
    margin: 0.3125rem 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.375rem;
  }
  /* The same chips as General actions, but each one can be pressed. */
  button {
    font: inherit;
    font-size: 0.75rem;
    color: var(--text);
    background: var(--raised);
    border: 1px solid var(--line-soft);
    border-radius: var(--r-sm);
    padding: 0.125rem 0.4375rem;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.08s ease;
  }
  button:hover { border-color: var(--a-edge); color: var(--a); background: var(--a-wash); }
  button:active { transform: translateY(1px); }
</style>
