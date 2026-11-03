<script lang="ts">
  import EntryLink from './EntryLink.svelte';
  import { trackerUrl } from '$lib/rules/lookup';
  import { brewLoaded } from '$lib/rules/brewClasses';
  import { clampSpent, trackerMax } from '$lib/rules/tracker';
  import { FormulaError } from '$lib/rules/formula';
  import type { FormulaContext } from '$lib/rules/formula';
  import type { Tracker } from '$lib/types';
  import { parseRoll } from '$lib/rules/dice';
  import { fade, slide } from 'svelte/transition';

  let {
    tracker,
    spent,
    ctx,
    editable,
    refilling = false,
    stagger = 0,
    onchange,
    onroll,
    classes = []
  }: {
    /** The character's classes, for the link to a class feature. */
    classes?: { name: string; source?: string }[];
    tracker: Tracker;
    spent: number;
    ctx: FormulaContext;
    editable: boolean;
    refilling?: boolean;
    /** Its place in the rail, so a rest refills trackers one after another. */
    stagger?: number;
    onchange: (spent: number) => void;
    /** Rolls the tracker's die. Given, spending one offers the roll first. */
    onroll?: () => void;
  } = $props();

  /** Only a die that reads as a roll can be offered. */
  const rollable = $derived(Boolean(onroll && tracker.die && parseRoll(tracker.die, 'damage')));
  let asking = $state(false);
  let askTimer: ReturnType<typeof setTimeout> | undefined;
  function offer() {
    if (!rollable) return;
    asking = true;
    clearTimeout(askTimer);
    askTimer = setTimeout(() => (asking = false), 6000);
  }
  function answer(roll: boolean) {
    clearTimeout(askTimer);
    asking = false;
    if (roll) onroll?.();
  }
  $effect(() => () => { clearTimeout(askTimer); clearTimeout(waveTimer); });
  // Leaving edit rights (or the owner's view) drops the question.
  $effect(() => { if (!editable) asking = false; });

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
    // Set at once, before the frame paints, so the first pip moves the
    // instant it is tapped. Only a wave still running is cleared for a frame
    // first, so its animations restart.
    clearTimeout(waveTimer);
    const next = { from, to: now };
    if (wave) {
      wave = null;
      requestAnimationFrame(() => (wave = next));
    } else wave = next;
    waveTimer = setTimeout(() => (wave = null), 900);
    // The last one used: the tracker gives a small shake.
    if (now === 0 && from > 0 && !accrue) {
      emptied = false;
      requestAnimationFrame(() => (emptied = true));
      clearTimeout(emptyTimer);
      emptyTimer = setTimeout(() => (emptied = false), 600);
    }
  });
  let waveTimer: ReturnType<typeof setTimeout> | undefined;
  let emptied = $state(false);
  let emptyTimer: ReturnType<typeof setTimeout> | undefined;

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
    // Read before the change: the parent updates `remaining` at once.
    const was = remaining;
    const next = was === n ? n - 1 : n;
    onchange(clampSpent(accrue ? next : max - next, max));
    if (!accrue && next < was) offer();
  }

  /**
   * Steps what the reader sees — the remaining count — and converts back to the
   * stored spent count. On a spend tracker those run in opposite directions, so
   * stepping the stored number directly made "Decrease" raise the display.
   */
  function stepRemaining(delta: number) {
    if (!editable) return;
    const was = remaining;
    const next = was + delta;
    onchange(clampSpent(accrue ? next : max - next, max));
    if (!accrue && delta < 0 && was > 0) offer();
  }
</script>

<div class="tracker" class:refilling class:emptied style:--stagger={stagger}>
  <div class="head">
    <span class="label" title={tracker.description || undefined}>
      {tracker.label}
      {#if tracker.die}<span class="die">{tracker.die}</span>{/if}
      <EntryLink
        name={tracker.label}
        source={tracker.source}
        category="any"
        override={($brewLoaded >= 0 && trackerUrl(tracker, classes)) || undefined}
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
          style:--delay="{(r?.order ?? 0) * (r?.kind === 'lose' ? 22 : 60) + (refilling ? stagger * 110 : 0)}ms"
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
        <i style:transform="scaleX({max > 0 ? remaining / max : 0})"></i>
      </div>
      <button class="step" disabled={!editable} onclick={() => stepRemaining(1)}
              aria-label="Increase">+</button>
    </div>
  {/if}

  {#if asking}
    <div class="ask" role="group" aria-label="Roll {tracker.die}?" transition:slide={{ duration: 180 }}>
      <span in:fade={{ duration: 160, delay: 60 }}>Roll {tracker.die}?</span>
      <button class="yes" onclick={() => answer(true)}>Roll</button>
      <button class="no" onclick={() => answer(false)}>No</button>
    </div>
  {/if}
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
    position: relative;
    transition: border-color 0.16s ease-out, transform 0.18s ease;
  }
  /* The fill is a layer whose opacity moves. Animating the theme's accent as
     a colour either overshot or switched at once, so a spent pip held its
     colour, then vanished. */
  .pip::before {
    content: ''; position: absolute; inset: -1px; border-radius: 50%; pointer-events: none;
    background: var(--accent); opacity: 0;
    transition: opacity 0.16s ease-out;
  }
  .pip.on { border-color: var(--accent); }
  .pip.on::before { opacity: 1; }
  /* Invisible before and after its turn: a wave of several pips puffs one at
     a time, never all showing a ring while they wait. */
  .pip.lose::after {
    content: ''; position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
    background: var(--accent); opacity: 0;
    animation: puff 0.36s cubic-bezier(0.2, 0.7, 0.3, 1) both; animation-delay: var(--delay);
  }
  /* A soft cloud of the pip's colour, swelling and thinning to nothing. */
  @keyframes puff {
    0% { opacity: 0; transform: scale(0.8); }
    15% { opacity: 0.4; transform: scale(1.05); }
    100% { opacity: 0; transform: scale(2); }
  }
  /* The last one gone: a small shake of the whole tracker. */
  .tracker.emptied { animation: emptyShake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  @keyframes emptyShake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-4px); }
    40% { transform: translateX(4px); }
    60% { transform: translateX(-2px); }
    80% { transform: translateX(2px); }
  }
  @media (prefers-reduced-motion: reduce) { .tracker.emptied, .pip.lose::after { animation: none; } }
  .pip:disabled { cursor: default; }
  .pip.gain { animation: fill 0.42s backwards; animation-delay: var(--delay); }
  .pip.gain::before { transition-delay: var(--delay); }
  /* Spending is quick: the fill fades from the first frame, a few
     hundredths of a second apart, while the pip gives a small dip. */
  .pip.lose { animation: drain 0.2s ease-out; animation-delay: var(--delay); transition-delay: var(--delay); }
  .pip.lose::before { animation: drain-fill 0.16s ease-out backwards; animation-delay: var(--delay); }
  @keyframes fill {
    from { transform: scale(0.4); }
    60%  { transform: scale(1.22); }
    to   { transform: scale(1); }
  }
  @keyframes drain { 50% { transform: scale(0.8); } }
  @keyframes drain-fill { from { opacity: 1; } to { opacity: 0; } }
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
  /* Scaled, not resized: a width change lays out and repaints the panel
     every frame (and re-frosts it over a banner), which stuttered on phones. */
  .gauge i {
    display: block; height: 100%; background: var(--accent);
    transform-origin: left center; will-change: transform;
    transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.3, 1);
  }
  .refilling .gauge i { transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) calc(var(--stagger, 0) * 110ms); }
  .ask {
    display: flex; align-items: center; gap: 0.4rem; margin-top: 0.5rem;
    font-size: 0.8rem; color: var(--dim);
  }
  .ask span { flex: 1; }
  .ask button {
    font: inherit; font-size: 0.78rem; padding: 0.15rem 0.6rem; cursor: pointer;
    border-radius: var(--r-sm); border: 1px solid var(--line); background: var(--bg); color: var(--text);
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .ask .yes { border-color: var(--a-edge); color: var(--a); }
  .ask button:hover { border-color: var(--a-edge); }
  .error { margin: 0.4rem 0 0; font-size: 0.78rem; color: var(--bad); }
</style>
