<script lang="ts">
  /**
   * The ring of a character's conditions round their portrait on a campaign
   * card: a band in each condition's color, together all the way round. A
   * monster's or NPC's portrait is round (5e.tools tokens are), and so is its
   * ring (`round`). Each band is a stretch of the one shape, so when a condition comes
   * its band draws itself in while the others slide along to make room, and
   * when one goes it shrinks away and the rest close the gap. At rest the
   * bands flow slowly round, together, and glow a little brighter and back.
   */
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion } from '#lib/motion.ts';

  let { bands, round = false }: { bands: { key: string; color: string }[]; round?: boolean } = $props();

  // The ring sits 4px outside a 52px portrait: a 60px box, its line 2.5px
  // wide down the middle of the outer 2.5px. It starts at the top-left
  // corner and runs clockwise.
  const S = 60;
  const W = 2.5;
  const lo = W / 2;
  const hi = S - W / 2;
  const r = 10 - W / 2;
  const k = r - r * Math.SQRT1_2;
  const SQUARE =
    `M${lo + k} ${lo + k} A${r} ${r} 0 0 1 ${lo + r} ${lo} H${hi - r} A${r} ${r} 0 0 1 ${hi} ${lo + r} ` +
    `V${hi - r} A${r} ${r} 0 0 1 ${hi - r} ${hi} H${lo + r} A${r} ${r} 0 0 1 ${lo} ${hi - r} ` +
    `V${lo + r} A${r} ${r} 0 0 1 ${lo + k} ${lo + k}`;

  // The round one starts at the same top-left point and runs clockwise too.
  const R = S / 2 - W / 2;
  const d = R * Math.SQRT1_2;
  const CIRCLE =
    `M${S / 2 - d} ${S / 2 - d} A${R} ${R} 0 1 1 ${S / 2 + d} ${S / 2 + d} A${R} ${R} 0 1 1 ${S / 2 - d} ${S / 2 - d}`;
  const PATH = $derived(round ? CIRCLE : SQUARE);

  /** The ring's length all the way round. Lengths below are in hundredths
      of it, turned into the path's own units here (pathLength is not
      applied to dashes set in CSS everywhere). */
  const P = $derived(round ? 2 * Math.PI * R : 4 * (hi - lo - 2 * r) + 2 * Math.PI * r);
  const u = (n: number) => (n * P) / 100;
  /** A little gap between bands, so two reds still read as two. */
  const GAP = 2.2;
  const share = $derived(bands.length ? 100 / bands.length : 100);
  const len = $derived(bands.length > 1 ? share - GAP : 100);

  /** A band drawing itself in from nothing, or back out to nothing. */
  function draw(_: Element, { length }: { length: number }) {
    const quick = prefersReducedMotion();
    return {
      duration: quick ? 0 : 520,
      easing: cubicOut,
      css: (t: number) => `stroke-dasharray: ${u(length * t)} ${u(100 - length * t)}; opacity: ${Math.min(1, t * 2)}`
    };
  }
</script>

<svg class="ring" viewBox="0 0 {S} {S}" aria-hidden="true" style:--p={P / 100}>
  {#each bands as b, i (b.key)}
    <path d={PATH} stroke={b.color} stroke-width={W}
          style:stroke-dasharray="{u(len)} {u(100 - len)}" style:--off={i * share + (bands.length > 1 ? GAP / 2 : 0)}
          transition:draw={{ length: len }} />
  {/each}
</svg>

<style>
  .ring {
    position: absolute; inset: -4px; width: calc(100% + 8px); height: calc(100% + 8px);
    overflow: visible; pointer-events: none; fill: none;
  }
  /* Where a band starts (--off, in hundredths of the way round) eases when
     bands come and go; the whole ring's turn (--spin) runs on beneath it. */
  @property --off { syntax: '<number>'; inherits: false; initial-value: 0; }
  @property --spin { syntax: '<number>'; inherits: true; initial-value: 0; }
  .ring { animation: flow 28s linear infinite, glow 3.6s ease-in-out infinite; }
  @keyframes flow { to { --spin: 100; } }
  @keyframes glow { 0%, 100% { opacity: 0.85; } 50% { opacity: 1; } }
  path {
    stroke-dashoffset: calc((var(--off) + var(--spin)) * var(--p) * -1px);
    transition: stroke-dasharray 0.5s cubic-bezier(0.2, 0.8, 0.25, 1), --off 0.5s cubic-bezier(0.2, 0.8, 0.25, 1),
      stroke 0.4s ease;
  }
  /* On a light page a pale band (Invisible, White) needs an edge to be seen. */
  :global([data-mode='light']) .ring { filter: drop-shadow(0 0 0.6px rgb(0 0 0 / 0.55)); }
  @media (prefers-reduced-motion: reduce) { path { transition: none; } .ring { animation: none; } }
</style>
