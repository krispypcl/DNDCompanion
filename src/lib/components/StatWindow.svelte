<!--
  A creature's stat block in a window of its own over the campaign page,
  laid out as a 5e.tools window from the search is: moved by its title,
  brought to the front when pressed, and fading as × or Esc closes it. A creature from 5e.tools
  (or with a link of the DM's) has a button for its page, with the lore and
  pictures the stat block leaves out.
-->
<script lang="ts">
  import { fade, prefersReducedMotion } from '#lib/motion.ts';
  import { movable, portal } from '#lib/actions.ts';
  import { isEmpty, kindLine, statBlockHtml, type StatBlock } from '#lib/rules/statblock.ts';
  import { windowSounds } from '#lib/sound.ts';

  let {
    name,
    statblock,
    left,
    top,
    z = 0,
    link = null,
    onlink,
    onclose,
    onfront
  }: {
    name: string; statblock: StatBlock; left: number; top: number; z?: number;
    /** Its page (5e.tools, or the DM's own link); onlink opens a 5e.tools page in its pop-up. */
    link?: string | null; onlink?: (e: MouseEvent) => void;
    onclose: () => void; onfront: () => void;
  } = $props();
  const onFive = $derived(Boolean(link && /^https:\/\/5e\.tools\//.test(link)));

  // Heard as it opens and as it goes.
  $effect(windowSounds);
</script>

<div class="statwindow" role="dialog" tabindex="-1" aria-label="{name}’s stat block" use:portal use:movable={{ handle: 'header' }}
     style:left="{left}px" style:top="{top}px" style:z-index={70 + z} onpointerdown={onfront} onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onclose(); } }}
     in:fade={{ duration: prefersReducedMotion() ? 0 : 160 }} out:fade={{ duration: prefersReducedMotion() ? 0 : 160 }}>
  <!-- Laid out as a 5e.tools window from the search is (PeekWindow, PeekContent): the
       name heading it with the window's buttons beside it, then the kind, the
       stat block, and its book. -->
  <header>
    <h3 class="statname">{name}</h3>
    <div class="stattools">
      {#if link}
        <a class="smallbtn quiet" href={link} target="_blank" rel="noopener noreferrer" onclick={(e) => onlink?.(e)}
           title={onFive ? 'Its page on 5e.tools, with the lore and pictures' : 'Your link for it'}>{onFive ? 'Open on 5e.tools' : 'Open Your Link'}</a>
      {/if}
      <button type="button" class="closex" aria-label="Close" onclick={onclose}>×</button>
    </div>
  </header>
  <div class="statbody themed-scroll">
    {#if kindLine(statblock)}<p class="statkind">{kindLine(statblock)}</p>{/if}
    {#if isEmpty(statblock)}
      <p class="statnone">No stat block yet. Change it to write one.</p>
    {:else}
      {@html statBlockHtml(statblock)}
      {#if statblock.source}<p class="statsource">{statblock.source === 'Homebrew' ? 'Homebrew' : `From ${statblock.source}`}</p>{/if}
    {/if}
  </div>
</div>

<style>
  /* The same size, frame, and shadow as a 5e.tools window (PeekWindow). */
  .statwindow {
    position: fixed; z-index: 70; width: min(400px, calc(100vw - 24px)); max-height: min(560px, calc(100vh - 24px));
    display: flex; flex-direction: column; overflow: hidden;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--r);
    box-shadow: 0 18px 48px rgb(0 0 0 / 0.45), 0 2px 6px rgb(0 0 0 / 0.3);
  }
  .statwindow:focus { outline: none; }
  :global([data-mode='light']) .statwindow { box-shadow: 0 18px 44px rgb(20 20 40 / 0.16), 0 2px 6px rgb(20 20 40 / 0.08); }
  header {
    display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.75rem 0.625rem 0.625rem 0.875rem;
    border-bottom: 1px solid var(--line-soft);
  }
  .statname { flex: 1; min-width: 0; margin: 0.125rem 0 0; font-size: 1.0625rem; font-weight: 650; line-height: 1.3; color: var(--a); overflow-wrap: anywhere; }
  .stattools { flex: none; display: flex; align-items: center; gap: 0.375rem; --x-size: 1.75rem; }
  .stattools .smallbtn { text-decoration: none; }
  .statbody { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0.75rem 0.875rem 0.875rem; }
  .statkind { margin: 0 0 0.625rem; font-size: 0.8125rem; font-style: italic; color: var(--dim); }
  .statnone { margin: 0; color: var(--dim); font-size: 0.8125rem; }
  .statsource { margin: 0.75rem 0 0; padding-top: 0.5rem; border-top: 1px solid var(--line-soft); font-size: 0.75rem; color: var(--dim); }
  /* A phone: a sheet from the bottom, as a 5e.tools window is there. */
  @media (max-width: 700px) {
    .statwindow {
      left: 0 !important; width: 100%; top: auto !important; bottom: 0; translate: none !important;
      max-height: 75dvh; border-radius: var(--r) var(--r) 0 0; border-bottom: 0; padding-bottom: env(safe-area-inset-bottom, 0px);
    }
  }
</style>
