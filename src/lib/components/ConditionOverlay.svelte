<script lang="ts">
  /**
   * A tint at the top and bottom of the screen for each standard condition
   * the character has: pink while charmed, yellow while stunned, and so on.
   *
   * It keeps out of everything else's way. It sits behind the modules, as the
   * hurt edges do, and takes the top and bottom of the screen where the hurt
   * edges take the sides, so the two can both be showing. With more than one
   * condition, the colours take turns.
   */
  import { onDestroy } from 'svelte';
  import { prefersReducedMotion } from '$lib/motion';

  let { conditions }: { conditions: string[] } = $props();

  type Look = { color: string; motion: 'still' | 'pulse' | 'flicker' | 'shimmer' | 'shiver' | 'heavy'; low?: boolean };

  /** Hue and movement per condition. Anything not listed (Bless, Rage…) has none. */
  const LOOKS: Record<string, Look> = {
    blinded: { color: 'oklch(14% 0.005 286)', motion: 'heavy' },
    charmed: { color: 'oklch(68% 0.2 350)', motion: 'pulse' },
    deafened: { color: 'oklch(58% 0.06 245)', motion: 'still' },
    exhaustion: { color: 'oklch(52% 0.08 60)', motion: 'heavy' },
    frightened: { color: 'oklch(45% 0.18 300)', motion: 'shiver' },
    grappled: { color: 'oklch(64% 0.16 50)', motion: 'still' },
    incapacitated: { color: 'oklch(58% 0.01 286)', motion: 'still' },
    invisible: { color: 'oklch(86% 0.08 210)', motion: 'shimmer' },
    paralyzed: { color: 'oklch(76% 0.12 230)', motion: 'still' },
    petrified: { color: 'oklch(62% 0.025 80)', motion: 'still' },
    poisoned: { color: 'oklch(66% 0.19 140)', motion: 'pulse' },
    prone: { color: 'oklch(50% 0.07 50)', motion: 'still', low: true },
    restrained: { color: 'oklch(70% 0.14 75)', motion: 'still' },
    stunned: { color: 'oklch(88% 0.17 95)', motion: 'flicker' },
    unconscious: { color: 'oklch(28% 0.08 265)', motion: 'heavy' },
    dead: { color: 'oklch(16% 0.04 25)', motion: 'heavy' }
  };

  /** "Exhaustion 2" is exhaustion; case and spacing do not matter. */
  const keyOf = (name: string) => name.trim().toLowerCase().replace(/\s*\d+$/, '');
  const shown = $derived(
    [...new Set(conditions.map(keyOf))].filter((k) => k in LOOKS).map((k) => ({ key: k, ...LOOKS[k] }))
  );

  let turn = $state(0);
  const timer = setInterval(() => (turn += 1), prefersReducedMotion() ? 6000 : 3200);
  onDestroy(() => clearInterval(timer));
  const current = $derived(shown.length ? turn % shown.length : 0);
</script>

<div class="overlay" aria-hidden="true">
  {#each shown as look, i (look.key)}
    <div class="tint {look.motion}" class:low={look.low} class:on={i === current} data-condition={look.key}
         style:--tint={look.color}>
      <i class="top"></i><i class="bottom"></i>
    </div>
  {/each}
</div>

<style>
  /* Behind the modules (z 1), with the hurt edges, above only the page. */
  .overlay { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
  .tint {
    position: absolute; inset: 0; opacity: 0;
    transition: opacity 1.1s ease;
    animation: tintIn 0.9s ease;
  }
  .tint.on { opacity: 1; }
  @keyframes tintIn { from { transform: scaleY(1.15); } }
  .tint i { position: absolute; left: 0; right: 0; display: block; }
  .top {
    top: 0; height: clamp(7rem, 30vh, 18rem);
    background: linear-gradient(to bottom,
      color-mix(in oklch, var(--tint) 62%, transparent) 0%,
      color-mix(in oklch, var(--tint) 24%, transparent) 45%,
      transparent 100%);
  }
  .bottom {
    bottom: 0; height: clamp(5rem, 22vh, 13rem);
    background: linear-gradient(to top,
      color-mix(in oklch, var(--tint) 52%, transparent) 0%,
      color-mix(in oklch, var(--tint) 18%, transparent) 50%,
      transparent 100%);
  }
  /* Prone: the weight is at the bottom of the screen, on the floor. */
  .low .top { height: clamp(4rem, 14vh, 8rem); opacity: 0.6; }
  .low .bottom { height: clamp(8rem, 36vh, 20rem); }

  .pulse i { animation: pulse 2.8s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
  .heavy i { animation: heavy 4.5s ease-in-out infinite; transform-origin: center top; }
  .heavy .bottom { transform-origin: center bottom; }
  @keyframes heavy { 0%, 100% { opacity: 0.85; transform: scaleY(1); } 50% { opacity: 1; transform: scaleY(1.12); } }
  .flicker i { animation: flicker 1.9s steps(1, end) infinite; }
  @keyframes flicker {
    0%, 100% { opacity: 0.9; } 8% { opacity: 0.55; } 11% { opacity: 1; } 47% { opacity: 0.75; } 50% { opacity: 1; } 78% { opacity: 0.6; } 81% { opacity: 0.95; }
  }
  .shimmer i { animation: shimmer 3.4s ease-in-out infinite; }
  @keyframes shimmer { 0%, 100% { opacity: 0.45; filter: blur(0); } 50% { opacity: 0.9; filter: blur(6px); } }
  .shiver i { animation: shiver 0.35s ease-in-out infinite alternate; }
  @keyframes shiver { from { transform: translateY(-2px); opacity: 0.85; } to { transform: translateY(2px); opacity: 1; } }

  @media (prefers-reduced-motion: reduce) {
    .tint i { animation: none !important; }
  }
</style>
