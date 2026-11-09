<script lang="ts">
  import { fade } from 'svelte/transition';
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
    spending = false;
    // None spent: a rest that heals nothing, the other short-rest things still happen.
    if (!p || !onroll || count < 1) return rest('short');
    const spent = count;
    onroll(p, `Short rest: ${spent} hit ${spent === 1 ? 'die' : 'dice'}`, (r) => {
      snapshot(sheetState, LABELS.short);
      SOUNDS.short();
      const before = sheetState.hpCurrent ?? 0;
      const healed = healFromHitDice(definition, sheetState, spent, r.total);
      onchange(applyRest(definition, healed, 'short'));
      onrest(`Short Rest taken: healed ${Math.max(0, healed.hpCurrent - before)}`);
    });
  }
  const swap = () => ({ duration: prefersReducedMotion() ? 0 : 160 });

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
  <!-- Spending hit dice takes the buttons' place, the same size exactly. -->
  <div class="restbox">
    <div class="rests" class:away={spending} inert={spending}>
      {#each Object.keys(LABELS) as RestKind[] as kind (kind)}
        <button aria-expanded={kind === 'short' ? spending : undefined}
                onclick={() => (kind === 'short' ? shortRest() : rest(kind))}>{LABELS[kind]}</button>
      {/each}
    </div>
    {#if spending}
      <div class="spend" role="group" aria-label="Spend hit dice on a short rest" transition:fade={swap()}>
        <button class="sq cancel" aria-label="Cancel the short rest" title="Cancel" onclick={() => (spending = false)}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
        </button>
        <div class="step" title="Hit dice to spend, of {left} left">
          <button class="sq" aria-label="One fewer hit die" disabled={count <= 0} onclick={() => (count -= 1)}>−</button>
          <b aria-label="{count} of {left} hit dice">{count}<small>/{left}</small></b>
          <button class="sq" aria-label="One more hit die" disabled={count >= left} onclick={() => (count += 1)}>+</button>
        </div>
        <button class="go" onclick={rollAndRest}
                title={count ? `Each die adds your Constitution (${con >= 0 ? '+' : '−'}${Math.abs(con)})` : 'Rest without spending hit dice'}>
          {count && pool ? `Roll ${describePool(pool)}` : 'Rest'}
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Both in one cell: the spend row lies over the buttons and is as big. */
  .restbox { display: grid; }
  .rests, .spend { grid-area: 1 / 1; min-width: 0; }
  .rests { display: flex; gap: 0.4rem; flex-wrap: wrap; transition: opacity 0.16s ease; }
  .rests.away { opacity: 0; }
  .spend { display: flex; align-items: stretch; gap: 0.4rem; }
  .step {
    flex: 1; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 0.25rem;
    border: 1px solid var(--line); border-radius: 6px; background: var(--surface); padding: 0 0.1875rem;
  }
  .step b { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .step small { font-weight: 400; color: var(--dim); font-size: 0.8em; }
  .step .sq { border: 0; background: none; padding: 0 0.375rem; }
  .sq { padding: 0 0.5rem; display: grid; place-items: center; }
  .go { flex: 1.4; min-width: 0; border-color: var(--accent); color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cancel { color: var(--dim); }
  button {
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--text);
    border-radius: 6px;
    padding: 0.4rem 0.8rem;
    font: inherit;
    font-size: 0.875rem;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.08s ease;
  }
  button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  button:disabled { opacity: 0.5; cursor: default; }
  button:active:not(:disabled) { transform: translateY(1px); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .step .sq:hover:not(:disabled) { background: var(--a-wash); }
  .cancel:hover:not(:disabled) { color: var(--bad); border-color: var(--bad); }
</style>
