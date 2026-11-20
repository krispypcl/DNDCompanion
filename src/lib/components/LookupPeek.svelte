<!--
  The 5e.tools peek: the entry under the pointer, shown in a small window on
  the same screen (PeekContent); "Open on 5e.tools" goes to the page itself.
  One for the whole app, mounted in the layout; links open it through
  stores/peek. Dragged somewhere, it stays there as a window of its own
  (PeekWindow) and the next name opens a new peek, so several can be open.
-->
<script lang="ts">
  import { movable } from '#lib/actions.ts';
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { peek } from '#lib/stores/peek.svelte.ts';
  import PeekContent from './PeekContent.svelte';
  import PeekWindow from './PeekWindow.svelte';

  /** Laptop: the window opens beside the name. Phone: a sheet from the bottom. */
  const NARROW = 640;
  const WIDTH = 400;
  const MAX_HEIGHT = 560;
  const GAP = 10;
  const EDGE = 12;

  let vw = $state(1280);
  let vh = $state(800);
  let boxHeight = $state(0);
  let box = $state<HTMLElement>();
  /** Made on the first peek and kept, so it can ease out as well as in. */
  let started = $state(false);

  /*
   * What the window shows. On closing it keeps the last entry, its place and
   * its colours, so it fades where it stood rather than jumping to a corner
   * and emptying as it goes.
   */
  let last = $state<NonNullable<typeof peek.target> | null>(null);
  /** Moving between entries while open glides; opening anew starts in place. */
  let glide = $state(false);
  let wasOpen = false;
  $effect.pre(() => {
    const t = peek.target;
    glide = Boolean(t) && wasOpen;
    if (t) last = t;
    wasOpen = Boolean(t);
  });
  const target = $derived(peek.target ?? last);
  const open = $derived(Boolean(peek.target));
  const narrow = $derived(vw < NARROW);
  const width = $derived(narrow ? vw : Math.min(WIDTH, vw - 2 * EDGE));
  const maxHeight = $derived(narrow ? Math.min(Math.round(vh * 0.75), MAX_HEIGHT) : Math.min(MAX_HEIGHT, vh - 2 * EDGE));

  /** Beside the name if there is room, else on the side of the screen away from it. */
  const place = $derived.by(() => {
    if (!target || narrow) return { left: 0, top: null as number | null };
    const a = target.anchor;
    let left: number;
    if (a.right + GAP + width <= vw - EDGE) left = a.right + GAP;
    else if (a.left - GAP - width >= EDGE) left = a.left - GAP - width;
    else left = a.left + a.width / 2 < vw / 2 ? vw - width - EDGE : EDGE;
    const h = boxHeight || maxHeight;
    const top = Math.min(Math.max(a.top - 24, EDGE), vh - h - EDGE);
    return { left: Math.round(left), top: Math.round(top) };
  });

  $effect(() => {
    if (target) started = true;
  });

  // Peeks belong to the page they were opened on: leaving it closes them all.
  let path = '';
  afterNavigate(({ to }) => {
    const next = to?.url.pathname ?? '';
    if (path && next !== path) {
      peek.close();
      peek.kept = [];
    }
    path = next;
  });

  onMount(() => {
    const size = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
    };
    size();
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // A window over the dimmed page (the search, say) is closed first, by its own Esc.
      if (document.querySelector('[aria-modal="true"]')) return;
      // The open peek first, then the windows moved aside, the top one first.
      if (peek.target) {
        e.stopPropagation();
        peek.close();
      } else if (peek.kept.length) {
        e.stopPropagation();
        peek.drop(peek.kept[peek.kept.length - 1].id);
      }
    };
    // A page scrolled away from the name takes a hover peek with it; one kept
    // open, opened by a tap or with the pointer on it stays.
    const scrolled = (e: Event) => {
      if (box?.contains(e.target as Node) || (e.target as Element)?.closest?.('.peek-window')) return;
      if (peek.target && !peek.pinned && !peek.tapped && !peek.inside) peek.close();
    };
    // A tap outside closes a tapped peek (except on another link, which swaps it).
    const down = (e: PointerEvent) => {
      if (!peek.target || peek.pinned) return;
      const t = e.target as Element | null;
      if (box?.contains(t) || t?.closest?.('.lookup')) return;
      if (peek.tapped) peek.close();
    };
    window.addEventListener('resize', size);
    window.addEventListener('keydown', key, true);
    window.addEventListener('scroll', scrolled, { passive: true, capture: true });
    window.addEventListener('pointerdown', down, true);
    return () => {
      window.removeEventListener('resize', size);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('scroll', scrolled, true);
      window.removeEventListener('pointerdown', down, true);
    };
  });
</script>

<!-- The peeks moved aside, each where it was put. -->
{#each peek.kept as k (k.id)}
  <PeekWindow kept={k} />
{/each}

{#if started}
  <div
    bind:this={box}
    bind:offsetHeight={boxHeight}
    class="lookup-peek themed"
    use:movable={{ handle: 'header', key: open, enabled: !narrow, ondrop: (r) => peek.keep(r) }}
    class:open
    class:quiet={peek.quiet}
    class:glide
    class:narrow
    role="dialog"
    aria-label={target ? `${target.name} on 5e.tools` : '5e.tools'}
    aria-hidden={!open}
    inert={!open}
    style:--h={target?.hue}
    style:--c={target?.chroma}
    style:left="{place.left}px"
    style:top={place.top === null ? null : `${place.top}px`}
    style:bottom={place.top === null ? '0px' : null}
    style:width="{width}px"
    style:max-height="{maxHeight}px"
    onpointerenter={(e) => e.pointerType !== 'touch' && peek.enter()}
    onpointerleave={(e) => e.pointerType !== 'touch' && peek.leave()}
  >
    {#if target}
      <PeekContent name={target.name} url={target.url}>
        {#snippet tools()}
          <button
            type="button"
            class="peek-pin"
            class:on={peek.pinned}
            aria-pressed={peek.pinned}
            aria-label={peek.pinned ? 'Kept open' : 'Keep open'}
            title={peek.pinned ? 'Kept open: hover another name to swap it' : 'Keep it open while you look at others'}
            onclick={() => (peek.pinned = !peek.pinned)}
          >
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M6 2h4l-.6 4 2.6 2.4V10H4V8.4L6.6 6 6 2Zm2 8v4" fill={peek.pinned ? 'currentColor' : 'none'}
                    stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" />
            </svg>
          </button>
          <a class="smallbtn quiet" href={target.url} target="_blank" rel="noopener noreferrer">Open on 5e.tools</a>
          <button type="button" class="closex" aria-label="Close" onclick={() => peek.close()}>×</button>
        {/snippet}
      </PeekContent>
    {/if}
  </div>
{/if}

<style>
  .lookup-peek {
    position: fixed;
    z-index: 90;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r);
    box-shadow: 0 18px 48px rgb(0 0 0 / 0.45), 0 2px 6px rgb(0 0 0 / 0.3);
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
    transform: translateY(6px) scale(0.985);
    transform-origin: 50% 0;
    /* Out: a quick fade with a slight drop, then hidden once it is gone. */
    transition:
      opacity 0.16s ease-out,
      transform 0.18s ease-out,
      visibility 0s linear 0.18s;
  }
  /* From one entry to the next while open, the window glides to its new place. */
  .lookup-peek.open.glide {
    transition:
      opacity 0.16s ease-out,
      transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
      visibility 0s,
      left 0.22s cubic-bezier(0.22, 1, 0.36, 1),
      top 0.22s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .lookup-peek.open {
    opacity: 1;
    visibility: visible;
    transform: none;
    transition:
      opacity 0.16s ease-out,
      transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
      visibility 0s;
  }
  /* A phone: a sheet risen from the bottom edge, as wide as the screen. */
  .lookup-peek.narrow {
    border-radius: var(--r) var(--r) 0 0;
    border-bottom: 0;
    transform: translateY(24px);
    transform-origin: 50% 100%;
  }
  .lookup-peek.narrow.open { transform: none; }
  :global([data-mode='light']) .lookup-peek {
    box-shadow: 0 18px 44px rgb(20 20 40 / 0.16), 0 2px 6px rgb(20 20 40 / 0.08);
  }


  /* Moved aside: it became a kept window in the same place, so it goes at once. */
  .lookup-peek.quiet:not(.open) { transition: none; }
  @media (prefers-reduced-motion: reduce) {
    .lookup-peek { transition: none; }
  }
</style>
