<!--
  The initiative order (rules/initiative, lib/initiative): everyone at the
  table, highest first, whose turn it is lit, and the round. The DM calls for
  initiative, the players roll (or write) their own characters' numbers, the
  DM rolls the rest, starts the fight and moves the turn on; everyone
  follows it live.
-->
<script lang="ts">
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import { prefersReducedMotion } from '#lib/motion.ts';
  import { ordered, type InitiativeRow } from '#lib/rules/initiative.ts';
  import SectionHead from './SectionHead.svelte';

  let {
    combatants,
    turn,
    round,
    asking = false,
    isDm,
    onvalue,
    onrollone,
    onask,
    oncancel,
    onstart,
    onnext,
    onprevious,
    onend,
    onrollrest
  }: {
    combatants: InitiativeRow[];
    turn: string | null;
    round: number;
    /** The DM has called for initiative: the players roll theirs. */
    asking?: boolean;
    isDm: boolean;
    /** A number written in (the DM's for anyone, a player's for their own). */
    onvalue?: (key: string, value: number | null) => void;
    /** Rolls a d20 for this one (with what it adds). */
    onrollone?: (key: string) => void;
    onask?: () => void;
    /** The DM stops calling for initiative: the call and what was rolled for it are cleared. */
    oncancel?: () => void;
    onstart?: () => void;
    onnext?: () => void;
    onprevious?: () => void;
    onend?: () => void;
    /** Rolls for everyone still without a number. */
    onrollrest?: () => void;
  } = $props();

  const list = $derived(ordered(combatants) as InitiativeRow[]);
  const running = $derived(Boolean(turn));
  /** Whose turn it is is someone the players can't see. */
  const unseenTurn = $derived(running && !list.some((c) => c.key === turn));
  const waiting = $derived(list.filter((c) => c.side === 'pc' && c.value === null).length);
  const mineToRoll = $derived(list.filter((c) => c.mine && c.value === null));
  const still = prefersReducedMotion();
  const quick = { duration: still ? 0 : 200, easing: cubicOut };
  const canWrite = (c: InitiativeRow) => isDm || Boolean(c.mine);
  function write(key: string, v: string) {
    const n = Number(v);
    onvalue?.(key, v.trim() === '' || !Number.isFinite(n) ? null : Math.max(-50, Math.min(100, Math.round(n))));
  }

  /**
   * Folded away while it isn't in use (no call, no fight), like the table
   * board, with only Call for initiative left out; it opens by itself when
   * the DM calls or a fight starts. Its title still folds or opens it by hand
   * in between.
   */
  const idle = $derived(!running && !asking);
  let byHand = $state<boolean | null>(null);
  $effect(() => {
    idle;
    byHand = null;
  });
  const folded = $derived(isDm && (byHand ?? idle));
  let foldInner = $state(0);
  /** What the table is waiting for, beside the buttons. */
  const status = $derived.by(() => {
    if (!asking || running) return '';
    if (isDm) return waiting === 0 ? 'Every character has rolled.' : waiting === 1 ? 'Waiting on 1 character.' : `Waiting on ${waiting} characters.`;
    if (mineToRoll.length) return 'Roll for initiative!';
    if (list.some((c) => c.mine)) return 'You’re in the order. The fight starts soon.';
    return 'The DM calls for initiative.';
  });
</script>

<section class="initiative" aria-label="Initiative">
  <SectionHead title="Initiative" folded={isDm ? folded : undefined} controls="init-fold"
               ontoggle={isDm ? () => (byHand = !folded) : undefined}>
    {#snippet info()}
      {#if isDm}
        Call for initiative and your players roll theirs here, on the campaign page. Write any number in yourself, or
        roll the rest. Start, then Next turn moves it on; your players see the order and whose turn it is, with only
        the monsters and NPCs you’ve revealed.
      {:else}
        Your DM runs the order. When they call for initiative, roll yours here, or write in what your own dice gave.
      {/if}
    {/snippet}
    {#if running}<span class="round" in:fade={quick}>Round {round}</span>{/if}
    {#snippet end()}
      {#if status}
        {#key status}<span class="initcall" role="status" in:fade={quick}>{status}</span>{/key}
      {/if}
      {#if isDm}
        {#if running}
          <button class="smallbtn" onclick={onprevious} aria-label="Previous turn" title="Previous turn">
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <button class="smallbtn accent" onclick={onnext}>Next turn</button>
          <button class="smallbtn quiet" onclick={onend}>End</button>
        {:else if !asking}
          <button class="smallbtn" onclick={onask}>Call for initiative</button>
          {#if !folded}
            {#if onrollrest && list.some((c) => c.value === null)}<button class="smallbtn" onclick={onrollrest}>Roll the rest</button>{/if}
            <button class="smallbtn accent" onclick={onstart} disabled={!list.some((c) => c.value !== null)}>Start</button>
          {/if}
        {:else}
          {#if oncancel}
            <button class="smallbtn quiet" onclick={oncancel} title="Stop calling for initiative and clear what was rolled">Cancel</button>
          {/if}
          {#if onrollrest && list.some((c) => c.value === null)}<button class="smallbtn" onclick={onrollrest}>Roll the rest</button>{/if}
          <button class="smallbtn accent" onclick={onstart} disabled={!list.some((c) => c.value !== null)}>Start</button>
        {/if}
      {/if}
    {/snippet}
  </SectionHead>

  <!-- Folding eases the height to nothing, as the table board's does. -->
  <div class="initfold" id="init-fold" class:folded inert={folded}
       style:height={isDm && (folded || foldInner) ? `${folded ? 0 : foldInner}px` : undefined}>
  <div bind:clientHeight={foldInner}>
  <ol class="initlist">
    {#each list as c (c.key)}
      <li class="initrow" class:initcr={c.side === 'creature'} class:now={c.key === turn} class:waiting={c.value === null}
          class:hiddenone={c.hidden} class:mine={c.mine}
          animate:flip={{ duration: still ? 0 : 260, easing: cubicOut }} in:fade={{ duration: still ? 0 : 160 }}>
        {#if canWrite(c)}
          <input class="numfield" type="number" inputmode="numeric" aria-label="{c.name}’s initiative" value={c.value ?? ''} placeholder="–"
                 onchange={(e) => write(c.key, e.currentTarget.value)} />
        {:else}
          <b class="initvalue">{c.value ?? '–'}</b>
        {/if}
        <span class="initname">{c.name}</span>
        {#if c.value === null && canWrite(c) && onrollone && c.side === 'pc'}
          <button class="initroll" onclick={() => onrollone?.(c.key)} aria-label="Roll {c.name}’s initiative" title="Roll a d20 with what it adds">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 2.5 20.5 7.5v9L12 21.5 3.5 16.5v-9z M12 2.5 7.5 15h9z M3.5 7.5 7.5 15 3.5 16.5 M20.5 7.5 16.5 15l4 1.5 M7.5 15 12 21.5 16.5 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /></svg>
            Roll
          </button>
        {/if}
        {#if c.hidden}<span class="inittag" title="Hidden from your players">hidden</span>{/if}
        {#if c.key === turn}<span class="initnow" in:fade={quick}>Now</span>{/if}
      </li>
    {/each}
    {#if unseenTurn}
      <li class="initrow now unseen" in:fade={quick}><span class="initname">Something unseen acts</span><span class="initnow">Now</span></li>
    {/if}
  </ol>
  </div>
  </div>
</section>

<style>
  .initiative { min-width: 0; }
  .round { font-size: 0.8125rem; color: var(--a); font-weight: 650; }
  .initcall { font-size: 0.8125rem; font-weight: 600; color: var(--a); margin-right: 0.25rem; }
  .initfold { overflow: clip; overflow-clip-margin: 6px; transition: height 0.32s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.26s ease; }
  .initfold.folded { opacity: 0; }
  @media (prefers-reduced-motion: reduce) { .initfold { transition: none; } }
  .initlist { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .initrow {
    display: inline-flex; align-items: center; gap: 0.4375rem; padding: 0.25rem 0.625rem 0.25rem 0.25rem;
    border-radius: 999px; border: 1px solid var(--line-soft); background: var(--raised); font-size: 0.8125rem;
    transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  }
  .initrow.initcr { border-style: dashed; }
  .initrow.waiting:not(.mine) { opacity: 0.6; }
  .initrow.mine { border-color: var(--a-edge); }
  .initrow.hiddenone .initname { color: var(--dim); }
  .initrow.unseen { padding-left: 0.625rem; font-style: italic; }
  .initrow.now { border-color: var(--a-edge); background: var(--a-wash); box-shadow: 0 0 0 2px color-mix(in oklch, var(--a) 30%, transparent); }
  .initrow input {
    width: 2.75rem; padding: 0.125rem 0.25rem; text-align: center; font: inherit; font-size: 0.8125rem; font-weight: 650;
    color: var(--text); border: 1px solid var(--line); border-radius: 999px; background: var(--bg);
  }
  .initrow input:focus { outline: none; border-color: var(--a-edge); }
  .initvalue { min-width: 1.75rem; text-align: center; font-variant-numeric: tabular-nums; }
  .initname { font-weight: 600; overflow-wrap: anywhere; }
  .initroll {
    display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.0625rem 0.5rem; font: inherit; font-size: 0.75rem; font-weight: 600;
    color: var(--a); background: var(--a-wash); border: 1px solid var(--a-edge); border-radius: 999px; cursor: pointer;
    transition: background-color 0.15s ease, transform 0.08s ease;
  }
  .initroll:hover { background: color-mix(in oklch, var(--a) 22%, transparent); }
  .initroll:active { transform: translateY(1px); }
  .initroll:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
  .inittag { font-size: 0.625rem; color: var(--dim); letter-spacing: 0.06em; text-transform: uppercase; }
  .initnow { font-size: 0.625rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--a); }
</style>
