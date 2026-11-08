<script lang="ts">
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { applyRest, healFromHitDice, hitDiceLeft, hitDicePool } from '$lib/rules/rest';
  import { formula as describePool, type Pool, type Roll } from '$lib/rules/dice';
  import { modifierOf } from '$lib/rules/derived';
  import { prefersReducedMotion } from '$lib/motion';
  import { snapshot } from '$lib/stores/undo';
  import { dawn, longRest, shortRest as shortRestSound } from '$lib/sound';

  const SOUNDS: Record<RestKind, () => void> = { short: shortRestSound, long: longRest, dawn };
  import type { Definition, RestKind, State } from '$lib/types';

  let {
    definition,
    state: sheetState,
    editable,
    onchange,
    onrest,
    onroll
  }: {
    definition: Definition;
    state: State;
    editable: boolean;
    onchange: (next: State) => void;
    onrest: (label: string) => void;
    /** Rolls in the dice tray and hears the result. */
    onroll?: (pool: Pool, label: string, then: (r: Roll) => void) => void;
  } = $props();

  /**
   * A short rest spends hit dice: each one rolled with the Constitution
   * modifier, the total healed. How many is the player's call (one to start).
   */
  let spending = $state(false);
  let count = $state(1);
  const left = $derived(hitDiceLeft(definition, sheetState));
  const hurt = $derived((sheetState.hpCurrent ?? 0) < (Number(definition.combat?.hpMax) || 0));
  const pool = $derived(hitDicePool(definition, sheetState, count));
  const con = $derived(modifierOf(definition, 'con'));
  function shortRest() {
    if (left > 0 && hurt && onroll) {
      count = 1;
      spending = !spending;
      return;
    }
    rest('short');
  }
  function rollAndRest() {
    const p = pool;
    if (!p || !onroll) return rest('short');
    const spent = count;
    spending = false;
    onroll(p, `Short rest: ${spent} hit ${spent === 1 ? 'die' : 'dice'}`, (r) => {
      snapshot(sheetState, LABELS.short);
      SOUNDS.short();
      const before = sheetState.hpCurrent ?? 0;
      const healed = healFromHitDice(definition, sheetState, spent, r.total);
      onchange(applyRest(definition, healed, 'short'));
      onrest(`Short Rest taken: healed ${Math.max(0, healed.hpCurrent - before)}`);
    });
  }

  const LABELS: Record<RestKind, string> = {
    short: 'Short Rest',
    long: 'Long Rest',
    dawn: 'Dawn'
  };

  function rest(kind: RestKind) {
    if (!editable) return;
    snapshot(sheetState, LABELS[kind]);
    SOUNDS[kind]();
    onchange(applyRest(definition, sheetState, kind));
    onrest(`${LABELS[kind]} taken`);
  }
</script>

<!-- Resting is the owner's call. To anyone else the buttons are not dimmed,
     they are absent: there is nothing here a visitor can do. -->
{#if editable}
  <div class="rests">
    {#each Object.keys(LABELS) as RestKind[] as kind (kind)}
      <button class:on={kind === 'short' && spending} aria-expanded={kind === 'short' ? spending : undefined}
              onclick={() => (kind === 'short' ? shortRest() : rest(kind))}>{LABELS[kind]}</button>
    {/each}
  </div>
  {#if spending}
    <div class="spend" transition:slide={{ duration: prefersReducedMotion() ? 0 : 220, easing: cubicOut }}
         role="group" aria-label="Spend hit dice">
      <span class="lbl">Hit dice to spend</span>
      <div class="step">
        <button class="sq" aria-label="One fewer" disabled={count <= 1} onclick={() => (count -= 1)}>−</button>
        <b>{count}</b>
        <button class="sq" aria-label="One more" disabled={count >= left} onclick={() => (count += 1)}>+</button>
        <span class="of">of {left} left</span>
      </div>
      <button class="go" onclick={rollAndRest} disabled={!pool}>Roll {pool ? describePool(pool) : ''}</button>
      <button class="plain" onclick={() => { spending = false; rest('short'); }}>Rest without rolling</button>
      <span class="note">Each die adds your Constitution ({con >= 0 ? '+' : '−'}{Math.abs(con)}).</span>
    </div>
  {/if}
{/if}

<style>
  .rests { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  button.on { border-color: var(--accent); color: var(--accent); }
  .spend {
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; margin-top: 0.5rem;
    padding: 0.625rem 0.75rem; border: 1px solid var(--line-soft); border-radius: var(--r-sm); background: var(--raised);
  }
  .lbl { font-size: 0.75rem; color: var(--label); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
  .step { display: flex; align-items: center; gap: 0.375rem; }
  .step b { min-width: 1.5rem; text-align: center; font-variant-numeric: tabular-nums; }
  .sq { padding: 0; width: 1.75rem; height: 1.75rem; display: grid; place-items: center; }
  .of { font-size: 0.8125rem; color: var(--dim); }
  .go { border-color: var(--accent); color: var(--accent); }
  .plain { border-color: transparent; background: none; color: var(--dim); }
  .note { flex-basis: 100%; font-size: 0.75rem; color: var(--dim); }
  button {
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--text);
    border-radius: 6px;
    padding: 0.4rem 0.8rem;
    font: inherit;
    font-size: 0.875rem;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  button:disabled { opacity: 0.5; cursor: default; }
</style>
