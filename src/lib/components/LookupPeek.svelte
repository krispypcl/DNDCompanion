<!--
  The 5e.tools peek: the entry under the pointer, shown in a small window on
  the same screen, cut down to the entry itself (5e.tools' list, header and
  adverts stay outside the hole). One for the whole app, mounted in the layout;
  links open it through stores/peek.

  How the cut works: 5e.tools is loaded in a frame as wide as a desktop
  (FRAME_WIDTH), where its entry panel always sits at a known place
  (rules/peek). The frame is scaled to fit the window and shifted so only that
  panel shows through. The panel scrolls inside the frame as it does on 5e.tools.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { peek } from '$lib/stores/peek.svelte';
  import { FRAME_WIDTH, peekCrop } from '$lib/rules/peek';

  /** Laptop: the window opens beside the name. Phone: a sheet from the bottom. */
  const NARROW = 640;
  const MAX_WIDTH = 560;
  const MAX_HEIGHT = 640;
  const GAP = 16;
  const EDGE = 12;

  let vw = $state(1280);
  let vh = $state(800);
  let holeWidth = $state(0);
  let holeHeight = $state(0);

  /** What the frame has loaded (the page, without its #hash). */
  let loadedPage = $state('');
  let src = $state('');
  let loading = $state(false);
  let slow = $state(false);
  let offline = $state(false);
  /** The frame is made on the first peek and kept, so the next one is quick. */
  let started = $state(false);
  let box = $state<HTMLElement>();

  const target = $derived(peek.target);
  const open = $derived(Boolean(target));
  const crop = $derived(target ? peekCrop(target.url) : null);
  const narrow = $derived(vw < NARROW);

  const width = $derived(
    narrow ? vw : Math.min(crop?.width ?? 463, MAX_WIDTH, vw - 2 * EDGE)
  );
  const height = $derived(narrow ? Math.min(Math.round(vh * 0.75), MAX_HEIGHT) : Math.min(MAX_HEIGHT, vh - 2 * EDGE));

  /** Beside the name if there is room, else on the side of the screen away from it. */
  const place = $derived.by(() => {
    if (!target || narrow) return { left: 0, top: vh - height };
    const a = target.anchor;
    let left: number;
    if (a.right + GAP + width <= vw - EDGE) left = a.right + GAP;
    else if (a.left - GAP - width >= EDGE) left = a.left - GAP - width;
    else left = a.left + a.width / 2 < vw / 2 ? vw - width - EDGE : EDGE;
    const top = Math.min(Math.max(a.top - 48, EDGE), vh - height - EDGE);
    return { left: Math.round(left), top: Math.round(top) };
  });

  /** Scale and shift the frame so the entry panel fills the hole. */
  const frame = $derived.by(() => {
    if (!crop || !holeWidth || !holeHeight) return null;
    const scale = Math.min(1, holeWidth / crop.width);
    const seen = holeHeight / scale;
    const tall = crop.y + seen + crop.foot;
    return {
      scale,
      height: Math.ceil(tall),
      transform: `scale(${scale}) translate(${-crop.x}px, ${-crop.y}px)`
    };
  });

  const pageOf = (url: string) => url.split('#')[0];

  // A new page loads the frame; another entry on the same page only moves its
  // #hash, which 5e.tools follows without loading again.
  $effect(() => {
    const url = target?.url;
    if (!url) return;
    started = true;
    offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (pageOf(url) !== loadedPage) {
      loading = true;
      slow = false;
      loadedPage = pageOf(url);
    }
    src = url;
  });

  // A slow page gets a word, not a blank window.
  $effect(() => {
    if (!loading) return;
    const t = setTimeout(() => (slow = true), 9000);
    return () => clearTimeout(t);
  });

  function loaded() {
    loading = false;
    slow = false;
  }

  onMount(() => {
    const size = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
    };
    size();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && peek.target) {
        e.stopPropagation();
        peek.close();
      }
    };
    // A page scrolled away from the name takes a hover peek with it; one kept
    // open, opened by a tap or with the pointer on it stays.
    const scrolled = () => {
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

{#if started}
  <div
    bind:this={box}
    class="lookup-peek themed"
    class:open
    class:narrow
    role="dialog"
    aria-label={target ? `${target.name} on 5e.tools` : '5e.tools'}
    aria-hidden={!open}
    inert={!open}
    style:--h={target?.hue}
    style:--c={target?.chroma}
    style:left="{place.left}px"
    style:top="{place.top}px"
    style:width="{width}px"
    style:height="{height}px"
    onpointerenter={(e) => e.pointerType !== 'touch' && peek.enter()}
    onpointerleave={(e) => e.pointerType !== 'touch' && peek.leave()}
  >
    <header>
      <strong class="peek-name">{target?.name ?? ''}</strong>
      <div class="peek-tools">
        <button
          type="button"
          class="smallbtn quiet keep"
          class:on={peek.pinned}
          aria-pressed={peek.pinned}
          title={peek.pinned ? 'Kept open: hover another name to swap it' : 'Keep it open while you look at others'}
          onclick={() => (peek.pinned = !peek.pinned)}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M6 2h4l-.6 4 2.6 2.4V10H4V8.4L6.6 6 6 2Zm2 8v4" fill={peek.pinned ? 'currentColor' : 'none'}
                  stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" />
          </svg>
          {peek.pinned ? 'Kept open' : 'Keep open'}
        </button>
        <a class="smallbtn quiet" href={target?.url} target="_blank" rel="noopener noreferrer">Open on 5e.tools</a>
        <button type="button" class="closex" aria-label="Close" onclick={() => peek.close()}>×</button>
      </div>
    </header>

    <div class="hole" bind:clientWidth={holeWidth} bind:clientHeight={holeHeight}>
      {#if src}
        <iframe
          title={target ? `${target.name} on 5e.tools` : '5e.tools'}
          {src}
          class:ready={!loading && frame}
          style:width="{FRAME_WIDTH}px"
          style:height="{frame?.height ?? 1200}px"
          style:transform={frame?.transform}
          referrerpolicy="no-referrer"
          onload={loaded}
        ></iframe>
      {/if}
      {#if loading || offline}
        <p class="peek-wait" role="status">
          {#if offline}
            The library is closed while you're offline.
          {:else if slow}
            5e.tools is taking its time. It may open quicker in its own tab.
          {:else}
            Thumbing through the tomes
          {/if}
        </p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .lookup-peek {
    position: fixed;
    z-index: 70;
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
    transition:
      opacity 0.16s ease-out,
      transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
      visibility 0s linear 0.2s,
      left 0.22s cubic-bezier(0.22, 1, 0.36, 1),
      top 0.22s cubic-bezier(0.22, 1, 0.36, 1),
      width 0.22s cubic-bezier(0.22, 1, 0.36, 1),
      height 0.22s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .lookup-peek.open {
    opacity: 1;
    visibility: visible;
    transform: none;
    transition-delay: 0s;
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

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.5rem 0.5rem 0.75rem;
    border-bottom: 1px solid var(--line-soft);
    background: var(--surface);
  }
  .peek-name {
    flex: 1 1 8rem;
    min-width: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
    overflow-wrap: anywhere;
  }
  .peek-tools {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-left: auto;
    --x-size: 1.75rem;
  }
  .keep.on { color: var(--a); border-color: var(--a-edge); }

  .hole {
    position: relative;
    flex: 1;
    overflow: hidden;
    /* A quiet well while 5e.tools loads; its own page covers it after. */
    background: var(--raised);
  }
  iframe {
    position: absolute;
    left: 0;
    top: 0;
    border: 0;
    transform-origin: 0 0;
    opacity: 0;
    transition: opacity 0.25s ease-out;
  }
  iframe.ready { opacity: 1; }

  .peek-wait {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    padding: 1.5rem;
    text-align: center;
    font-size: 0.8125rem;
    color: var(--dim);
    animation: peek-breathe 1.6s ease-in-out infinite alternate;
  }
  @keyframes peek-breathe {
    from { opacity: 0.55; }
    to { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .lookup-peek, iframe { transition: none; }
    .peek-wait { animation: none; }
  }
</style>
