<script lang="ts">
  import { isHomebrew, lookupUrl, type LookupCategory } from '#lib/rules/lookup.ts';
  import { peekTarget } from '#lib/rules/peek.ts';
  import { peek, themeAt } from '#lib/stores/peek.svelte.ts';

  let {
    name,
    source,
    category,
    override,
    parent,
    hover = 'parent'
  }: {
    name: string;
    source?: string;
    category: LookupCategory;
    override?: string;
    /** For a subclass: its class. */
    parent?: { name: string; source?: string };
    /**
     * What a resting pointer opens the peek from: the name around the link
     * (reading), or only the link itself (beside a box being typed in, where
     * a pointer resting on the box should not open anything).
     */
    hover?: 'parent' | 'self';
  } = $props();

  const href = $derived(lookupUrl(name, source, category, override, parent));
  const homebrew = $derived(!href && isHomebrew(source));
  /** 5e.tools pages open in the peek; anything else (a homebrew site) only in a new tab. */
  const peeks = $derived(Boolean(href && peekTarget(href)));

  let link = $state<HTMLAnchorElement>();

  function target() {
    if (!link || !href) return null;
    // The window opens beside the book icon itself, not the end of a long
    // name cell (a class card, a feature row) far from it.
    return { name, url: href, anchor: link.getBoundingClientRect(), ...themeAt(link) };
  }

  /*
   * Resting the pointer on the name (the link's parent, not just the small
   * icon) opens the peek beside it. Only for a mouse or pen: a finger has no
   * hover, so on touch the icon itself opens it (below).
   */
  $effect(() => {
    const around = hover === 'self' ? link : link?.parentElement;
    if (!around || !peeks) return;
    const enter = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.buttons) return;
      peek.hoverIn(target, { x: e.clientX, y: e.clientY });
    };
    const leave = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') peek.hoverOut({ x: e.clientX, y: e.clientY });
    };
    around.addEventListener('pointerenter', enter);
    around.addEventListener('pointerleave', leave);
    return () => {
      around.removeEventListener('pointerenter', enter);
      around.removeEventListener('pointerleave', leave);
    };
  });

  /**
   * A click or tap opens the peek, never the page itself: only the peek's
   * own Open on 5e.tools leaves for 5e.tools. (Only links 5e.tools can't
   * show in the peek, such as a homebrew site, open in a new tab.)
   */
  function open(e: MouseEvent) {
    if (!peeks) return;
    e.preventDefault();
    const t = target();
    if (!t) return;
    peek.show(t, { tapped: true });
    // With a mouse, a click keeps it: the same as pressing its pin.
    if (typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches) peek.pinned = true;
  }
</script>

{#if href}
  <a
    class="lookup"
    {href}
    bind:this={link}
    onclick={open}
    onauxclick={(e) => peeks && e.preventDefault()}
    target="_blank"
    rel="noopener noreferrer"
    title="Look up {name}"
    aria-label="Look up {name}"
  >
    <!-- An open book: look it up. -->
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M8 4.2C6.6 3.2 4.6 2.8 2 3v9c2.6-.2 4.6.2 6 1.2 1.4-1 3.4-1.4 6-1.2V3c-2.6-.2-4.6.2-6 1.2Zm0 0v9"
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linejoin="round"
      />
    </svg>
  </a>
{:else if homebrew}
  <span class="homebrew">Homebrew</span>
{/if}

<style>
  /* Quiet on desktop until hover; faintly present on touch, where there is no hover. */
  .lookup {
    color: var(--dim);
    opacity: 0;
    transition: opacity 0.15s var(--ease-out), color 0.15s var(--ease-out);
    display: inline-flex;
    align-items: center;
    padding: 0.1rem;
  }
  :global(*:hover) > .lookup,
  .lookup:focus-visible {
    opacity: 1;
  }
  .lookup:hover { color: var(--accent); }
  @media (hover: none) {
    .lookup { opacity: 0.45; }
  }
  .homebrew {
    font-size: 0.6rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--dim);
    border: 1px solid var(--line);
    border-radius: 3px;
    padding: 0.05rem 0.3rem;
    white-space: nowrap;
  }
</style>
