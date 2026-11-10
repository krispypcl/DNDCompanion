<script lang="ts">
  /**
   * Drawing over a page of notes or backstory: pen strokes on top of the
   * writing, and the paper under it (plain, lines, a grid or dots). Shown
   * always; drawn on only while `drawing` is on, when it takes the pointer
   * and the writing underneath waits. Points are in page-width units, so the
   * drawing grows and shrinks with the page.
   */
  import { fade } from 'svelte/transition';
  import { get } from 'svelte/store';
  import { swept, type Ink, type Stroke } from '$lib/rules/ink';
  import { isPalm, keepStylus, penOnly, sawPen } from '$lib/pen';

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
    /** The lines one swipe of the eraser went over, all at once. */
    onerase: (indices: number[]) => void;
    /** How tall the page must be to show every stroke; the page takes it. */
    minHeight?: number;
  } = $props();

  let box = $state<HTMLDivElement>();
  let width = $state(1);
  let height = $state(1);
  $effect(() => {
    if (!box) return;
    // Both sides, so the drawing's frame is always the page's: a frame drawn
    // for a shorter page shrank every line towards the top left.
    const ro = new ResizeObserver(() => {
      width = Math.max(1, box!.clientWidth);
      height = Math.max(1, box!.clientHeight);
    });
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
  function pt(e: { clientX: number; clientY: number }): [number, number] {
    const r = box!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 1000, ((e.clientY - r.top) / r.width) * 1000];
  }
  /** Once a pen (an Apple Pencil) has drawn here, a palm resting on the
      glass no longer draws: only the pen does. */
  let liveId: number | null = null;
  function down(e: PointerEvent) {
    if (!drawing || e.button > 0) return;
    if (e.pointerType === 'pen') sawPen();
    else if (e.pointerType === 'touch' && (get(penOnly) || isPalm(e))) return;
    if (live && e.pointerType === 'pen' && liveId !== e.pointerId) live = null;
    else if (live) return;
    liveId = e.pointerId;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (erasing) {
      rubbing = null;
      rub(pt(e));
      return;
    }
    live = pt(e);
  }
  /** The eraser's last point while it is down, and the lines it went over. */
  let rubbing: [number, number] | null = null;
  let gone = $state<Set<number>>(new Set());
  function rub(to: [number, number]) {
    const from = rubbing ?? to;
    rubbing = to;
    const hits = swept(ink?.s ?? [], from, to, 6).filter((i) => !gone.has(i));
    if (hits.length) gone = new Set([...gone, ...hits]);
  }
  function stopRubbing() {
    rubbing = null;
    if (!gone.size) return;
    const all = [...gone];
    gone = new Set();
    onerase(all);
  }
  function move(e: PointerEvent) {
    if (rubbing && e.pointerId === liveId) {
      const all = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      for (const ev of all.length ? all : [e]) rub(pt(ev));
      return;
    }
    if (!live || e.pointerId !== liveId) return;
    const all = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    const next = [...live];
    for (const ev of all.length ? all : [e]) {
      const [x, y] = pt(ev);
      const n = next.length;
      if (Math.hypot(x - next[n - 2], y - next[n - 1]) >= 1.5) next.push(x, y);
    }
    if (next.length !== live.length) live = next;
  }
  function up(e: PointerEvent) {
    if (rubbing) return stopRubbing();
    if (!live || e.pointerId !== liveId) return;
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
     onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={(e) => (rubbing ? stopRubbing() : live && live.length >= 4 ? up(e) : (live = null))} use:keepStylus>
  <svg viewBox="0 0 1000 {Math.max(1, height / scale)}" preserveAspectRatio="xMinYMin meet" aria-hidden="true">
    {#each ink?.s ?? [] as s, i (i + ':' + s.p.length + ':' + s.p[0])}
      <path d={d(s.p)} style:stroke={s.c} stroke-width={s.w} class:hit={drawing && erasing} class:gone={gone.has(i)}
            in:fade={{ duration: 150 }} out:fade={{ duration: 150 }} />
    {/each}
    {#if live}<path d={d(live)} style:stroke={pen.c} stroke-width={pen.w} />{/if}
  </svg>
</div>

<style>
  /* The writing's size, so lines on lined paper sit under its lines. */
  .ink { position: absolute; inset: 0; z-index: 2; pointer-events: none; border-radius: 4px; }
  @media (max-width: 700px) { .ink { font-size: max(1em, 16px); } }
  .ink.drawing { pointer-events: auto; touch-action: none; cursor: crosshair; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  .ink.drawing.erasing { cursor: cell; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  path.hit { cursor: pointer; }
  path.gone { opacity: 0; transition: opacity 0.12s ease; }
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
