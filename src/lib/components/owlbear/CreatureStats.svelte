<script lang="ts">
  /**
   * A DM's monster or NPC's stat block, in a popover beside the Owlbear map
   * (obr.ts openStats): laid out as the campaign page's stat block window,
   * live as the DM changes it anywhere. Only the DM can read it.
   */
  import { onMount } from 'svelte';
  import { fade, prefersReducedMotion } from '#lib/motion.ts';
  import { joinRoom, type Obr } from '#lib/owlbear/frame.ts';
  import { followCreatures, type Creature } from '#lib/data/creatures.ts';
  import { isEmpty, kindLine, statBlockHtml } from '#lib/rules/statblock.ts';

  let obr = $state.raw<Obr | null>(null);
  let creature = $state.raw<Creature | null>(null);
  let status = $state<'reading' | 'shown' | 'gone' | 'locked'>('reading');

  onMount(() => {
    const at = new URLSearchParams(location.search);
    const campaign = at.get('c') ?? '';
    const id = at.get('id') ?? '';
    const stops: (() => void)[] = [];
    void joinRoom(stops).then((m) => (obr = m));
    stops.push(followCreatures(campaign, (list) => {
      creature = list.find((c) => c.id === id) ?? null;
      status = creature ? 'shown' : 'gone';
    }, () => (status = 'locked')));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && void obr?.closeStats();
    window.addEventListener('keydown', onKey);
    stops.push(() => window.removeEventListener('keydown', onKey));
    return () => stops.forEach((s) => s());
  });

  const link = $derived(creature?.link.trim() || null);
  const onFive = $derived(Boolean(link && /^https:\/\/5e\.tools\//.test(link)));
  const appear = () => ({ duration: prefersReducedMotion() ? 0 : 180 });
</script>

<svelte:head><title>{creature ? `${creature.name} | DND Companion` : 'Stat block | DND Companion'}</title></svelte:head>

<main class="stats">
  <header>
    {#if creature}
      <h1 class="statname" in:fade={appear()}>{creature.name}</h1>
    {:else}
      <i class="skeleton skname" class:still={status !== 'reading'}></i>
    {/if}
    <div class="stattools">
      {#if link}
        <a class="smallbtn quiet" href={link} target="_blank" rel="noopener noreferrer" in:fade={appear()}
           title={onFive ? 'Its page on 5e.tools, with the lore and pictures' : 'Your link for it'}>{onFive ? 'Open on 5e.tools' : 'Open Your Link'}</a>
      {/if}
      <button type="button" class="closex" aria-label="Close the stat block" title="Close (Esc)" onclick={() => obr?.closeStats()}>×</button>
    </div>
  </header>
  <div class="statbody themed-scroll">
    {#if status === 'gone'}
      <p class="statnone">This one has left the campaign.</p>
    {:else if status === 'locked'}
      <p class="statnone">Only the DM can read this one! Sign in as the DM in the DND Companion panel.</p>
    {:else if !creature}
      <div class="skelbody" aria-busy="true" aria-label="Reading the stat block">
        {#each [72, 100, 88, 100, 64, 92] as w, i (i)}<i class="skeleton" style:width="{w}%"></i>{/each}
      </div>
    {:else}
      <div in:fade={appear()}>
        {#if kindLine(creature.statblock ?? {})}<p class="statkind">{kindLine(creature.statblock ?? {})}</p>{/if}
        {#if isEmpty(creature.statblock ?? {})}
          <p class="statnone">No stat block yet. Write one from the campaign page.</p>
        {:else}
          {@html statBlockHtml(creature.statblock)}
          {#if creature.statblock.source}<p class="statsource">{creature.statblock.source === 'Homebrew' ? 'Homebrew' : `From ${creature.statblock.source}`}</p>{/if}
        {/if}
      </div>
    {/if}
  </div>
</main>

<style>
  :global(html.in-owlbear), :global(html.in-owlbear body) { background: var(--surface); }
  .stats { height: 100dvh; display: flex; flex-direction: column; overflow: clip; background: var(--surface); }
  header {
    display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.75rem 0.625rem 0.625rem 0.875rem;
    border-bottom: 1px solid var(--line-soft);
  }
  .statname { flex: 1; min-width: 0; margin: 0.125rem 0 0; font-size: 1.0625rem; font-weight: 650; line-height: 1.3; color: var(--a); overflow-wrap: anywhere; }
  .stattools { flex: none; display: flex; align-items: center; gap: 0.375rem; --x-size: 1.75rem; }
  .stattools .smallbtn { text-decoration: none; }
  .statbody { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0.75rem 0.875rem 0.875rem; }
  .statkind { margin: 0 0 0.625rem; font-size: 0.8125rem; font-style: italic; color: var(--dim); }
  .statnone { margin: 0; color: var(--dim); font-size: 0.8125rem; line-height: 1.45; }
  .statsource { margin: 0.75rem 0 0; padding-top: 0.5rem; border-top: 1px solid var(--line-soft); font-size: 0.75rem; color: var(--dim); }
  .skname { flex: 1; height: 1.25rem; margin-top: 0.125rem; max-width: 12rem; }
  .skname.still { visibility: hidden; }
  .skelbody { display: grid; gap: 0.625rem; }
  .skelbody i { height: 0.875rem; border-radius: var(--r-sm); }
</style>
