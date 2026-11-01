<script lang="ts">
  /**
   * Covers what is inside until it is hovered, reached with the keyboard, or
   * — where there is no hover, on a phone — tapped. Used on death saves, the
   * table's moment of suspense. The cover is opaque, not a blur: a blur still
   * showed how many dots were lit and in which colour.
   *
   * What is inside can be pressed. While it is covered, the first tap only
   * uncovers it, so nobody marks a death save they could not see. It covers
   * itself again as soon as the pointer leaves, or a tap lands elsewhere.
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

  let root: HTMLDivElement | undefined = $state();

  // A tap anywhere else covers it again.
  $effect(() => {
    if (!pinned) return;
    const away = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) pinned = false;
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  });

  /** Only keyboard focus uncovers it. A mouse click focuses the button it
      lands on too, and that focus used to hold the cover open after the
      pointer had gone. */
  let pressing = false;
  function focusIn(e: FocusEvent) {
    const t = e.target as HTMLElement;
    focused = !pressing && typeof t.matches === 'function' && t.matches(':focus-visible');
  }
  function press() {
    pressing = true;
    setTimeout(() => (pressing = false), 0);
  }
</script>

{#if enabled}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    bind:this={root}
    class="reveal"
    class:veiled={!open}
    role="group"
    tabindex="0"
    aria-label={open ? undefined : 'Hidden. Hover, focus or tap to reveal.'}
    onclickcapture={capture}
    {onclick}
    onkeydown={onkey}
    onpointerenter={(e) => { if (e.pointerType === 'mouse') hovering = true; }}
    onpointerleave={(e) => { if (e.pointerType === 'mouse') { hovering = false; pinned = false; } }}
    onpointerdowncapture={press}
    onfocusin={focusIn}
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
  .inner { transition: opacity 0.22s ease, filter 0.22s ease; }
  /* Nothing of what is underneath shows through: not the count, not the colours. */
  .veiled .inner { opacity: 0; filter: blur(4px); user-select: none; }
  .cue {
    position: absolute; inset: 0; display: grid; place-items: center;
    pointer-events: none; opacity: 0; transition: opacity 0.22s ease;
  }
  .veiled .cue { opacity: 1; }
  .cue::before {
    content: attr(data-cue);
    font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--dim); font-weight: 600;
    border: 1px dashed var(--line); border-radius: 999px; padding: 0.375rem 0.875rem;
  }
  @media (hover: none) { .cue::before { content: attr(data-tap); } }
</style>
