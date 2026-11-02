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
   */
  import { isDead } from '$lib/rules/hp';
  import { prefersReducedMotion } from '$lib/motion';
  import type { State } from '$lib/types';

  let { state: sheetState, hpMax }: { state: State; hpMax: number } = $props();

  const down = $derived(hpMax > 0 && sheetState.hpCurrent <= 0);
  const dead = $derived(down && isDead(sheetState));
  const dying = $derived(down && !dead);

  let beat = $state(0);
  let impact = $state<{ kind: 'save' | 'fail'; id: number } | null>(null);
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
    if (!was || still || !(hpMax > 0)) return;
    if (was.hp > 0 && now.hp <= 0) beat += 1;
    // A third success brings them up to 1 at once, so it shows as a rise in hit
    // points from 0 with the saves cleared, not as a fourth pip.
    const saved = now.s > was.s || (was.hp <= 0 && now.hp > 0 && was.s === 2);
    const failed = now.f > was.f && now.hp <= 0;
    if (saved || failed) {
      impact = { kind: failed ? 'fail' : 'save', id: (impact?.id ?? 0) + 1 };
      clearTimeout(clear);
      clear = setTimeout(() => (impact = null), 900);
    }
  });
</script>

{#if down}
  <div class="vignette" class:dead aria-hidden="true">
    {#key impact?.id}<i class:thud={impact?.kind === 'fail'}></i>{/key}
  </div>
{/if}
{#key beat}
  {#if beat > 0}<div class="heartbeat" aria-hidden="true"></div>{/if}
{/key}
{#if impact}
  {#key impact.id}<div class="flash {impact.kind}" aria-hidden="true"></div>{/key}
{/if}

<style>
  /* Above the modules, under toasts and dialogs (40+). Never takes a tap. */
  .vignette, .heartbeat, .flash { position: fixed; inset: 0; pointer-events: none; }
  .vignette { z-index: 35; animation: close 1.2s ease-out; }
  @keyframes close { from { opacity: 0; } }
  .vignette i {
    position: absolute; inset: 0; display: block;
    background: radial-gradient(ellipse at center,
      transparent 52%,
      oklch(22% 0.09 25 / 0.35) 72%,
      oklch(14% 0.07 25 / 0.82) 100%);
    animation: lubdub 1.5s ease-in-out infinite;
    transform-origin: center;
  }
  /* Lub-dub: two beats close together, then a rest. */
  @keyframes lubdub {
    0%, 100% { opacity: 0.75; transform: scale(1); }
    10% { opacity: 1; transform: scale(0.985); }
    20% { opacity: 0.8; transform: scale(1); }
    30% { opacity: 1; transform: scale(0.99); }
    45% { opacity: 0.75; transform: scale(1); }
  }
  .vignette i.thud { animation: thud 0.6s cubic-bezier(0.3, 0.7, 0.4, 1), lubdub 1.5s ease-in-out 0.6s infinite; }
  @keyframes thud {
    0% { opacity: 1; transform: scale(0.93) translateX(0); }
    20% { transform: scale(0.95) translateX(-6px); }
    40% { transform: scale(0.97) translateX(5px); }
    60% { transform: scale(0.985) translateX(-3px); }
    100% { opacity: 0.8; transform: scale(1); }
  }
  /* Dead: it stops beating, and stays. */
  .vignette.dead i { animation: none; opacity: 1;
    background: radial-gradient(ellipse at center, transparent 45%, oklch(16% 0.04 25 / 0.5) 70%, oklch(10% 0.03 25 / 0.9) 100%); }

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
  .flash { z-index: 36; opacity: 0; animation: flash 0.85s ease-out forwards; }
  .flash.save { background: radial-gradient(ellipse at center, transparent 40%, rgb(255 255 255 / 0.55) 100%); }
  .flash.fail { background: radial-gradient(ellipse at center, oklch(40% 0.2 25 / 0.15) 30%, oklch(45% 0.22 25 / 0.75) 100%); }
  @keyframes flash { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }

  @media (prefers-reduced-motion: reduce) {
    .vignette i { animation: none; }
  }
</style>
