<script lang="ts">
  /**
   * Casting a spell of 1st level or higher: which slot it is cast with. A
   * higher slot rolls the extra dice its Damage says ("+1d6/level"), and the
   * slot is spent from the spell slot trackers unless told not to (a scroll,
   * a free casting).
   */
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion } from '$lib/motion';
  import { ordinal, spellLevel } from '$lib/rules/spells';
  import { upcasts } from '$lib/rules/spellroll';
  import type { Spell } from '$lib/types';

  let {
    spell,
    slots,
    oncast,
    oncancel,
    themeCss = ''
  }: {
    /** The sheet's accent, since it is moved out from under the sheet. */
    themeCss?: string;
    spell: Spell;
    slots: Map<number, { max: number; left: number }>;
    oncast: (at: number, spend: boolean) => void;
    oncancel: () => void;
  } = $props();

  const still = prefersReducedMotion();
  /** On the body: a frosted panel around it would otherwise frame it. */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
  const base = $derived(spellLevel(spell.level) ?? 1);
  const tracked = $derived(slots.size > 0);
  /** The spell's own level and every level above it the character has slots for. */
  const levels = $derived(
    Array.from({ length: 10 - base }, (_, i) => base + i).filter((l) => !tracked || (slots.get(l)?.max ?? 0) > 0)
  );
  let spend = $state(true);
  const grows = $derived(upcasts(spell.damage));

  let box = $state<HTMLElement>();
  onMount(() => {
    box?.querySelector<HTMLButtonElement>('[data-first]')?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && oncancel();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });
</script>

<div class="scrim themed" style={themeCss} use:portal role="presentation" transition:fade={{ duration: still ? 0 : 140 }}
     onclick={(e) => { if (e.target === e.currentTarget) oncancel(); }}>
  <div class="box" bind:this={box} role="dialog" aria-modal="true" aria-labelledby="cast-title"
       transition:scale={{ start: 0.95, duration: still ? 0 : 180, easing: cubicOut }}>
    <h2 id="cast-title">Cast {spell.name || 'this spell'}</h2>
    <p class="hint">
      {#if grows}A higher slot rolls more dice.{:else}Its damage is the same at any level.{/if}
      {#if !tracked} No spell slot trackers on this sheet, so nothing is spent.{/if}
    </p>
    {#if levels.length === 0}
      <p class="none">Not a slot in sight! Nothing of {ordinal(base)} level or higher on this sheet.</p>
    {/if}
    <div class="levels">
      {#each levels as l, i (l)}
        {@const s = slots.get(l)}
        <button data-first={i === 0 ? '' : undefined} class="lvl" class:empty={tracked && spend && (s?.left ?? 0) === 0}
                onclick={() => oncast(l, tracked && spend && (s?.left ?? 0) > 0)}>
          <b>{ordinal(l)}</b>
          {#if tracked}<span>{s?.left ?? 0} of {s?.max ?? 0} left</span>{/if}
        </button>
      {/each}
    </div>
    {#if tracked}
      <label class="spend"><input type="checkbox" bind:checked={spend} /> Spend a slot</label>
    {/if}
    <div class="row"><button class="cancel" onclick={oncancel}>Cancel</button></div>
  </div>
</div>

<style>
  .scrim {
    position: fixed; inset: 0; z-index: 55; display: grid; place-items: center; padding: 1rem;
    background: rgb(0 0 0 / 0.5); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
  }
  .box {
    width: min(24rem, 100%); background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--r); padding: 1.125rem; box-shadow: 0 20px 60px rgb(0 0 0 / 0.45);
  }
  h2 { margin: 0; font-size: 1.0625rem; font-weight: 650; }
  .hint { margin: 0.25rem 0 0.875rem; color: var(--dim); font-size: 0.8125rem; line-height: 1.45; }
  .none { margin: 0 0 0.75rem; color: var(--dim); font-size: 0.875rem; }
  .levels { display: grid; grid-template-columns: repeat(auto-fill, minmax(5.25rem, 1fr)); gap: 0.375rem; }
  .lvl {
    font: inherit; display: grid; gap: 0.125rem; text-align: center; cursor: pointer;
    background: var(--raised); border: 1px solid var(--line); border-radius: var(--r-sm);
    padding: 0.5rem 0.25rem; color: var(--text);
    transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.08s ease;
  }
  .lvl b { font-size: 0.9375rem; }
  .lvl span { font-size: 0.72rem; color: var(--dim); }
  .lvl:hover { border-color: var(--a-edge); background: var(--a-wash); }
  .lvl:active { transform: translateY(1px); }
  .lvl.empty { opacity: 0.5; }
  .spend { display: flex; align-items: center; gap: 0.4375rem; margin-top: 0.875rem; font-size: 0.875rem; cursor: pointer; }
  .spend input { accent-color: var(--a); width: 1rem; height: 1rem; }
  .row { display: flex; justify-content: flex-end; margin-top: 0.875rem; }
  .cancel {
    font: inherit; font-size: 0.875rem; background: none; border: 1px solid var(--line); color: var(--dim);
    border-radius: var(--r-sm); padding: 0.4375rem 0.875rem; cursor: pointer;
  }
  .cancel:hover { color: var(--text); border-color: var(--a-edge); }
</style>
