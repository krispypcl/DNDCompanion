<!--
  A 5e.tools peek moved aside (stores/peek `keep`): a window of its own that
  stays where it was put, can be dragged again, and comes to the front when
  pressed, until its × (or Esc) closes it, and it fades as it goes. Asked for
  again, it glides from where it is to where it was asked to open.
-->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import { movable } from '#lib/actions.ts';
  import { prefersReducedMotion } from '#lib/motion.ts';
  import { peek, type KeptPeek } from '#lib/stores/peek.svelte.ts';
  import PeekContent from './PeekContent.svelte';
  import { windowSounds } from '#lib/sound.ts';

  let { kept }: { kept: KeptPeek } = $props();
  const MAX_HEIGHT = 560;
  const still = prefersReducedMotion();

  // Sent somewhere new: where it stood is measured first, and once it stands
  // in its new place it glides there from the old one (dragging it again
  // starts afresh from the new place: movable's key).
  let node = $state<HTMLElement>();
  let from: DOMRect | null = null;
  $effect.pre(() => {
    if (kept.moves && node) from = node.getBoundingClientRect();
  });
  $effect(() => {
    if (!kept.moves || !node || !from) return;
    const was = from;
    from = null;
    node.style.translate = '';
    const now = node.getBoundingClientRect();
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (still || (Math.abs(dx) < 1 && Math.abs(dy) < 1)) return;
    node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
      duration: 340, easing: 'cubic-bezier(0.33, 1, 0.68, 1)'
    });
  });

  // Heard as it opens and as it goes.
  $effect(windowSounds);
</script>

<div
  class="peek-window themed"
  role="dialog"
  tabindex="-1"
  aria-label="{kept.target.name} on 5e.tools"
  bind:this={node}
  use:movable={{ handle: 'header', key: kept.moves }}
  style:--h={kept.target.hue}
  style:--c={kept.target.chroma}
  style:left="{kept.left}px"
  style:top="{kept.top}px"
  style:width="{kept.width}px"
  style:max-height="min({MAX_HEIGHT}px, calc(100vh - 24px))"
  onpointerdown={() => peek.front(kept.id)}
  in:fade={{ duration: still || !kept.opened ? 0 : 160 }}
  out:fade={{ duration: still ? 0 : 160 }}
>
  <PeekContent name={kept.target.name} url={kept.target.url}>
    {#snippet tools()}
      {#if !kept.fromSearch}
        <!-- The same pin as the open peek's, pressed: this one stays. Pressing it lets it go.
             (One from the search is always kept: it has only its ×.) -->
        <button type="button" class="peek-pin on" aria-pressed="true" aria-label="Kept here" title="Kept here: press to let it go"
                onclick={() => peek.drop(kept.id)}>
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path d="M6 2h4l-.6 4 2.6 2.4V10H4V8.4L6.6 6 6 2Zm2 8v4" fill="currentColor"
                  stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" />
          </svg>
        </button>
      {/if}
      <a class="smallbtn quiet" href={kept.target.url} target="_blank" rel="noopener noreferrer">Open on 5e.tools</a>
      <button type="button" class="closex" aria-label="Close" onclick={() => peek.drop(kept.id)}>×</button>
    {/snippet}
  </PeekContent>
</div>

<style>
  .peek-window {
    position: fixed;
    z-index: 90;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r);
    box-shadow: 0 18px 48px rgb(0 0 0 / 0.45), 0 2px 6px rgb(0 0 0 / 0.3);
    overflow: hidden;
  }
  .peek-window:focus { outline: none; }
  /* A phone: a kept window is a sheet from the bottom, as the open peek is. */
  @media (max-width: 700px) {
    .peek-window {
      left: 0 !important; width: 100% !important; top: auto !important; bottom: 0; translate: none !important;
      max-height: 75dvh !important; border-radius: var(--r) var(--r) 0 0; border-bottom: 0;
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
  }
  :global([data-mode='light']) .peek-window {
    box-shadow: 0 18px 44px rgb(20 20 40 / 0.16), 0 2px 6px rgb(20 20 40 / 0.08);
  }
</style>
