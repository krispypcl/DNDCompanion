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
