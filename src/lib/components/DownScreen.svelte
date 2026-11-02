<script lang="ts">
  /**
   * Going down, felt across the whole screen.
   *
   * At 0 hit points the screen takes two heartbeats: it blurs and dims, twice,
   * and comes back. Then a dark red vignette closes round its edges and keeps
   * a slow heartbeat for as long as the character is dying. Every death save
   * lands on the whole screen too: a success flashes white from the edges, a
   * failure thuds red. Dead, the vignette stops beating and stays.
   *
   * Only changes set it off, never a sheet opened in that state, except that
   * the vignette itself is there whenever the character is at 0.
   *
   * The vignette's beat is driven from here rather than by CSS, so that the
   * heartbeat sound (when sound is on) lands on exactly the same moment.
   */
  import { isDead } from '$lib/rules/hp';
  import { prefersReducedMotion } from '$lib/motion';
  import type { State } from '$lib/types';
  import { deathBell, deathSave, heartbeat } from '$lib/sound';

  let { state: sheetState, hpMax }: { state: State; hpMax: number } = $props();

  const down = $derived(hpMax > 0 && sheetState.hpCurrent <= 0);
  const dead = $derived(down && isDead(sheetState));
  const dying = $derived(down && !dead);

  let beat = $state(0);
  /** The last death save, and how many of its kind there now are: the first
      lands softly and the third hits hardest. */
  let impact = $state<{ kind: 'save' | 'fail'; id: number; level: number } | null>(null);
  let before: { hp: number; s: number; f: number } | null = null;
  let clear: ReturnType<typeof setTimeout> | undefined;
  const still = prefersReducedMotion();

  $effect(() => {
    const now = {
      hp: sheetState.hpCurrent,
      s: sheetState.deathSaves?.successes ?? 0,
      f: sheetState.deathSaves?.failures ?? 0
    };
    const was = before;
    before = now;
    if (!was || !(hpMax > 0)) return;
    if (was.hp > 0 && now.hp <= 0) {
      if (!still) beat += 1;
      heartbeat(0.12, 1.3);
      wentDown = performance.now();
    }
    // A third success brings them up to 1 at once, so it shows as a rise in hit
    // points from 0 with the saves cleared, not as a fourth pip.
    const saved = now.s > was.s || (was.hp <= 0 && now.hp > 0 && was.s === 2);
    const failed = now.f > was.f && now.hp <= 0;
    if (saved || failed) {
      const level = failed ? Math.min(3, now.f) : now.hp > 0 ? 3 : Math.min(3, now.s);
      deathSave(failed ? 'fail' : 'save', level);
      if (failed && now.f >= 3) deathBell();
      if (still) return;
      impact = { kind: failed ? 'fail' : 'save', id: (impact?.id ?? 0) + 1, level };
      clearTimeout(clear);
      clear = setTimeout(() => (impact = null), 1300);
      // A failure jolts the whole vignette, harder each time.
      const k = level / 3;
      if (failed) vig?.animate(
        [
          { transform: `scale(${1 - 0.07 * k})` },
          { transform: `scale(${1 - 0.05 * k}) translateX(${-9 * k}px)`, offset: 0.2 },
          { transform: `scale(${1 - 0.03 * k}) translateX(${7 * k}px)`, offset: 0.4 },
          { transform: `scale(${1 - 0.015 * k}) translateX(${-4 * k}px)`, offset: 0.6 },
          { transform: 'none' }
        ],
        { duration: 600, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' }
      );
    }
  });

  /** The vignette, and the layer inside it that beats. */
  let vig = $state<HTMLElement>();
  let beatEl = $state<HTMLElement>();
  let wentDown = 0;
  const PERIOD = 1500;
  /** Lub-dub: two beats close together (at 10% and 30%), then a rest. */
  const LUBDUB: Keyframe[] = [
    { opacity: 0.75, transform: 'scale(1)', offset: 0 },
    { opacity: 1, transform: 'scale(0.985)', offset: 0.1 },
    { opacity: 0.8, transform: 'scale(1)', offset: 0.2 },
    { opacity: 1, transform: 'scale(0.99)', offset: 0.3 },
    { opacity: 0.75, transform: 'scale(1)', offset: 0.45 },
    { opacity: 0.75, transform: 'scale(1)', offset: 1 }
  ];
  $effect(() => {
    if (!dying || !beatEl) return;
    const el = beatEl;
    const pulse = () => {
      if (!still) el.animate(LUBDUB, { duration: PERIOD, easing: 'ease-in-out' });
      // The sound's first thump at 10% of the beat, its second 0.3s later.
      heartbeat(PERIOD * 0.1 / 1000, 0.85);
    };
    // Just gone down: let the two big heartbeats finish first.
    const wait = Math.max(0, 1600 - (performance.now() - wentDown));
    let loop: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      pulse();
      loop = setInterval(pulse, PERIOD);
    }, wait);
    return () => {
      clearTimeout(start);
      clearInterval(loop);
    };
  });
</script>

{#if down}
  <div class="vignette" class:dead aria-hidden="true">
    <div class="jolt" bind:this={vig}><i bind:this={beatEl}></i></div>
  </div>
{/if}
{#key beat}
  {#if beat > 0}<div class="heartbeat" aria-hidden="true"></div>{/if}
{/key}
{#if impact}
  {#key impact.id}<div class="flash {impact.kind}" style:--k={impact.level / 3} aria-hidden="true"></div>{/key}
{/if}

<style>
  /* Above the modules, under toasts and dialogs (40+). Never takes a tap. */
  .vignette, .heartbeat, .flash { position: fixed; inset: 0; pointer-events: none; }
  .vignette { z-index: 35; animation: close 1.2s ease-out; }
  @keyframes close { from { opacity: 0; } }
  /* Larger than the screen, so beating or jolting never pulls an edge into view. */
  .vignette { overflow: hidden; }
  .vignette i {
    position: absolute; inset: -8vmax; display: block;
    /* Stops pulled in, since the box runs past the screen's edges. */
    background: radial-gradient(ellipse at center,
      transparent 44%,
      oklch(22% 0.09 25 / 0.35) 60%,
      oklch(14% 0.07 25 / 0.82) 76%,
      oklch(12% 0.06 25 / 0.9) 100%);
    transform-origin: center;
  }
  .jolt { position: absolute; inset: 0; }
  .vignette i { opacity: 0.75; }
  /* Dead: it stops beating, and stays. */
  .vignette.dead i { animation: none; opacity: 1;
    background: radial-gradient(ellipse at center, transparent 38%, oklch(16% 0.04 25 / 0.5) 58%, oklch(10% 0.03 25 / 0.9) 76%, oklch(8% 0.02 25 / 0.95) 100%); }

  /* Going down: two heartbeats of blur and dark across everything. */
  .heartbeat {
    z-index: 36; background: oklch(8% 0.03 25 / 0.5);
    -webkit-backdrop-filter: blur(3px) saturate(0.6); backdrop-filter: blur(3px) saturate(0.6);
    opacity: 0; animation: heartbeat 1.6s ease-in-out forwards;
  }
  @keyframes heartbeat {
    0% { opacity: 0; }
    12% { opacity: 1; }
    26% { opacity: 0.25; }
    40% { opacity: 0.9; }
    62% { opacity: 0.2; }
    100% { opacity: 0; }
  }

  /* Each death save, across the whole screen. */
  /* Weak on the first pip, strong on the third: the strength, the reach in
     from the edges and the time it holds all grow with --k. */
  .flash { z-index: 36; opacity: 0; animation: flash calc(0.55s + 0.6s * var(--k, 1)) ease-out forwards; }
  .flash.save {
    background: radial-gradient(ellipse at center, transparent calc(62% - 26% * var(--k, 1)),
      rgb(255 255 255 / calc(0.15 + 0.5 * var(--k, 1))) 100%);
  }
  .flash.fail {
    background: radial-gradient(ellipse at center, oklch(40% 0.2 25 / calc(0.05 * var(--k, 1))) 30%,
      oklch(45% 0.22 25 / calc(0.2 + 0.6 * var(--k, 1))) 100%);
  }
  @keyframes flash { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }


</style>
