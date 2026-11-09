<script lang="ts">
  /**
   * The character's class, read rather than edited: a card per class, with
   * its level large, the subclass under the name, the hit die and the book,
   * and a track of the twenty levels filled to where they are. Most
   * characters have one class, so one card is the usual look; a multiclass
   * character gets a card each and their total under them.
   */
  import { fade } from 'svelte/transition';
  import EntryLink from './EntryLink.svelte';
  import { prefersReducedMotion } from '$lib/motion';
  import type { ClassEntry } from '$lib/types';

  let { classes }: { classes: ClassEntry[] } = $props();

  const DIE: Record<string, number> = {
    barbarian: 12, fighter: 10, paladin: 10, ranger: 10, bard: 8, cleric: 8, druid: 8, monk: 8,
    rogue: 8, warlock: 8, artificer: 8, sorcerer: 6, wizard: 6
  };
  const shown = $derived(classes.filter((c) => c.name?.trim()));
  const total = $derived(shown.reduce((n, c) => n + (Number(c.level) || 0), 0));
  const level = (c: ClassEntry) => Math.max(0, Math.min(20, Number(c.level) || 0));
</script>

{#if shown.length === 0}
  <p class="none">No class yet.</p>
{:else}
  <div class="classes" class:multi={shown.length > 1} in:fade={{ duration: prefersReducedMotion() ? 0 : 200 }}>
    {#each shown as c, i (i + c.name)}
      {@const die = DIE[c.name.trim().toLowerCase()]}
      <article class="cls">
        <div class="lvl" aria-label="Level {level(c)}">
          <small aria-hidden="true">Level</small>
          <b aria-hidden="true">{level(c)}</b>
        </div>
        <div class="who">
          <h4>{c.name}<EntryLink name={c.name} source={c.source} category="classes" /></h4>
          {#if c.subclass?.trim()}
            <p class="sub">{c.subclass}<EntryLink name={c.subclass} source={c.source} category="subclasses" parent={{ name: c.name, source: c.source }} /></p>
          {/if}
          <p class="meta">
            {#if die}<span>d{die} hit die</span>{/if}
            {#if c.source?.trim()}<span class="src">{c.source.trim().toUpperCase()}</span>{/if}
          </p>
        </div>
        <!-- Twenty levels, filled to this one. -->
        <div class="track" aria-hidden="true">
          {#each Array(20) as _, n (n)}<i class:on={n < level(c)}></i>{/each}
        </div>
      </article>
    {/each}
    {#if shown.length > 1}
      <p class="total">Character level <b>{total}</b></p>
    {/if}
  </div>
{/if}

<style>
  .none { margin: 0; color: var(--dim); font-size: 0.875rem; }
  .classes { display: grid; gap: 0.75rem; }
  .classes.multi { grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); }
  .cls {
    display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-areas: 'lvl who' 'track track';
    align-items: center; gap: 0.875rem 1rem; padding: 1rem 1.125rem 0.875rem; border-radius: var(--r);
    border: 1px solid var(--a-edge);
    background: linear-gradient(135deg, var(--a-wash), color-mix(in oklch, var(--raised) 85%, transparent) 70%);
  }
  .lvl {
    grid-area: lvl; width: 4rem; height: 4rem; border-radius: 50%; display: grid; place-content: center; text-align: center;
    border: 2px solid var(--a); background: var(--surface); box-shadow: 0 0 0 4px var(--a-wash);
  }
  .lvl small { font-size: 0.5625rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--label); font-weight: 600; line-height: 1; }
  .lvl b { font-size: 1.625rem; line-height: 1.05; color: var(--a-hi); font-variant-numeric: tabular-nums; }
  .who { grid-area: who; min-width: 0; }
  h4 {
    margin: 0; font-size: 1.5rem; font-weight: 600; line-height: 1.15;
    display: flex; align-items: center; gap: 0.375rem; overflow-wrap: anywhere;
  }
  .sub { margin: 0.125rem 0 0; font-size: 0.9375rem; color: var(--text); display: flex; align-items: center; gap: 0.3125rem; }
  .meta { margin: 0.375rem 0 0; display: flex; flex-wrap: wrap; gap: 0.375rem; font-size: 0.75rem; color: var(--dim); }
  .meta span { padding: 0.0625rem 0.5rem; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); }
  .meta .src { letter-spacing: 0.06em; }
  .track { grid-area: track; display: grid; grid-template-columns: repeat(20, 1fr); gap: 3px; }
  .track i { height: 5px; border-radius: 3px; background: color-mix(in oklch, var(--text) 10%, transparent); }
  .track i.on { background: var(--a); }
  .track i:nth-child(5n) { margin-right: 3px; }
  .total { margin: 0; font-size: 0.8125rem; color: var(--dim); text-align: right; grid-column: 1 / -1; }
  .total b { color: var(--text); font-size: 1rem; margin-left: 0.25rem; }
  @media (max-width: 520px) {
    .lvl { width: 3.25rem; height: 3.25rem; }
    .lvl b { font-size: 1.3rem; }
    h4 { font-size: 1.25rem; }
  }
</style>
