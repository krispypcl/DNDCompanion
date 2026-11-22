<script lang="ts">
  /**
   * Casting a spell from its Roll: one small dialog with everything the cast
   * needs. A spell of 1st level or higher picks the slot first (each level
   * shows what it would roll there and how many slots are left); then the
   * attack roll, if the spell has no save, and the damage or healing roll.
   * The slot is spent once, by whichever is rolled first.
   */
  import { backdrop, movable, portal } from '#lib/actions.ts';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { prefersReducedMotion, windowMotion } from '#lib/motion.ts';
  import { formula } from '#lib/rules/dice.ts';
  import { ordinal, spellLevel } from '#lib/rules/spells.ts';
  import { spellDamage } from '#lib/rules/spellroll.ts';
  import type { Spell } from '#lib/types.ts';

  let {
    spell,
    slots,
    attack = null,
    saveDc = null,
    characterLevel = 1,
    onroll,
    oncancel,
    themeCss = ''
  }: {
    spell: Spell;
    slots: Map<number, { max: number; left: number }>;
    /** The spell attack bonus, when there is one. */
    attack?: number | null;
    saveDc?: number | null;
    characterLevel?: number;
    /** Roll the attack or the damage, cast at `at` (null for a cantrip). */
    onroll: (kind: 'attack' | 'damage', at: number | null, spend: boolean) => void;
    oncancel: () => void;
    /** The sheet's accent, since it is moved out from under the sheet. */
    themeCss?: string;
  } = $props();

  const still = prefersReducedMotion();

  const base = $derived(spellLevel(spell.level));
  const leveled = $derived(base !== null && base > 0);
  const tracked = $derived(slots.size > 0);
  /** The spell's own level and every level above it the character has slots for. */
  const levels = $derived(
    leveled
      ? Array.from({ length: 10 - base! }, (_, i) => base! + i).filter((l) => !tracked || (slots.get(l)?.max ?? 0) > 0)
      : []
  );
  // The lowest level with a slot left, or simply the lowest.
  let at = $state<number | null>(null);
  $effect(() => {
    if (at !== null && levels.includes(at)) return;
    at = levels.find((l) => !tracked || (slots.get(l)?.left ?? 0) > 0) ?? levels[0] ?? null;
  });
  let spend = $state(true);
  let spent = $state(false);
  const left = $derived(at !== null ? (slots.get(at)?.left ?? 0) : 0);
  const willSpend = $derived(leveled && tracked && spend && !spent && left > 0);

  const damage = $derived(spellDamage(spell.damage, base, at, characterLevel));
  const preview = (l: number) => {
    const p = spellDamage(spell.damage, base, l, characterLevel);
    return p ? formula(p) : '';
  };
  const save = $derived(String(spell.save ?? '').trim());
  const sign = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

  function rollIt(kind: 'attack' | 'damage') {
    onroll(kind, leveled ? at : null, willSpend);
    if (willSpend) spent = true;
  }

  let box = $state<HTMLElement>();
  onMount(() => {
    box?.querySelector<HTMLButtonElement>('[data-first]')?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && oncancel();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });
</script>

<div class="scrim themed" style={themeCss} use:portal role="presentation" transition:fade={{ duration: still ? 0 : 140 }}
     use:backdrop={oncancel}>
  <div class="box" bind:this={box} use:movable role="dialog" aria-modal="true" aria-labelledby="cast-title"
       transition:windowMotion={{ start: 0.95, duration: 180 }}>
    <!-- Closed by the × at the top right (or Esc, or a press outside). -->
    <div class="head"><h2 id="cast-title">Cast {spell.name || 'this spell'}</h2><button class="closex" aria-label={spent ? 'Close' : 'Cancel'} title="Close (Esc)" onclick={oncancel}>×</button></div>
    {#if save}
      <p class="hint">{save} save{saveDc != null && !/\d/.test(save) ? `, DC ${saveDc}` : ''}</p>
    {/if}

    {#if leveled}
      <h3>Slot</h3>
      {#if levels.length === 0}
        <p class="none">Not a slot in sight! Nothing of {ordinal(base!)} level or higher on this sheet.</p>
      {:else}
        <div class="levels" role="radiogroup" aria-label="Slot level">
          {#each levels as l (l)}
            {@const s = slots.get(l)}
            <button role="radio" aria-checked={at === l} class="lvl" class:on={at === l}
                    class:empty={tracked && (s?.left ?? 0) === 0} onclick={() => (at = l)}>
              <b>{ordinal(l)}</b>
              <span>{preview(l)}</span>
              {#if tracked}<small>{s?.left ?? 0} of {s?.max ?? 0} left</small>{/if}
            </button>
          {/each}
        </div>
        {#if tracked}
          <label class="spend">
            <input type="checkbox" bind:checked={spend} disabled={spent} />
            {spent ? 'Slot spent' : left > 0 ? 'Spend a slot' : 'None left: casting without one'}
          </label>
        {/if}
      {/if}
    {/if}

    <div class="actions">
      {#if !save && attack !== null}
        <button class="attack" data-first={damage ? undefined : ''} onclick={() => rollIt('attack')}>
          Attack <b>{sign(attack)}</b>
        </button>
      {/if}
      {#if damage}
        <button class="roll" data-first="" onclick={() => { rollIt('damage'); oncancel(); }}>
          Roll <b>{formula(damage)}</b>
        </button>
      {/if}
    </div>
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
  .head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
  h3 {
    margin: 0.875rem 0 0.4375rem; font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--label); font-weight: 600;
  }
  .hint { margin: 0.25rem 0 0; color: var(--dim); font-size: 0.8125rem; line-height: 1.45; }
  .none { margin: 0; color: var(--dim); font-size: 0.875rem; }
  .levels { display: grid; grid-template-columns: repeat(auto-fill, minmax(5.25rem, 1fr)); gap: 0.375rem; }
  .lvl {
    font: inherit; display: grid; gap: 0.125rem; text-align: center; cursor: pointer;
    background: var(--raised); border: 1px solid var(--line); border-radius: var(--r-sm);
    padding: 0.5rem 0.25rem; color: var(--text);
    transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.08s ease;
  }
  .lvl b { font-size: 0.9375rem; }
  .lvl span { font-size: 0.75rem; font-variant-numeric: tabular-nums; }
  .lvl small { font-size: 0.6875rem; color: var(--dim); }
  .lvl:hover { border-color: var(--a-edge); }
  .lvl.on { border-color: var(--a); background: var(--a-wash); }
  .lvl:active { transform: translateY(1px); }
  .lvl.empty:not(.on) { opacity: 0.5; }
  .spend { display: flex; align-items: center; gap: 0.4375rem; margin-top: 0.75rem; font-size: 0.875rem; cursor: pointer; }
  .spend input { accent-color: var(--a); width: 1rem; height: 1rem; }
  .actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
  .actions button {
    flex: 1; font: inherit; font-size: 0.9375rem; cursor: pointer; border-radius: var(--r-sm);
    padding: 0.625rem 0.75rem; border: 1px solid var(--line); background: var(--raised); color: var(--text);
    transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.08s ease;
  }
  .actions b { font-variant-numeric: tabular-nums; }
  .actions .roll { border-color: var(--a-edge); background: var(--a-wash); color: var(--a); }
  .actions button:hover { border-color: var(--a); }
  .actions button:active { transform: translateY(1px); }
  /* No frost on a phone: the bars above stay sharp. */
  @media (max-width: 700px) { .scrim { backdrop-filter: none; -webkit-backdrop-filter: none; } }
  /* A phone: a sheet from the bottom, the full width, its top rounded. */
  @media (max-width: 700px) {
    .scrim { place-items: end stretch; padding: 0; }
    .box {
      width: 100%; max-height: 90dvh; overflow-y: auto; overscroll-behavior: contain;
      border-radius: 1.125rem 1.125rem 0 0; border-bottom: 0;
      padding-bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
    }
  }
</style>
