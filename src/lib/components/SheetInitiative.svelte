<!--
  The fight, on a player's own sheet (lib/initiative, database/0019): when
  the DM calls for initiative, a bar asks for the roll (the dice tray makes
  it, or the player writes what their own dice gave); while the fight runs it
  shows their place, the round, and lights up on their turn.
-->
<script lang="ts">
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import type { LiveInitiative } from '$lib/initiative.svelte';
  import { prefersReducedMotion } from '$lib/motion';
  import InfoTip from './InfoTip.svelte';

  let { live, sheetId, onroll }: { live: LiveInitiative; sheetId: string; onroll: () => void } = $props();

  const s = $derived(live.state);
  const mine = $derived(s.pcs[sheetId] ?? null);
  const running = $derived(Boolean(s.turn));
  const myTurn = $derived(s.turn === `pc:${sheetId}`);
  const shown = $derived(s.asking || running);
  let typed = $state<string | number>('');
  let error = $state<string | null>(null);
  async function write() {
    const n = Number(typed);
    if (String(typed).trim() === '' || !Number.isFinite(n)) return;
    error = null;
    try {
      await live.setMine(sheetId, Math.max(-50, Math.min(100, Math.round(n))));
      typed = '';
    } catch (e) {
      error = e instanceof Error ? e.message : 'That number slipped! Try again.';
    }
  }
  const unfold = { duration: prefersReducedMotion() ? 0 : 260, easing: cubicOut };
</script>

{#if shown}
  <div class="sheetinit" class:myturn={myTurn} class:calling={s.asking && mine === null} role="status" transition:slide={unfold}>
    {#if myTurn}
      <strong class="sitext">Your turn!</strong>
      <span class="simeta">Round {s.round}{#if mine !== null}, initiative {mine}{/if}</span>
    {:else if running}
      <span class="sitext">Round {s.round}</span>
      <span class="simeta">{mine === null ? 'You’re not in the order.' : `Your initiative: ${mine}`}</span>
    {:else if mine === null}
      <strong class="sitext">Your DM calls for initiative!</strong>
      <div class="sido">
        <button class="smallbtn accent" onclick={onroll}>Roll initiative</button>
        <form class="siwrite" onsubmit={(e) => { e.preventDefault(); void write(); }}>
          <input type="number" inputmode="numeric" bind:value={typed} placeholder="or write it" aria-label="Your initiative, from your own dice" />
          {#if String(typed).trim() !== ''}<button class="smallbtn">Send</button>{/if}
        </form>
      </div>
    {:else}
      <span class="sitext">Initiative {mine}</span>
      <span class="simeta">You’re in the order. The fight starts soon.</span>
    {/if}
    <InfoTip label="About the fight">Your DM runs the initiative order on the campaign page; your number goes into it from here. Rolling uses your dice tray, with what your initiative adds.</InfoTip>
    {#if error}<p class="sierr" role="alert">{error}</p>{/if}
  </div>
{/if}

<style>
  .sheetinit {
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
  .sido { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-left: auto; }
  .siwrite { display: flex; gap: 0.375rem; align-items: center; }
  .siwrite input {
    width: 6.5rem; font: inherit; font-size: 0.8125rem; padding: 0.3125rem 0.5rem; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  .siwrite input:focus { outline: none; border-color: var(--a-edge); }
  .sierr { flex-basis: 100%; margin: 0; font-size: 0.8125rem; color: var(--bad); }
</style>
