<script lang="ts">
  import EntryLink from './EntryLink.svelte';
  import { clampSpent, trackerMax } from '$lib/rules/tracker';
  import { FormulaError } from '$lib/rules/formula';
  import type { FormulaContext } from '$lib/rules/formula';
  import type { Tracker } from '$lib/types';

  let {
    tracker,
    spent,
    ctx,
    editable,
    refilling = false,
    stagger = 0,
    onchange
  }: {
    tracker: Tracker;
    spent: number;
    ctx: FormulaContext;
    editable: boolean;
    refilling?: boolean;
    /** Its place in the rail, so a rest refills trackers one after another. */
    stagger?: number;
    onchange: (spent: number) => void;
  } = $props();

  // One derived value carries both results. Assigning to separate $state from
  // inside a $derived is forbidden in Svelte 5 and throws at render time.
  const computed = $derived.by(() => {
    try {
      return { max: trackerMax(tracker, ctx), error: null as string | null };
    } catch (e) {
      return { max: 0, error: e instanceof FormulaError ? e.message : 'Bad formula' };
    }
  });

  const max = $derived(computed.max);
  const error = $derived(computed.error);

  const marked = $derived(clampSpent(spent, max));
  const accrue = $derived(tracker.direction === 'accrue');
  const remaining = $derived(accrue ? marked : max - marked);

  /**
   * When the count changes, the pips that changed light or go out one after
   * another, in the direction of travel, rather than all at once. A rest
   * that refills four slots reads as four slots coming back.
   */
  let wave = $state<{ from: number; to: number } | null>(null);
  let before = -1;
  $effect(() => {
    const now = remaining;
    if (before === -1 || before === now) {
      before = now;
      return;
    }
    const from = before;
    before = now;
    // Off then on across a frame, so a second change restarts the wave.
    wave = null;
    requestAnimationFrame(() => (wave = { from, to: now }));
  });

  /** This pip's part in the wave: whether it lit or went out, and its turn. */
  function ripple(i: number): { kind: 'gain' | 'lose'; order: number } | null {
    if (!wave) return null;
    const { from, to } = wave;
    if (to > from && i >= from && i < to) return { kind: 'gain', order: i - from };
    if (to < from && i >= to && i < from) return { kind: 'lose', order: from - 1 - i };
    return null;
  }

  /**
   * Pips show what is left, filled from the left, so spending empties the
   * right-hand end. Tapping pip n leaves n remaining — or n-1 when n is
   * already the last lit one, so tapping the first pip twice empties it.
   */
  function tapPip(n: number) {
    if (!editable) return;
    const next = remaining === n ? n - 1 : n;
    onchange(clampSpent(accrue ? next : max - next, max));
  }

  /**
   * Steps what the reader sees — the remaining count — and converts back to the
   * stored spent count. On a spend tracker those run in opposite directions, so
   * stepping the stored number directly made "Decrease" raise the display.
   */
  function stepRemaining(delta: number) {
    if (!editable) return;
    const next = remaining + delta;
    onchange(clampSpent(accrue ? next : max - next, max));
  }
</script>

<div class="tracker" class:refilling style:--stagger={stagger}>
  <div class="head">
    <span class="label">
      {tracker.label}
      {#if tracker.die}<span class="die">{tracker.die}</span>{/if}
      <EntryLink
        name={tracker.label}
        source={tracker.source}
        category="any"
        override={undefined}
      />
    </span>
    <span class="count">{remaining}<span class="of">/{max}</span></span>
  </div>

  {#if error}
    <p class="error" role="alert">That formula fumbled! {error}.</p>
  {:else if tracker.type === 'pips' && max <= 12 && max > 0}
    <div class="pips">
      {#each Array(max) as _, i (i)}
        {@const r = ripple(i)}
        <button
          class="pip {r?.kind ?? ''}"
          class:on={i < remaining}
          aria-pressed={i < remaining}
          aria-label="{tracker.label} {i + 1}"
          disabled={!editable}
          style:--delay="{(r?.order ?? 0) * 60 + (refilling ? stagger * 110 : 0)}ms"
          onclick={() => tapPip(i + 1)}
        ></button>
      {/each}
    </div>
  {:else}
    <!-- A gauge: the bar between its two controls, which is where you reach
         for them. The heading already carries the number. -->
    <div class="gaugerow">
      <button class="step" disabled={!editable} onclick={() => stepRemaining(-1)}
              aria-label="Decrease">−</button>
      <div class="gauge" aria-hidden="true">
        <i style:width="{max > 0 ? (remaining / max) * 100 : 0}%"></i>
      </div>
      <button class="step" disabled={!editable} onclick={() => stepRemaining(1)}
              aria-label="Increase">+</button>
    </div>
  {/if}

  {#if tracker.description}<p class="desc">{tracker.description}</p>{/if}
</div>

<style>
  .tracker {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.6rem 0.75rem 0.7rem;
    background: var(--surface);
    min-width: 0;
  }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
  .label { font-size: 0.9rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.3rem; }
  .die { font-size: 0.7rem; color: var(--dim); font-weight: 400; }
  .count { font-variant-numeric: tabular-nums; font-size: 0.95rem; }
  .of { color: var(--dim); font-size: 0.78rem; }
  .pips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; }
  .pip {
    width: 1.15rem;
    height: 1.15rem;
    border-radius: 50%;
    border: 1px solid var(--dim);
    background: transparent;
    padding: 0;
    cursor: pointer;
    transition: background 0.18s cubic-bezier(0.2, 1.4, 0.4, 1), transform 0.18s ease;
  }
  .pip.on { background: var(--accent); border-color: var(--accent); }
  .pip:disabled { cursor: default; }
  .pip.gain { animation: fill 0.42s backwards; animation-delay: var(--delay); }
  .pip.lose { animation: drain 0.36s backwards; animation-delay: var(--delay); }
  @keyframes fill {
    from { transform: scale(0.4); background: transparent; border-color: var(--dim); }
    60%  { transform: scale(1.22); }
    to   { transform: scale(1); }
  }
  @keyframes drain {
    from { transform: scale(1); background: var(--accent); border-color: var(--accent); }
    45%  { transform: scale(0.7); background: var(--accent); border-color: var(--accent); }
    to   { transform: scale(1); }
  }
  .gaugerow { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
  .step {
    width: 1.5rem; height: 1.5rem; flex: none;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--text);
    border-radius: var(--r-sm);
    font-size: 0.9rem; line-height: 1;
    display: grid; place-items: center;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .step:not(:disabled):hover { border-color: var(--a-edge); color: var(--a); }
  .step:disabled { cursor: default; opacity: 0.5; }
  .gauge { flex: 1; height: 8px; background: var(--bg); border-radius: 4px; overflow: hidden; }
  .gauge i { display: block; height: 100%; background: var(--accent); transition: width 0.3s ease; }
  .refilling .gauge i { transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1) calc(var(--stagger, 0) * 110ms); }
  .desc { margin: 0.4rem 0 0; font-size: 0.78rem; color: var(--dim); }
  .error { margin: 0.4rem 0 0; font-size: 0.78rem; color: var(--bad); }
</style>
