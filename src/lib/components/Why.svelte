<script lang="ts">
  /**
   * Why a number is what it is: hovering it (or focusing it, or a tap on a
   * phone) brings up a small card of its parts — "Leather armour 11,
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
    parts,
    total,
    hint = '',
    children
  }: { title: string; parts: Part[]; total: string; hint?: string; children: Snippet } = $props();

  let anchor = $state<HTMLSpanElement>();
  let open = $state(false);
  let pos = $state({ x: 0, y: 0, below: false });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const sign = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

  /** Above the whole box it explains (never over it), or below when there is no room above. */
  function place() {
    const el = (anchor?.firstElementChild as HTMLElement | null) ?? anchor;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const tall = 46 + parts.length * 20 + (hint ? 34 : 0);
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
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span class="why" bind:this={anchor}
      onpointerenter={(e) => e.pointerType === 'mouse' && show()}
      onpointerleave={(e) => e.pointerType === 'mouse' && hide()}
      onpointerdown={(e) => {
        // A tap on something that does a thing (a die to roll, a field) is that thing, not a question.
        if (e.pointerType === 'mouse' || (e.target as Element).closest('button, input, select, textarea, a, [contenteditable]')) return;
        if (open) hide(); else show(0);
      }}
      onfocusin={() => show(120)} onfocusout={hide}>
  {@render children()}
</span>

{#if open}
  <div class="card" class:below={pos.below} use:portal role="tooltip" style:left="{pos.x}px" style:top="{pos.y}px"
       transition:scale={{ duration: prefersReducedMotion() ? 0 : 160, start: 0.92, easing: cubicOut }}>
    <b class="t">{title}</b>
    <ul>
      {#each parts as p, i (i)}
        <li><span>{p.label}{#if p.note}<em> · {p.note}</em>{/if}</span><span class="v">{i === 0 && p.value >= 0 ? p.value : sign(p.value)}</span></li>
      {/each}
    </ul>
    <div class="sum"><span>Total</span><span class="v">{total}</span></div>
    {#if hint}<p>{hint}</p>{/if}
  </div>
{/if}

<style>
  .why { display: contents; }
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
  .v { font-variant-numeric: tabular-nums; font-weight: 600; }
  .sum { margin-top: 0.25rem; padding-top: 0.25rem; border-top: 1px solid var(--line-soft); color: var(--a); }
  p { margin: 0.375rem 0 0; font-size: 0.75rem; color: var(--dim); line-height: 1.4; }
</style>
