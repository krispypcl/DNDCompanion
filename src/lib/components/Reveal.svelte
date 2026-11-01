<script lang="ts">
  /**
   * Blurs what is inside until it is hovered, focused, or — where there is no
   * hover, on a phone — tapped. Used on death saves, which are the table's
   * moment of suspense: the result is there, but it has to be looked at.
   *
   * What is inside can be pressed. While it is veiled, the first tap only
   * lifts the veil, so nobody marks a death save they could not see.
   */
  let {
    enabled,
    cue = 'Hover to reveal',
    tapCue = 'Tap to reveal',
    children
  }: {
    enabled: boolean;
    cue?: string;
    tapCue?: string;
    children: import('svelte').Snippet;
  } = $props();

  /** A tap (or click on the veil itself) holds it open. */
  let pinned = $state(false);
  let hovering = $state(false);
  let focused = $state(false);
  const open = $derived(pinned || hovering || focused);

  function capture(event: MouseEvent) {
    if (!enabled) return;
    if (!open) {
      // The first press only reveals.
      event.preventDefault();
      event.stopPropagation();
      pinned = true;
    }
  }

  function onclick(event: MouseEvent) {
    // A press on the veil's own surface, not on a control inside it, lets go.
    if (enabled && event.target === event.currentTarget) pinned = !pinned;
  }

  function onkey(event: KeyboardEvent) {
    if (!enabled || event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pinned = !pinned;
    } else if (event.key === 'Escape') {
      pinned = false;
    }
  }

  $effect(() => {
    if (!enabled) pinned = false;
  });
</script>

{#if enabled}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="reveal"
    class:veiled={!open}
    role="group"
    tabindex="0"
    aria-label={open ? undefined : 'Hidden. Hover, focus or tap to reveal.'}
    onclickcapture={capture}
    {onclick}
    onkeydown={onkey}
    onpointerenter={(e) => { if (e.pointerType === 'mouse') hovering = true; }}
    onpointerleave={(e) => { if (e.pointerType === 'mouse') hovering = false; }}
    onfocusin={() => (focused = true)}
    onfocusout={() => (focused = false)}
  >
    <div class="inner">{@render children()}</div>
    <span class="cue" aria-hidden="true" data-cue={cue} data-tap={tapCue}></span>
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .reveal { position: relative; cursor: pointer; border-radius: var(--r-sm); outline-offset: 2px; }
  .inner { transition: filter 0.3s ease, opacity 0.3s ease; }
  .veiled .inner { filter: blur(6px); opacity: 0.7; user-select: none; }
  .cue {
    position: absolute; inset: 0; display: grid; place-items: center;
    pointer-events: none; opacity: 0; transition: opacity 0.2s ease;
    font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--text); font-weight: 600;
  }
  .veiled .cue { opacity: 1; }
  .cue::before { content: attr(data-cue); }
  @media (hover: none) { .cue::before { content: attr(data-tap); } }
</style>
