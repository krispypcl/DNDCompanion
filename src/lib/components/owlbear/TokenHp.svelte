<script lang="ts">
  /**
   * A tied token's right-click menu in Owlbear: its character's hit points,
   * and damage, healing or temporary hit points written straight to the
   * sheet (lib/owlbear/hp.ts). Sits inside Owlbear's own menu, so it keeps
   * to Owlbear's background and stays small.
   */
  import { onMount, tick } from 'svelte';
  import { applyMode } from '$lib/stores/mode';
  import { vitalStatus } from '$lib/rules/hp';
  import { followSheets } from '$lib/owlbear/live';
  import { changeHp, type HpChange } from '$lib/owlbear/hp';
  import type { Sheet } from '$lib/types';
  import HpBar from './HpBar.svelte';

  let sheet = $state.raw<Sheet | null>(null);
  let gone = $state(false);
  let amount = $state<number | null>(null);
  let message = $state<{ ok: boolean; text: string } | null>(null);
  let busy = $state(false);
  let field = $state<HTMLInputElement>();
  let open = $state('');
  let name = $state('');

  onMount(() => {
    const stops: (() => void)[] = [];
    void (async () => {
      const m = await import('$lib/owlbear/obr');
      await m.ready();
      stops.push(await m.followTheme(applyMode));
      const sel = (await m.OBR.player.getSelection()) ?? [];
      const item = sel.length ? (await m.OBR.scene.items.getItems(sel))[0] : undefined;
      const link = item ? m.linkOf(item) : null;
      if (!link) return void (gone = true);
      open = m.sheetUrl(link.id);
      stops.push(followSheets({ sheets: [link.id], campaigns: [] }, (list) => {
        sheet = list[0] ?? null;
        gone = !sheet;
        if (sheet) name = m.nameOf(sheet);
      }));
      await tick();
      field?.focus();
    })();
    return () => stops.forEach((s) => s());
  });

  const max = $derived(Number(sheet?.definition?.combat?.hpMax) || 0);
  const cur = $derived(Number(sheet?.state?.hpCurrent) || 0);
  const temp = $derived(Number(sheet?.state?.hpTemp) || 0);
  const v = $derived(vitalStatus(cur, max, sheet?.state?.deathSaves));

  async function act(how: HpChange) {
    if (!sheet || !amount || amount <= 0 || busy) return;
    busy = true;
    message = null;
    try {
      const next = await changeHp(sheet.id, how, amount);
      sheet = next;
      message = { ok: true, text: how === 'damage' ? `Ouch! ${amount} damage taken.` : how === 'heal' ? `${amount} healed.` : `${amount} temporary hit points.` };
      amount = null;
    } catch (e) {
      message = { ok: false, text: e instanceof Error ? e.message : 'That slipped! Try again.' };
    } finally {
      busy = false;
    }
  }
</script>

<main class="hp {v.vital}">
  {#if gone}
    <p class="msg">This token isn’t tied to a character any more.</p>
  {:else if !sheet}
    <p class="msg">Reading the sheet…</p>
  {:else}
    <div class="row head">
      <strong>{name}</strong>
      <a href={open} target="_blank" rel="noopener noreferrer" title="Open the sheet">Sheet ↗</a>
    </div>
    {#if max > 0}
      <div class="row">
        <HpBar {cur} {max} {temp} vital={v.vital} />
      </div>
    {/if}
    <form class="row" onsubmit={(e) => { e.preventDefault(); void act('damage'); }}>
      <input bind:this={field} bind:value={amount} type="number" min="1" inputmode="numeric" placeholder="Amount" aria-label="Amount" />
      <button class="dmg" disabled={busy || !amount}>Damage</button>
    </form>
    <div class="row">
      <button type="button" disabled={busy || !amount} onclick={() => act('heal')}>Heal</button>
      <button type="button" disabled={busy || !amount} onclick={() => act('temp')}>Temp HP</button>
    </div>
    {#if message}<p class="msg" class:bad={!message.ok} role="status">{message.text}</p>{/if}
  {/if}
</main>

<style>
  :global(html.in-owlbear), :global(html.in-owlbear body) { background: transparent !important; }
  .hp { --hurt-red: oklch(66% 0.22 25); padding: 0.5rem 0.75rem 0.625rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.4375rem; font-size: 0.8125rem; }
  .row { display: flex; align-items: center; gap: 0.375rem; }
  .head strong { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.875rem; }
  .head a { color: var(--a); font-size: 0.75rem; text-decoration: none; border-radius: 2px; }
  .head a:hover { text-decoration: underline; text-underline-offset: 2px; }
  .head a:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  input {
    flex: 1; min-width: 0; font: inherit; padding: 0.3125rem 0.5rem; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: color-mix(in oklch, var(--bg) 70%, transparent);
    transition: border-color 0.15s ease;
  }
  input:hover { border-color: var(--a-edge); }
  input:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  button {
    flex: 1; font: inherit; cursor: pointer; border: 1px solid var(--line); background: var(--raised); color: var(--text);
    border-radius: var(--r-sm); padding: 0.3125rem 0.5rem; transition: border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
  }
  button:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  button:active:not(:disabled) { transform: translateY(1px); }
  button:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  button:disabled { opacity: 0.5; cursor: default; }
  .dmg { flex: none; }
  .dmg:hover:not(:disabled) { border-color: var(--hurt-red); color: var(--hurt-red); }
  .msg { margin: 0; color: var(--dim); font-size: 0.75rem; line-height: 1.4; }
  .msg.bad { color: var(--bad); }
</style>
