<script lang="ts">
  /**
   * Why a number is what it is: hovering it (or focusing it, a tap on a
   * phone, or holding a finger or pencil on it) brings up a small card of its parts — "Leather armour 11,
   * Dexterity +3, Shield +2 = 16". Drawn over the page, so no module's edge
   * clips it.
   */
  import type { Snippet } from 'svelte';
  import { scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { portal } from '$lib/actions';
  import { prefersReducedMotion } from '$lib/motion';
  import type { Part } from '$lib/rules/equipment';

  let {
    title,
    parts = [],
    total = '',
    lines = [],
    hint = '',
    children
  }: {
    title: string;
    parts?: Part[];
    total?: string;
    /** Instead of a sum: what it does, a line each ("Advantage on initiative"). */
    lines?: string[];
    hint?: string;
    children: Snippet;
  } = $props();

  let anchor = $state<HTMLSpanElement>();
  let open = $state(false);
  let pos = $state({ x: 0, y: 0, below: false });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let tapped = false;
  /**
   * Holding a finger or a pencil on the box: after a moment the card opens,
   * and that is all the press does. It doesn't roll the die under it, and
   * the browser doesn't select the text or bring up its magnifier.
   */
  let hold: { id: number; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null = null;
  let held = false;
  function startHold(e: PointerEvent) {
    endHold();
    held = false;
    const timer = setTimeout(() => {
      held = true;
      hold = null;
      clearTimeout(timer);
      place();
      open = true;
      try { navigator.vibrate?.(8); } catch { /* not everywhere */ }
    }, 420);
    hold = { id: e.pointerId, x: e.clientX, y: e.clientY, timer };
  }
  function endHold() {
    if (hold) clearTimeout(hold.timer);
    hold = null;
  }
  /** The click that ends a hold is not a press of what is under it. */
  function swallow(e: MouseEvent) {
    if (!held) return;
    held = false;
    e.preventDefault();
    e.stopPropagation();
  }
  const sign = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

  /** Above the whole box it explains (never over it), or below when there is no room above. */
  function place() {
    const el = (anchor?.firstElementChild as HTMLElement | null) ?? anchor;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const tall = 46 + (parts.length + lines.length) * 20 + (hint ? 34 : 0);
    const below = r.top - tall - 12 < 0;
    pos = { x: Math.min(window.innerWidth - 134, Math.max(134, r.left + r.width / 2)), y: below ? r.bottom + 8 : r.top - 8, below };
  }
  function show(delay = 260) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      place();
      open = true;
    }, delay);
  }
  function hide() {
    clearTimeout(timer);
    open = false;
  }
  // On a phone there is no pointer leaving: a tap anywhere else, or a
  // scroll, puts it away.
  $effect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!anchor?.contains(e.target as Node)) hide();
    };
    const off = () => hide();
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('scroll', off, { passive: true, capture: true });
    window.addEventListener('resize', off);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('scroll', off, { capture: true });
      window.removeEventListener('resize', off);
    };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span class="why" bind:this={anchor}
      onpointerenter={(e) => e.pointerType === 'mouse' && show()}
      onpointerleave={(e) => e.pointerType === 'mouse' && hide()}
      onpointerdown={(e) => {
        tapped = e.pointerType !== 'mouse';
        held = false;
        if (e.pointerType === 'mouse') return;
        // A tap on something that does a thing (a die to roll, a field) is that thing, not a question;
        // holding it still shows the card.
        const field = (e.target as Element).closest('input, select, textarea, [contenteditable]');
        if (!field) startHold(e);
        if ((e.target as Element).closest('button, input, select, textarea, a, [contenteditable]')) return;
        if (open) hide(); else show(0);
      }}
      onpointermove={(e) => {
        if (hold && e.pointerId === hold.id && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10) endHold();
      }}
      onpointerup={endHold}
      onpointercancel={endHold}
      onclickcapture={swallow}
      oncontextmenu={(e) => { if (tapped) e.preventDefault(); }}
      onfocusin={() => {
        // Focus from the keyboard opens it; focus from a tap (on a die to roll) does not.
        if (tapped) { tapped = false; return; }
        show(120);
      }}
      onfocusout={hide}>
  {@render children()}
</span>

{#if open}
  <div class="card" class:below={pos.below} use:portal role="tooltip" style:left="{pos.x}px" style:top="{pos.y}px"
       transition:scale={{ duration: prefersReducedMotion() ? 0 : 160, start: 0.92, easing: cubicOut }}>
    <b class="t">{title}</b>
    {#if parts.length}
      <ul>
        {#each parts as p, i (i)}
          <li><span>{p.label}{#if p.note}<em> · {p.note}</em>{/if}</span><span class="v">{i === 0 && p.value >= 0 ? p.value : sign(p.value)}</span></li>
        {/each}
      </ul>
    {/if}
    {#if lines.length}
      <ul class="lines">{#each lines as line, i (i)}<li>{line}</li>{/each}</ul>
    {/if}
    {#if total}<div class="sum"><span>Total</span><span class="v">{total}</span></div>{/if}
    {#if hint}<p>{hint}</p>{/if}
  </div>
{/if}

<style>
  .why { display: contents; }
  /* Holding a box is for its card: no text selection, no magnifier, no
     long-press menu. Fields inside still take text as usual. */
  .why > :global(*) { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  .why > :global(*) :global(:is(input, textarea, [contenteditable='true'])) { -webkit-user-select: text; user-select: text; }
  .card {
    position: fixed; z-index: 90; transform: translate(-50%, -100%); transform-origin: 50% 100%;
    width: max-content; max-width: min(16rem, 90vw); padding: 0.5rem 0.625rem; border-radius: var(--r-sm);
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    box-shadow: 0 12px 28px -12px rgb(0 0 0 / 0.6); pointer-events: none; font-size: 0.8125rem; text-align: left;
  }
  .card.below { transform: translate(-50%, 0); transform-origin: 50% 0; }
  .t { display: block; font-size: 0.6875rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--label); margin-bottom: 0.25rem; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.125rem; }
  li, .sum { display: flex; justify-content: space-between; gap: 1rem; }
  li em { color: var(--dim); font-style: normal; font-size: 0.75rem; }
  .lines li { display: list-item; list-style: none; padding-left: 0.75rem; position: relative; }
  .lines li::before { content: ''; position: absolute; left: 0; top: 0.55em; width: 0.3125rem; height: 0.3125rem; border-radius: 50%; background: var(--a); }
  .v { font-variant-numeric: tabular-nums; font-weight: 600; }
  .sum { margin-top: 0.25rem; padding-top: 0.25rem; border-top: 1px solid var(--line-soft); color: var(--a); }
  p { margin: 0.375rem 0 0; font-size: 0.75rem; color: var(--dim); line-height: 1.4; }
</style>
