<script lang="ts">
  /**
   * Blurs what is inside until it is hovered, focused, or — where there is no
   * hover, on a phone — tapped. It is for a screen that other people can see,
   * not for secrecy: the text is all still on the page. Anything that must be
   * kept from a reader is made private, which the database enforces.
   */
  let {
    enabled,
    children
  }: {
    enabled: boolean;
    children: import('svelte').Snippet;
  } = $props();

  /** A tap (or click) holds it open; leaving or tapping again lets it go. */
  let pinned = $state(false);

  function toggle() {
    if (enabled) pinned = !pinned;
  }

  function onkey(event: KeyboardEvent) {
    if (!enabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    } else if (event.key === 'Escape') {
      pinned = false;
    }
  }

  $effect(() => {
    if (!enabled) pinned = false;
  });
</script>

{#if enabled}
  <div
    class="reveal"
    class:veiled={!pinned}
    role="button"
    tabindex="0"
    aria-pressed={pinned}
    aria-label="Hidden until hovered. Press to keep it showing."
    onclick={toggle}
    onkeydown={onkey}
  >
    <div class="inner">{@render children()}</div>
    <span class="cue" aria-hidden="true"></span>
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .reveal { position: relative; cursor: pointer; border-radius: var(--r-sm); outline-offset: 2px; }
  .inner { transition: filter 0.28s ease, opacity 0.28s ease; }
  .veiled .inner { filter: blur(7px); opacity: 0.8; user-select: none; }
  /* Hover lifts it, but only where hovering is a thing: on a touch screen a
     tap leaves :hover stuck on, and it would never go back. */
  @media (hover: hover) {
    .veiled:hover .inner { filter: none; opacity: 1; user-select: auto; }
  }
  .veiled:focus-visible .inner,
  .veiled:focus-within .inner { filter: none; opacity: 1; }

  .cue {
    position: absolute; inset: 0; display: grid; place-items: center;
    pointer-events: none; opacity: 1; transition: opacity 0.2s ease;
    font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--dim); font-weight: 600;
  }
  .cue::before { content: 'Hover to read'; }
  @media (hover: none) { .cue::before { content: 'Tap to read'; } }
  .reveal:not(.veiled) .cue,
  .veiled:focus-within .cue { opacity: 0; }
  @media (hover: hover) { .veiled:hover .cue { opacity: 0; } }
</style>
