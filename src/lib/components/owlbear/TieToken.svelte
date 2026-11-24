<script lang="ts">
  /**
   * A token's right-click menu in Owlbear, while it is not tied to anyone:
   * pick one of the room's campaign's characters (live), and the token takes
   * on their portrait and from then on carries their hit points and
   * conditions.
   */
  import { onMount } from 'svelte';
  import { joinRoom, type Obr } from '#lib/owlbear/frame.ts';
  import { resolveImageUrl } from '#lib/rules/imageUrl.ts';
  import { followSheets } from '#lib/owlbear/live.ts';
  import type { Sheet } from '#lib/types.ts';
  import { fade, prefersReducedMotion } from '#lib/motion.ts';

  let obr = $state.raw<Obr | null>(null);
  let itemId = $state<string | null>(null);
  let sheets = $state.raw<Sheet[] | null>(null);
  let message = $state<{ ok: boolean; text: string } | null>(null);
  let busy = $state<string | null>(null);

  onMount(() => {
    const stops: (() => void)[] = [];
    void (async () => {
      const m = await joinRoom(stops);
      obr = m;
      itemId = ((await m.OBR.player.getSelection()) ?? [])[0] ?? null;
      const campaign = await m.getCampaign();
      stops.push(followSheets({ sheets: [], campaigns: campaign ? [campaign] : [] }, (list) => (sheets = list), () => (sheets ??= [])));
    })();
    return () => stops.forEach((s) => s());
  });

  async function tie(s: Sheet) {
    if (!obr || !itemId) return;
    busy = s.id;
    message = null;
    try {
      await obr.tieToken(itemId, s);
      message = { ok: true, text: `Tied! This token is ${obr.nameOf(s)} now.` };
    } catch (e) {
      message = { ok: false, text: e instanceof Error ? e.message : 'The knot slipped! Try again.' };
    } finally {
      busy = null;
    }
  }
</script>

<main class="tie">
  {#if sheets === null}
    <div class="tieskel" aria-busy="true" aria-label="Gathering the party">{#each [0, 1, 2] as i (i)}<i class="skeleton"></i>{/each}</div>
  {:else if !sheets.length}
    <p class="msg">No characters in this room yet. Bring your campaign in from the DND Companion panel first.</p>
  {:else}
    <ul>
      {#each sheets as s, i (s.id)}
        {@const portrait = resolveImageUrl(s.definition?.identity?.portraitUrl).url}
        <li class="rise" style:--i={i}>
          <button disabled={busy !== null} onclick={() => tie(s)}>
            <span class="pic">{#if portrait}<img src={portrait} alt="" />{/if}</span>
            <span class="name">{obr?.nameOf(s)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if message}<p class="msg" class:bad={!message.ok} role="status" transition:fade={{ duration: prefersReducedMotion() ? 0 : 160 }}>{message.text}</p>{/if}
</main>

<style>
  :global(html.in-owlbear), :global(html.in-owlbear body) { background: transparent !important; }
  .tie { padding: 0.375rem 0.5rem 0.5rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.375rem; font-size: 0.8125rem; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.25rem; max-height: 11.5rem; overflow-y: auto; }
  button {
    width: 100%; display: flex; align-items: center; gap: 0.5rem; font: inherit; color: var(--text); text-align: left; cursor: pointer;
    border: 1px solid transparent; background: none; border-radius: var(--r-sm); padding: 0.25rem 0.375rem;
    transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.1s ease;
  }
  button:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); background: color-mix(in oklch, var(--a) 8%, transparent); }
  button:active:not(:disabled) { transform: translateY(1px); }
  button:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  button:disabled { opacity: 0.6; cursor: default; }
  .pic { position: relative; flex: none; width: 1.75rem; height: 1.75rem; border-radius: 0.3125rem; background: color-mix(in oklch, var(--text) 12%, transparent); overflow: hidden; }
  .pic img { width: 100%; height: 100%; object-fit: cover; }
  .name { overflow-wrap: anywhere; }
  .msg { margin: 0; color: var(--dim); font-size: 0.75rem; line-height: 1.4; padding: 0 0.25rem; }
  .msg.bad { color: var(--bad); }
  .tieskel { display: grid; gap: 0.375rem; }
  .tieskel i { height: 2.5rem; border-radius: var(--r-sm); }
  /* The list replacing the skeleton fades up, a row at a time. */
  .rise { animation: tie-rise 0.24s cubic-bezier(0.33, 1, 0.68, 1) both; animation-delay: calc(var(--i, 0) * 30ms); }
  @keyframes tie-rise { from { opacity: 0; translate: 0 4px; } }
  @media (prefers-reduced-motion: reduce) { .rise { animation: none; } }
</style>
