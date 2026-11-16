<!--
  A 5e.tools peek moved aside (stores/peek `keep`): a window of its own that
  stays where it was put, can be dragged again and comes to the front when
  pressed, until its × (or Esc) closes it.
-->
<script lang="ts">
  import { movable } from '$lib/actions';
  import { peek, type KeptPeek } from '$lib/stores/peek.svelte';
  import PeekContent from './PeekContent.svelte';

  let { kept }: { kept: KeptPeek } = $props();
  const MAX_HEIGHT = 560;
</script>

<div
  class="peek-window themed"
  role="dialog"
  tabindex="-1"
  aria-label="{kept.target.name} on 5e.tools"
  use:movable={{ handle: 'header' }}
  style:--h={kept.target.hue}
  style:--c={kept.target.chroma}
  style:left="{kept.left}px"
  style:top="{kept.top}px"
  style:width="{kept.width}px"
  style:max-height="min({MAX_HEIGHT}px, calc(100vh - 24px))"
  onpointerdown={() => peek.front(kept.id)}
>
  <PeekContent name={kept.target.name} url={kept.target.url}>
    {#snippet tools()}
      <!-- The same pin as the open peek's, pressed: this one stays. Pressing it lets it go. -->
      <button type="button" class="peek-pin on" aria-pressed="true" aria-label="Kept here" title="Kept here: press to let it go"
              onclick={() => peek.drop(kept.id)}>
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <path d="M6 2h4l-.6 4 2.6 2.4V10H4V8.4L6.6 6 6 2Zm2 8v4" fill="currentColor"
                stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
      </button>
      <a class="smallbtn quiet" href={kept.target.url} target="_blank" rel="noopener noreferrer">Open on 5e.tools</a>
      <button type="button" class="closex" aria-label="Close" onclick={() => peek.drop(kept.id)}>×</button>
    {/snippet}
  </PeekContent>
</div>

<style>
  .peek-window {
    position: fixed;
    z-index: 70;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r);
    box-shadow: 0 18px 48px rgb(0 0 0 / 0.45), 0 2px 6px rgb(0 0 0 / 0.3);
    overflow: hidden;
  }
  .peek-window:focus { outline: none; }
  :global([data-mode='light']) .peek-window {
    box-shadow: 0 18px 44px rgb(20 20 40 / 0.16), 0 2px 6px rgb(20 20 40 / 0.08);
  }
</style>
