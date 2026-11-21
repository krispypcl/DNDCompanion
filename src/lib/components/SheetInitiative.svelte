<!--
  The fight, on a player's own sheet (lib/initiative, database/0019). It
  never asks for a roll itself: initiative is rolled on the campaign page,
  in one place for the whole table. When the DM calls for it, a bar points
  there; while the fight runs it shows the round, the player's number, and
  lights up on their turn.
-->
<script lang="ts">
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { base } from '#lib/base.ts';
  import type { LiveInitiative } from '#lib/initiative.svelte.ts';
  import { prefersReducedMotion } from '#lib/motion.ts';
  import InfoTip from './InfoTip.svelte';

  let { live, sheetId }: { live: LiveInitiative; sheetId: string } = $props();

  const s = $derived(live.state);
  const mine = $derived(s.pcs[sheetId] ?? null);
  const running = $derived(Boolean(s.turn));
  const myTurn = $derived(s.turn === `pc:${sheetId}`);
  const calling = $derived(s.asking && !running && mine === null);
  const shown = $derived(s.asking || running);
  const unfold = { duration: prefersReducedMotion() ? 0 : 260, easing: cubicOut };
</script>

{#if shown}
  <div class="sheetinit" class:myturn={myTurn} class:calling role="status" transition:slide={unfold}>
    {#if myTurn}
      <strong class="sitext">Your turn!</strong>
      <span class="simeta">Round {s.round}{#if mine !== null}, initiative {mine}{/if}</span>
    {:else if running}
      <span class="sitext">Round {s.round}</span>
      <span class="simeta">{mine === null ? 'You’re not in the order.' : `Your initiative: ${mine}`}</span>
    {:else if calling}
      <strong class="sitext">Your DM calls for initiative!</strong>
    {:else}
      <span class="sitext">Initiative {mine}</span>
      <span class="simeta">The fight starts soon.</span>
    {/if}
    <span class="sido">
      <a class="smallbtn" class:accent={calling} href="{base}/c/{live.campaignId}">{calling ? 'Roll It on the Campaign Page' : 'Campaign'}</a>
      <InfoTip label="About the fight">Your DM runs the initiative order on the campaign page, and that’s where everyone rolls theirs, so every number comes from one place.</InfoTip>
    </span>
  </div>
{/if}

<style>
  /* Above the banner and the hurt edges, as the sheet's modules are, so it
     reads as solid as they do. */
  .sheetinit {
    position: relative; z-index: 1;
    display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem 0.875rem; margin: 0 0 1rem; padding: 0.625rem 0.875rem;
    border-radius: var(--r); border: 1px solid var(--line-soft); background: var(--surface);
    transition: border-color 0.25s ease, box-shadow 0.25s ease, background-color 0.25s ease;
  }
  .sheetinit.calling, .sheetinit.myturn {
    border-color: var(--a-edge); background: color-mix(in oklch, var(--a) 8%, var(--surface));
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--a) 14%, transparent);
  }
  .sitext { font-size: 0.9375rem; }
  .myturn .sitext, .calling .sitext { color: var(--a); }
  .simeta { font-size: 0.8125rem; color: var(--dim); }
  .sido { display: inline-flex; align-items: center; gap: 0.5rem; margin-left: auto; }
</style>
