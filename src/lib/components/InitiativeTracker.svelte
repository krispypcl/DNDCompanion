<!--
  The initiative order (rules/initiative, lib/initiative): everyone at the
  table, highest first, whose turn it is lit, and the round. The DM calls for
  initiative, the players roll (or write) their own characters' numbers, the
  DM rolls the rest, starts the fight, and moves the turn on; everyone
  follows it live. A tie is settled by dragging (rules/initiative): the DM
  moves a monster or NPC, a player their own character among the characters.
-->
<script lang="ts">
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { fade, prefersReducedMotion } from '#lib/motion.ts';
  import { reorder } from '#lib/reorder.ts';
  import { canSettle, next as nextTurn, ordered, settleOrder, settleScores, type InitiativeRow } from '#lib/rules/initiative.ts';
  import ClassIcon from './ClassIcon.svelte';
  import CreatureMark from './CreatureMark.svelte';
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
    onrollrest,
    onsettle,
    docked = false
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
    /** A tie settled by dragging: the scores to keep (rules/initiative settleScores). */
    onsettle?: (ties: Record<string, number>) => void;
    /** A phone: Back and Next turn are docked at the bottom, so they leave the title row. */
    docked?: boolean;
  } = $props();

  const list = $derived(ordered(combatants));
  // ── Ties, settled by dragging (lib/reorder): shown as it moves, kept on letting go.
  let preview = $state<string[] | null>(null);
  let dragging = '';
  const shown = $derived.by(() => {
    if (!preview) return list;
    const by = new Map(list.map((c) => [c.key, c]));
    return preview.flatMap((k) => by.get(k) ?? []);
  });
  const settleable = (key: string) => Boolean(onsettle) && canSettle(combatants, key, isDm);
  const running = $derived(Boolean(turn));
  /** Who has had their turn this round (before whoever's it is), and who comes next. */
  const played = $derived(list.filter((c) => c.value !== null).map((c) => c.key));
  const turnAt = $derived(turn ? played.indexOf(turn) : -1);
  const acted = (key: string) => turnAt > 0 && played.indexOf(key) > -1 && played.indexOf(key) < turnAt;
  const upNext = $derived(running && played.length > 1 ? nextTurn(combatants, { turn, round }).turn : null);
  const sideOf = (c: InitiativeRow) => (c.side === 'pc' ? 'Character' : c.kind === 'npc' ? 'NPC' : 'Monster');
  /** Whose turn it is is someone the players can't see. */
  const unseenTurn = $derived(running && !list.some((c) => c.key === turn));
  const waiting = $derived(list.filter((c) => c.side === 'pc' && c.value === null).length);
  const mineToRoll = $derived(list.filter((c) => c.mine && c.value === null));
  const still = prefersReducedMotion();
  const quick = { duration: still ? 0 : 200, easing: cubicOut };
  /**
   * The lamp: the lit frame and left bar of whose turn it is, drawn once
   * behind the tiles and moved from one to the next, so a turn passing reads
   * as the light travelling down the order rather than one tile going out and
   * another coming on. It wears the current character's own color.
   */
  let listEl = $state<HTMLOListElement>();
  let lamp = $state<{ x: number; y: number; w: number; h: number } | null>(null);
  /** The lamp's first place: set without gliding there from nowhere. */
  let lampSettling = $state(true);
  const lampTheme = $derived(list.find((c) => c.key === turn)?.themeCss);
  function placeLamp() {
    const tiles = running && listEl ? [...listEl.querySelectorAll<HTMLElement>('.initrow')] : [];
    const el = tiles.find((t) => (unseenTurn ? t.classList.contains('unseen') : t.dataset.key === turn));
    if (!el) {
      lamp = null;
      lampSettling = true;
      return;
    }
    lamp = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
    if (lampSettling) requestAnimationFrame(() => (lampSettling = false));
  }
  $effect(() => {
    // Placed again whenever whose turn it is, the order, or the fold changes.
    void [turn, shown, unseenTurn, folded];
    queueMicrotask(placeLamp);
  });
  $effect(() => {
    if (!listEl || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(() => placeLamp());
    watch.observe(listEl);
    return () => watch.disconnect();
  });
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
        Call for Initiative and your players roll theirs here, on the campaign page. Write any number in yourself, or
        Roll the Rest. Start, then Next Turn moves it on; your players see the order and whose turn it is, with only
        the monsters and NPCs you’ve revealed. A tie goes to the higher Dexterity: drag a monster or NPC to settle it
        your way. Your players settle ties among their own characters.
      {:else}
        Your DM runs the order. When they call for initiative, roll yours here, or write in what your own dice gave.
        Tied with another character? Drag yours to settle who goes first.
      {/if}
    {/snippet}
    {#if running}<span class="round" in:fade={quick}>Round {round}{#if turnAt > -1}<span class="roundof">, turn {turnAt + 1} of {played.length}</span>{/if}</span>{/if}
    {#snippet end()}
      {#if status}
        {#key status}<span class="initcall" role="status" in:fade={quick}>{status}</span>{/key}
      {/if}
      {#if isDm}
        {#if running}
          {#if !docked}
            <button class="smallbtn" onclick={onprevious} aria-label="Previous turn" title="Previous turn">
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
            <button class="smallbtn accent" onclick={onnext}>Next Turn</button>
          {/if}
          <button class="smallbtn quiet" onclick={onend}>End</button>
        {:else if !asking}
          <button class="smallbtn dicebtn" onclick={onask}>{@render die(14)}Call for Initiative</button>
          {#if !folded}
            {#if onrollrest && list.some((c) => c.value === null)}<button class="smallbtn dicebtn" onclick={onrollrest}>{@render die(14)}Roll the Rest</button>{/if}
            <button class="smallbtn accent" onclick={onstart} disabled={!list.some((c) => c.value !== null)}>Start</button>
          {/if}
        {:else}
          {#if oncancel}
            <button class="smallbtn quiet" onclick={oncancel} title="Stop calling for initiative and clear what was rolled">Cancel</button>
          {/if}
          {#if onrollrest && list.some((c) => c.value === null)}<button class="smallbtn dicebtn" onclick={onrollrest}>{@render die(14)}Roll the Rest</button>{/if}
          <button class="smallbtn accent" onclick={onstart} disabled={!list.some((c) => c.value !== null)}>Start</button>
        {/if}
      {/if}
    {/snippet}
  </SectionHead>

  <!-- Folding eases the height to nothing, as the table board's does. -->
  <div class="initfold" id="init-fold" class:folded inert={folded}
       style:height={isDm && (folded || foldInner) ? `${folded ? 0 : foldInner}px` : undefined}>
  <div bind:clientHeight={foldInner}>
  <ol class="initlist" bind:this={listEl} use:reorder={{
    enabled: Boolean(onsettle), keys: list.map((c) => c.key),
    canLift: (k) => {
      dragging = k;
      return settleable(k);
    },
    shape: (k, order) => settleOrder(combatants, k, order, isDm),
    onpreview: (keys) => (preview = keys),
    oncommit: (keys) => {
      preview = null;
      onsettle?.(settleScores(combatants, dragging, keys, isDm));
    }
  }}>
    {#each shown as c (c.key)}
      <li class="initrow" class:initcr={c.side === 'creature'} class:now={c.key === turn} class:acted={acted(c.key)} class:waiting={c.value === null}
          class:hiddenone={c.hidden} class:mine={c.mine} class:tied={settleable(c.key)} data-key={c.key}
          class:themed={Boolean(c.themeCss)} style={c.themeCss}
          title={settleable(c.key) ? 'Tied: drag to settle who goes first' : undefined}
          animate:flip={{ duration: still ? 0 : 260, easing: cubicOut }} in:fade={{ duration: still ? 0 : 160 }}>
        <!-- The number first, big, so the order reads down the left. -->
        {#if canWrite(c)}
          <input class="numfield initscore" type="number" inputmode="numeric" aria-label="{c.name}’s initiative" value={c.value ?? ''} placeholder="–"
                 onchange={(e) => write(c.key, e.currentTarget.value)} />
        {:else}
          <b class="initscore">{c.value ?? '–'}</b>
        {/if}
        <!-- Characters' portraits are rounded squares, monsters' and NPCs' round, as on their cards. -->
        <span class="initpic" class:round={c.side === 'creature'} class:npc={c.kind === 'npc'} aria-hidden="true">
          {#if c.side === 'pc'}<ClassIcon cls={c.cls} />{:else if !c.pic}<CreatureMark kind={c.kind ?? 'monster'} size="1.25rem" />{/if}
          {#if c.pic}<img src={c.pic} alt="" draggable="false" />{/if}
        </span>
        <span class="initwho">
          <span class="initname">{c.name}</span>
          <span class="initside">{sideOf(c)}{#if c.hidden}, hidden{/if}{#if c.key === upNext}<span class="initnext">, up next</span>{/if}</span>
        </span>
        {#if c.value === null && canWrite(c) && onrollone && c.side === 'pc'}
          <button class="initroll" onclick={() => onrollone?.(c.key)} aria-label="Roll {c.name}’s initiative" title="Roll a d20 with what it adds">{@render die(16)}</button>
        {:else if c.key === turn}
          <span class="initnow" in:fade={quick}>Now</span>
        {/if}
      </li>
    {/each}
    {#if unseenTurn}
      <li class="initrow now unseen" in:fade={quick}>
        <b class="initscore">?</b>
        <span class="initwho"><span class="initname">Something unseen acts</span></span>
        <span class="initnow">Now</span>
      </li>
    {/if}
    {#if lamp}
      <!-- Out of the grid (absolute), so it takes no cell; no data-key, so dragging ignores it. -->
      <li class="initlamp" class:settling={lampSettling || still} class:themed={Boolean(lampTheme)} style={lampTheme}
          style:transform="translate({lamp.x}px, {lamp.y}px)" style:width="{lamp.w}px" style:height="{lamp.h}px"
          aria-hidden="true" in:fade={quick} out:fade={quick}></li>
    {/if}
  </ol>
  </div>
  </div>
</section>

<!-- A d20, for every button that rolls. -->
{#snippet die(size: number)}
  <svg class="initdie" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d="M12 2.5 20.5 7.4v9.2L12 21.5 3.5 16.6V7.4zM12 7.5l4.3 7.4H7.7zM12 2.5v5M20.5 7.4l-4.2 7.5M3.5 7.4l4.2 7.5M7.7 14.9 3.5 16.6M16.3 14.9l4.2 1.7M7.7 14.9 12 21.5l4.3-6.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /></svg>
{/snippet}

<style>
  .initiative { min-width: 0; }
  .round { font-size: 0.8125rem; color: var(--a); font-weight: 650; }
  .roundof { color: var(--dim); font-weight: 500; }
  .initcall { font-size: 0.8125rem; font-weight: 600; color: var(--a); margin-right: 0.25rem; }
  .initfold { overflow: clip; overflow-clip-margin: 8px; transition: height 0.32s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.26s var(--ease-out); }
  .initfold.folded { opacity: 0; }
  /* While a tile is dragged it may leave the list's box: nothing clips it. */
  .initfold:has(:global(.reordering)) { overflow: visible; }
  @media (prefers-reduced-motion: reduce) { .initfold { transition: none; } }
  /* The order in reading order, a tile each: highest first, left to right, then down. */
  .initlist {
    position: relative; list-style: none; margin: 0; padding: 2px; display: grid; gap: 0.5rem;
    grid-template-columns: repeat(auto-fill, minmax(min(15rem, 100%), 1fr));
  }
  .initrow {
    position: relative; display: flex; align-items: center; gap: 0.625rem; min-width: 0; min-height: 3.25rem;
    padding: 0.375rem 0.625rem 0.375rem 0.375rem; border-radius: var(--r); border: 1px solid var(--line-soft);
    background: var(--surface); font-size: 0.875rem;
    transition: border-color 0.2s var(--ease-out), background-color 0.2s var(--ease-out), box-shadow 0.25s var(--ease-out), opacity 0.25s var(--ease-out);
  }
  .initrow.initcr { background: color-mix(in oklab, var(--surface) 88%, var(--raised)); }
  /* A tie this viewer can settle: picked up and moved. */
  .initrow.tied { cursor: grab; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
  .initrow.tied:hover { border-color: var(--a-edge); }
  .initrow.waiting:not(.mine) { opacity: 0.6; }
  /* Gone already this round: a step back. */
  .initrow.acted { opacity: 0.62; }
  .initrow.mine { border-color: var(--a-edge); }
  .initrow.hiddenone .initname { color: var(--dim); }
  .initrow.unseen { font-style: italic; }
  /* Whose turn it is: the tile is tinted here, and the lamp below draws its
     ring, glow, and the bar down its left edge. */
  .initrow.now { border-color: var(--a-edge); background: color-mix(in oklab, var(--a) 12%, var(--surface)); }
  .initlamp {
    position: absolute; left: 0; top: 0; pointer-events: none; border-radius: var(--r);
    box-shadow: 0 0 0 1px var(--a-edge), 0 6px 18px -8px color-mix(in oklab, var(--a) 55%, transparent);
    transition: transform 0.38s var(--ease-out), width 0.38s var(--ease-out), height 0.38s var(--ease-out), box-shadow 0.38s var(--ease-out);
  }
  .initlamp::before {
    content: ''; position: absolute; left: -1px; top: 0.5rem; bottom: 0.5rem; width: 3px; border-radius: 0 3px 3px 0;
    background: var(--a); transition: background-color 0.38s var(--ease-out);
  }
  /* Its first place, and under reduced motion every place: no glide. */
  .initlamp.settling { transition: none; }
  .initscore {
    flex: none; box-sizing: border-box; width: 2.625rem; height: 2.375rem; display: grid; place-items: center;
    font: inherit; font-size: 1.0625rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text);
    border-radius: var(--r-sm); background: var(--raised); border: 1px solid var(--line-soft); padding: 0;
  }
  .initrow.now .initscore { background: var(--a); border-color: var(--a); color: var(--bg); }
  /* A plain block: centering its items as a grid moved Chrome's placeholder box, and the dash sat left. */
  input.initscore { display: block; place-items: normal; border-color: var(--line); background: var(--bg); text-align: center; transition: border-color 0.15s var(--ease-out); }
  input.initscore:hover { border-color: var(--a-edge); }
  input.initscore:focus { outline: none; border-color: var(--a); }
  input.initscore::placeholder { color: var(--dim); }
  .initrow.now input.initscore { background: var(--bg); color: var(--a); border: 2px solid var(--a); }
  .initpic {
    position: relative; flex: none; width: 2.25rem; height: 2.25rem; border-radius: var(--r-sm); overflow: hidden;
    display: grid; place-items: center; color: var(--dim); border: 1px solid var(--a-edge);
    background: linear-gradient(150deg, var(--portrait-from, var(--raised)), var(--portrait-to, var(--raised)));
  }
  .initpic.round { border-radius: 50%; background: var(--raised); border-color: color-mix(in oklab, oklch(62% 0.21 25) 45%, var(--line)); }
  .initpic.npc { border-color: var(--a-edge); }
  .initpic img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .initwho { flex: 1; min-width: 0; display: grid; gap: 0.0625rem; }
  .initname { font-weight: 600; overflow-wrap: anywhere; line-height: 1.25; }
  .initside { font-size: 0.6875rem; color: var(--dim); letter-spacing: 0.02em; }
  .initnext { color: var(--a); font-weight: 600; }
  /* Rolling is a die, nothing else: it turns a little on hover. */
  .initroll {
    flex: none; width: 2.125rem; height: 2.125rem; display: grid; place-items: center; padding: 0; cursor: pointer;
    color: var(--a); background: var(--a-wash); border: 1px solid var(--a-edge); border-radius: var(--r-sm);
    transition: background-color 0.15s var(--ease-out), border-color 0.15s var(--ease-out), transform 0.08s var(--ease-out);
  }
  .initroll:hover { background: color-mix(in oklab, var(--a) 22%, transparent); border-color: var(--a); }
  .initroll:active { transform: translateY(1px); }
  .initroll:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
  .initdie { flex: none; transition: transform 0.4s cubic-bezier(0.33, 1, 0.68, 1); }
  .initroll:hover .initdie, :global(.dicebtn:hover:not(:disabled)) .initdie { transform: rotate(72deg); }
  @media (prefers-reduced-motion: reduce) { .initdie { transition: none; } }
  .initnow {
    flex: none; font-size: 0.625rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--a);
    padding: 0.125rem 0.4375rem; border-radius: 999px; border: 1px solid var(--a-edge); background: var(--a-wash);
  }
  /* A phone: one tile a row, the width of the screen, easy to read and to tap. */
  @media (max-width: 700px) {
    .initlist { grid-template-columns: minmax(0, 1fr); gap: 0.4375rem; }
    .initrow { min-height: 3.5rem; font-size: 0.9375rem; }
    .initscore { width: 3rem; height: 2.625rem; font-size: 1.125rem; }
    .initroll { width: 2.75rem; height: 2.75rem; }
  }
</style>
