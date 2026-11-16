<!--
  The initiative order on the campaign page (rules/initiative): everyone at
  the table, highest first, whose turn it is lit, and the round. The DM
  writes or rolls the numbers and moves the turn on; the players watch it.
-->
<script lang="ts">
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import { prefersReducedMotion } from '$lib/motion';
  import { ordered, type Combatant } from '$lib/rules/initiative';
  import InfoTip from './InfoTip.svelte';

  type Row = Combatant & { hidden?: boolean };
  let {
    combatants,
    turn,
    round,
    isDm,
    onvalue,
    onstart,
    onnext,
    onprevious,
    onend,
    onroll
  }: {
    combatants: Row[];
    turn: string | null;
    round: number;
    isDm: boolean;
    onvalue?: (key: string, value: number | null) => void;
    onstart?: () => void;
    onnext?: () => void;
    onprevious?: () => void;
    onend?: () => void;
    /** Roll for the monsters and NPCs that have no number yet. */
    onroll?: () => void;
  } = $props();

  const list = $derived(ordered(combatants) as Row[]);
  const running = $derived(Boolean(turn));
  const still = prefersReducedMotion();
  function write(key: string, v: string) {
    const n = Number(v);
    onvalue?.(key, v.trim() === '' || !Number.isFinite(n) ? null : Math.round(n));
  }
</script>

<section class="initiative" aria-label="Initiative">
  <div class="inithead">
    <h3>Initiative{#if running}<span class="round">Round {round}</span>{/if}</h3>
    {#if isDm}
      <InfoTip label="About initiative">Write each one’s initiative, or roll for the monsters and NPCs. Start, then Next turn moves it on; your players see the order and whose turn it is, but only the monsters and NPCs you’ve revealed.</InfoTip>
      <div class="initdo">
        {#if onroll}<button class="smallbtn" onclick={onroll}>Roll for monsters</button>{/if}
        {#if running}
          <button class="smallbtn" onclick={onprevious} aria-label="Previous turn">Back</button>
          <button class="smallbtn accent" onclick={onnext}>Next turn</button>
          <button class="smallbtn quiet" onclick={onend}>End</button>
        {:else}
          <button class="smallbtn accent" onclick={onstart} disabled={!list.some((c) => c.value !== null)}>Start</button>
        {/if}
      </div>
    {/if}
  </div>
  <ol class="initlist">
    {#each list as c (c.key)}
      <li class="initrow" class:initcr={c.side === 'creature'} class:now={c.key === turn} class:waiting={c.value === null} class:hiddenone={c.hidden}
          animate:flip={{ duration: still ? 0 : 260, easing: cubicOut }} in:fade={{ duration: still ? 0 : 160 }}>
        {#if isDm}
          <input type="number" inputmode="numeric" aria-label="{c.name}’s initiative" value={c.value ?? ''} placeholder="–"
                 onchange={(e) => write(c.key, e.currentTarget.value)} />
        {:else}
          <b class="initvalue">{c.value ?? '–'}</b>
        {/if}
        <span class="initname">{c.name}</span>
        {#if c.hidden}<span class="inittag" title="Hidden from your players">hidden</span>{/if}
        {#if c.key === turn}<span class="initnow">Now</span>{/if}
      </li>
    {/each}
  </ol>
</section>

<style>
  .initiative {
    margin-top: 1rem; padding: 0.75rem 0.875rem; border-radius: var(--r);
    border: 1px solid var(--line-soft); background: var(--surface);
  }
  .inithead { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  h3 {
    margin: 0; display: inline-flex; align-items: baseline; gap: 0.625rem;
    font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--label); font-weight: 600;
  }
  .round { letter-spacing: 0.04em; text-transform: none; font-size: 0.8125rem; color: var(--a); font-weight: 650; }
  .initdo { display: flex; gap: 0.375rem; flex-wrap: wrap; margin-left: auto; }
  .initlist { list-style: none; margin: 0.625rem 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .initrow {
    display: inline-flex; align-items: center; gap: 0.4375rem; padding: 0.25rem 0.625rem 0.25rem 0.25rem;
    border-radius: 999px; border: 1px solid var(--line-soft); background: var(--raised); font-size: 0.8125rem;
    transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  }
  .initrow.initcr { border-style: dashed; }
  .initrow.waiting { opacity: 0.6; }
  .initrow.hiddenone .initname { color: var(--dim); }
  .initrow.now { border-color: var(--a-edge); background: var(--a-wash); box-shadow: 0 0 0 2px color-mix(in oklch, var(--a) 30%, transparent); }
  .initrow input {
    width: 2.75rem; padding: 0.125rem 0.25rem; text-align: center; font: inherit; font-size: 0.8125rem; font-weight: 650;
    color: var(--text); border: 1px solid var(--line); border-radius: 999px; background: var(--bg);
  }
  .initrow input:focus { outline: none; border-color: var(--a-edge); }
  .initvalue { min-width: 1.75rem; text-align: center; font-variant-numeric: tabular-nums; }
  .initname { font-weight: 600; overflow-wrap: anywhere; }
  .inittag { font-size: 0.625rem; color: var(--dim); letter-spacing: 0.06em; text-transform: uppercase; }
  .initnow { font-size: 0.625rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--a); }
</style>
