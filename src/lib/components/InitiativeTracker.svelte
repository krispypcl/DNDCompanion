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
  import { fade, slide } from 'svelte/transition';
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
</script>

<section class="initiative" aria-label="Initiative">
  <SectionHead title="Initiative">
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
      {#if isDm}
        {#if running}
          <button class="smallbtn" onclick={onprevious} aria-label="Previous turn" title="Previous turn">
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <button class="smallbtn accent" onclick={onnext}>Next turn</button>
          <button class="smallbtn quiet" onclick={onend}>End</button>
        {:else}
          {#if !asking}<button class="smallbtn" onclick={onask}>Call for initiative</button>{/if}
          {#if onrollrest && list.some((c) => c.value === null)}<button class="smallbtn" onclick={onrollrest}>Roll the rest</button>{/if}
          <button class="smallbtn accent" onclick={onstart} disabled={!list.some((c) => c.value !== null)}>Start</button>
        {/if}
      {/if}
    {/snippet}
  </SectionHead>

  {#if asking && !running}
    <p class="initcall" transition:slide={quick}>
      {#if isDm}
        {waiting === 0 ? 'Every character has rolled.' : waiting === 1 ? 'Waiting on 1 character.' : `Waiting on ${waiting} characters.`}
      {:else if mineToRoll.length}
        Roll for initiative!
      {:else if list.some((c) => c.mine)}
        You’re in the order. The fight starts soon.
      {:else}
        The DM calls for initiative.
      {/if}
    </p>
  {/if}

  <ol class="initlist">
    {#each list as c (c.key)}
      <li class="initrow" class:initcr={c.side === 'creature'} class:now={c.key === turn} class:waiting={c.value === null}
          class:hiddenone={c.hidden} class:mine={c.mine}
          animate:flip={{ duration: still ? 0 : 260, easing: cubicOut }} in:fade={{ duration: still ? 0 : 160 }}>
        {#if canWrite(c)}
          <input type="number" inputmode="numeric" aria-label="{c.name}’s initiative" value={c.value ?? ''} placeholder="–"
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
</section>

<style>
  .initiative { min-width: 0; }
  .round { font-size: 0.8125rem; color: var(--a); font-weight: 650; }
  .initcall { margin: 0 0 0.625rem; font-size: 0.875rem; font-weight: 600; color: var(--a); }
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
