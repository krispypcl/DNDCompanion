<script lang="ts">
  /**
   * Drawing over a page of notes or backstory: pen strokes on top of the
   * writing, and the paper under it (plain, lines, a grid or dots). Shown
   * always; drawn on only while `drawing` is on, when it takes the pointer
   * and the writing underneath waits. Points are in page-width units, so the
   * drawing grows and shrinks with the page.
   */
  import { fade } from 'svelte/transition';
  import type { Ink, Stroke } from '$lib/rules/ink';

  let {
    ink,
    drawing,
    pen,
    erasing,
    onstroke,
    onerase,
    minHeight = $bindable(0)
  }: {
    ink: Ink | null;
    drawing: boolean;
    pen: { c: string; w: number };
    erasing: boolean;
    onstroke: (s: Stroke) => void;
    onerase: (index: number) => void;
    /** How tall the page must be to show every stroke; the page takes it. */
    minHeight?: number;
  } = $props();

  let box = $state<HTMLDivElement>();
  let width = $state(1);
  $effect(() => {
    if (!box) return;
    const ro = new ResizeObserver(() => (width = Math.max(1, box!.clientWidth)));
    ro.observe(box);
    return () => ro.disconnect();
  });
  /** Tall enough for the lowest stroke, whatever the writing's length. */
  const lowest = $derived(Math.max(0, ...(ink?.s ?? []).flatMap((s) => s.p.filter((_, i) => i % 2 === 1))));
  const scale = $derived(width / 1000);
  $effect(() => {
    minHeight = lowest ? Math.ceil((lowest + 24) * scale) : 0;
  });

  let live = $state<number[] | null>(null);
  let pressed = false;
  function pt(e: PointerEvent): [number, number] {
    const r = box!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 1000, ((e.clientY - r.top) / r.width) * 1000];
  }
  function down(e: PointerEvent) {
    if (!drawing || e.button > 0) return;
    e.preventDefault();
    pressed = true;
    if (erasing) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    live = pt(e);
  }
  function move(e: PointerEvent) {
    if (!live) return;
    const [x, y] = pt(e);
    const n = live.length;
    if (Math.hypot(x - live[n - 2], y - live[n - 1]) >= 2) live = [...live, x, y];
  }
  function up() {
    pressed = false;
    if (!live) return;
    const p = live.length >= 4 ? live : [...live, live[0] + 0.5, live[1] + 0.5];
    live = null;
    onstroke({ c: pen.c, w: pen.w, p: p.slice(0, 3000) });
  }
  const d = (p: number[]) => {
    if (p.length < 2) return '';
    let out = `M${p[0]} ${p[1]}`;
    for (let i = 2; i < p.length - 2; i += 2) out += ` Q${p[i]} ${p[i + 1]} ${(p[i] + p[i + 2]) / 2} ${(p[i + 1] + p[i + 3]) / 2}`;
    return out + ` L${p[p.length - 2]} ${p[p.length - 1]}`;
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="ink paper-{ink?.paper ?? 'plain'}" class:drawing class:erasing bind:this={box}
     onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={() => (live = null)}
     onpointerleave={() => (pressed = false)}>
  <svg viewBox="0 0 1000 {Math.max(1, (box?.clientHeight ?? 1) / scale)}" preserveAspectRatio="xMinYMin meet" aria-hidden="true">
    {#each ink?.s ?? [] as s, i (i + ':' + s.p.length + ':' + s.p[0])}
      <path d={d(s.p)} style:stroke={s.c} stroke-width={s.w} class:hit={drawing && erasing}
            onpointerdown={() => drawing && erasing && onerase(i)} onpointerenter={() => drawing && erasing && pressed && onerase(i)}
            in:fade={{ duration: 150 }} out:fade={{ duration: 150 }} />
    {/each}
    {#if live}<path d={d(live)} style:stroke={pen.c} stroke-width={pen.w} />{/if}
  </svg>
</div>

<style>
  .ink { position: absolute; inset: 0; z-index: 2; pointer-events: none; border-radius: 4px; }
  .ink.drawing { pointer-events: auto; touch-action: none; cursor: crosshair; }
  .ink.drawing.erasing { cursor: cell; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  path.hit { cursor: pointer; }
  path.hit:hover { opacity: 0.45; }
  /* The paper, drawn by the layer under the writing's own background. */
  .paper-lines { background-image: repeating-linear-gradient(to bottom, transparent 0 calc(1.55em - 1px), color-mix(in oklch, var(--text) 13%, transparent) calc(1.55em - 1px) 1.55em); background-position: 0 calc(0.15rem + 1px); }
  .paper-grid {
    background-image:
      linear-gradient(to right, color-mix(in oklch, var(--text) 10%, transparent) 1px, transparent 1px),
      linear-gradient(to bottom, color-mix(in oklch, var(--text) 10%, transparent) 1px, transparent 1px);
    background-size: 1.25rem 1.25rem;
  }
  .paper-dots { background-image: radial-gradient(circle, color-mix(in oklch, var(--text) 22%, transparent) 1px, transparent 1.4px); background-size: 1.25rem 1.25rem; }
</style>
