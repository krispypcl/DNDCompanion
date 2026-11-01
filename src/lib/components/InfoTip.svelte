<script lang="ts">
  /**
   * An "i" in a circle that explains the thing beside it. Hovering shows the
   * note on a computer; a click or tap pins it, on any device, until it is
   * dismissed by another tap, by Escape, or by pressing anywhere else.
   *
   * The note is placed against the window, not inside the panel, so a narrow
   * phone column or a scrolling table cannot cut it off.
   */
  import { onMount, tick } from 'svelte';

  let { label = 'More information', children }: { label?: string; children: import('svelte').Snippet } = $props();

  let pinned = $state(false);
  let hovering = $state(false);
  const open = $derived(pinned || hovering);
  let button: HTMLButtonElement | undefined = $state();
  let note: HTMLDivElement | undefined = $state();
  let place = $state({ left: 0, top: 0, above: false });
  const id = `tip-${Math.random().toString(36).slice(2, 9)}`;

  /** Moved to the end of the page: a frosted panel (backdrop-filter) becomes
      the frame for anything fixed inside it, which would place the note
      against the panel rather than the window. */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  async function position() {
    await tick();
    if (!button || !note) return;
    const b = button.getBoundingClientRect();
    const width = note.offsetWidth;
    const height = note.offsetHeight;
    const margin = 12;
    const left = Math.min(Math.max(b.left + b.width / 2 - width / 2, margin), window.innerWidth - width - margin);
    const below = b.bottom + 8;
    const above = below + height > window.innerHeight - margin && b.top - 8 - height > margin;
    place = { left, top: above ? b.top - 8 - height : below, above };
  }

  $effect(() => {
    if (open) position();
  });

  onMount(() => {
    const close = (e: Event) => {
      if (!pinned) return;
      const t = e.target as Node;
      if (button?.contains(t) || note?.contains(t)) return;
      pinned = false;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') pinned = hovering = false;
    };
    const move = () => open && position();
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', move, { passive: true, capture: true });
    window.addEventListener('resize', move);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', move, { capture: true });
      window.removeEventListener('resize', move);
    };
  });
</script>

<button
  bind:this={button}
  class="info"
  class:on={open}
  type="button"
  aria-label={label}
  aria-expanded={open}
  aria-describedby={open ? id : undefined}
  onclick={() => (pinned = !pinned)}
  onpointerenter={(e) => { if (e.pointerType === 'mouse') hovering = true; }}
  onpointerleave={(e) => { if (e.pointerType === 'mouse') hovering = false; }}
>
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6" />
    <path d="M12 11v5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    <circle cx="12" cy="7.75" r="1.1" fill="currentColor" />
  </svg>
</button>

{#if open}
  <div bind:this={note} use:portal {id} role="tooltip" class="note" class:above={place.above}
       style:left="{place.left}px" style:top="{place.top}px">
    {@render children()}
  </div>
{/if}

<style>
  .info {
    display: inline-grid; place-items: center; width: 1.75rem; height: 1.75rem;
    background: none; border: 0; border-radius: 50%; padding: 0; cursor: pointer;
    color: var(--dim); vertical-align: middle;
    transition: color 0.15s ease, background-color 0.15s ease;
  }
  .info:hover, .info.on { color: var(--a); background: var(--a-wash); }
  .note {
    position: fixed; z-index: 50; max-width: min(20rem, calc(100vw - 24px));
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r); padding: 0.625rem 0.75rem;
    font-size: 0.8125rem; line-height: 1.5;
    box-shadow: 0 10px 28px rgb(0 0 0 / 0.28);
    animation: tipIn 0.16s cubic-bezier(0.2, 0.8, 0.3, 1);
  }
  .note.above { animation-name: tipInAbove; }
  .note :global(code) { background: var(--bg); border-radius: 3px; padding: 0.05rem 0.25rem; font-size: 0.95em; }
  @keyframes tipIn { from { opacity: 0; transform: translateY(-4px); } }
  @keyframes tipInAbove { from { opacity: 0; transform: translateY(4px); } }
  @media (max-width: 700px) {
    .info { width: 2.25rem; height: 2.25rem; }
    .note { font-size: 0.875rem; }
  }
</style>
