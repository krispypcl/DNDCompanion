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
  import { phone } from '#lib/stores/phone.svelte.ts';
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
    <!-- One row: the words take what the button leaves them (wrapping inside it if they must). -->
    <span class="siwords">
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
    </span>
    <span class="sido">
      <a class="smallbtn" class:accent={calling} href="{base}/c/{live.campaignId}">{calling ? (phone.current ? 'Roll It' : 'Roll It on the Campaign Page') : 'Campaign'}</a>
      <InfoTip label="About the fight">Your DM runs the initiative order on the campaign page, and that’s where everyone rolls theirs, so every number comes from one place.</InfoTip>
    </span>
  </div>
{/if}

<style>
  /* Above the banner and the hurt edges, as the sheet's modules are, and made the way they are:
     solid on a plain sheet, frosted over a banner (SheetView's .panel), its ground tinted with
     the accent while it calls or it is your turn. */
  .sheetinit {
    --si-ground: var(--surface);
    position: relative; z-index: 1;
    display: flex; align-items: center; gap: 0.875rem; margin: 0 0 1rem; padding: 0.625rem 0.875rem;
    border-radius: var(--r); border: 1px solid var(--line-soft); background: var(--si-ground);
    transition: border-color 0.25s ease, box-shadow 0.25s ease, background-color 0.25s ease;
  }
  :global(.bannered) .sheetinit { background: transparent; border-color: color-mix(in oklch, var(--line) 70%, transparent); }
  :global(.bannered) .sheetinit::before {
    content: ''; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none;
    background: color-mix(in oklch, var(--si-ground) 76%, transparent);
    backdrop-filter: blur(16px) saturate(1.1); -webkit-backdrop-filter: blur(16px) saturate(1.1);
  }
  @media (max-width: 720px), (pointer: coarse) {
    :global(.bannered) .sheetinit::before {
      backdrop-filter: none; -webkit-backdrop-filter: none;
      background: color-mix(in oklch, var(--si-ground) 93%, transparent);
    }
  }
  :global([data-mode='light'] .bannered) .sheetinit::before { background: color-mix(in oklab, var(--si-ground) 90%, transparent); }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    :global(.bannered) .sheetinit::before { background: var(--si-ground); }
  }
  .sheetinit.calling, .sheetinit.myturn {
    --si-ground: color-mix(in oklab, var(--a) 8%, var(--surface));
    border-color: var(--a-edge);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--a) 14%, transparent);
  }
  .siwords { flex: 1; min-width: 0; display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.125rem 0.875rem; }
  .sitext { font-size: 0.9375rem; }
  .myturn .sitext, .calling .sitext { color: var(--a); }
  .simeta { font-size: 0.8125rem; color: var(--dim); }
  .sido { flex: none; display: inline-flex; align-items: center; gap: 0.5rem; }
  @media (max-width: 700px) {
    .sheetinit { gap: 0.625rem; padding: 0.5rem 0.625rem 0.5rem 0.75rem; }
    .siwords { gap: 0 0.5rem; }
    .sitext { font-size: 0.875rem; }
    .simeta { font-size: 0.75rem; }
  }
</style>
