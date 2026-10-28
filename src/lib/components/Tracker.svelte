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
    onchange
  }: {
    tracker: Tracker;
    spent: number;
    ctx: FormulaContext;
    editable: boolean;
    refilling?: boolean;
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

  /** Tapping pip n sets the count to n, or to n-1 when it was already there. */
  function tapPip(n: number) {
    if (!editable) return;
    onchange(marked >= n ? n - 1 : n);
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

<div class="tracker" class:refilling>
  <div class="head">
    <span class="label">
      {tracker.label}
      {#if tracker.die}<span class="die">{tracker.die}</span>{/if}
      <EntryLink
        name={tracker.label}
        source={tracker.source}
        category="items"
        override={undefined}
      />
    </span>
    <span class="count">{remaining}<span class="of">/{max}</span></span>
  </div>

  {#if error}
    <p class="error" role="alert">Formula error: {error}</p>
  {:else if tracker.type === 'pips' && max <= 12}
    <div class="pips">
      {#each Array(max) as _, i (i)}
        <button
          class="pip"
          class:on={accrue ? i < marked : i >= marked}
          aria-pressed={accrue ? i < marked : i >= marked}
          aria-label="{tracker.label} {i + 1}"
          disabled={!editable}
          style:--delay="{i * 45}ms"
          onclick={() => tapPip(i + 1)}
        ></button>
      {/each}
    </div>
  {:else}
    <!-- A gauge shows the bar instead of repeating the number, which the
         heading already carries. Both shapes share the same stepper: a gauge
         used to render the bar alone and could never be changed. -->
    {#if tracker.type === 'gauge'}
      <div class="gauge" aria-hidden="true">
        <i style:width="{max > 0 ? (remaining / max) * 100 : 0}%"></i>
      </div>
    {/if}
    <div class="counter" class:spread={tracker.type === 'gauge'}>
      <button disabled={!editable} onclick={() => stepRemaining(-1)} aria-label="Decrease">−</button>
      {#if tracker.type !== 'gauge'}<span class="value">{remaining}</span>{/if}
      <button disabled={!editable} onclick={() => stepRemaining(1)} aria-label="Increase">+</button>
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
  .refilling .pip.on { animation: fill 0.4s backwards; animation-delay: var(--delay); }
  @keyframes fill {
    from { transform: scale(0.4); background: transparent; }
    60%  { transform: scale(1.18); }
    to   { transform: scale(1); }
  }
  .counter { display: flex; align-items: center; gap: 0.6rem; margin-top: 0.4rem; }
  .counter.spread { justify-content: space-between; }
  .counter button {
    width: 1.8rem; height: 1.8rem;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--text);
    border-radius: 5px;
    font-size: 1rem;
    cursor: pointer;
  }
  .value { font-variant-numeric: tabular-nums; font-size: 1.1rem; min-width: 2ch; text-align: center; }
  .gauge { height: 6px; background: var(--bg); border-radius: 3px; overflow: hidden; margin-top: 0.5rem; }
  .gauge i { display: block; height: 100%; background: var(--accent); transition: width 0.3s ease; }
  .desc { margin: 0.4rem 0 0; font-size: 0.78rem; color: var(--dim); }
  .error { margin: 0.4rem 0 0; font-size: 0.78rem; color: var(--bad); }
</style>
