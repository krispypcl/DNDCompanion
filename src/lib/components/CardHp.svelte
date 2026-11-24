<script lang="ts">
  /**
   * A campaign card's hit points, kept current while the page is open. When
   * they change, the card shows it the way the sheet does: the number counts
   * to its new value with a beat, the bar eases there leaving a ghost of the
   * stretch lost or gained, a light runs along it, the amount floats up, and
   * a hit jolts the bar as hard as it was. A character's card is heard too,
   * by everyone at the table: its own sounds for a hit, healing, temporary hit
   * points, and death (or the built-in ones); a creature's is silent.
   */
  import { hitSeverity, type Vital } from '#lib/rules/hp.ts';
  import { statusPop, wavePhase } from '#lib/motion.ts';
  import { playAs, type SoundName } from '#lib/sound.ts';
  import CountUp from './CountUp.svelte';

  let { cur, max, temp, vital, label, sounds }: {
    cur: number; max: number; temp: number; vital: Vital; label: string;
    /** Its sounds (a character's definition.sounds; {} for the built-in ones): given, the card is heard; left out, it is silent. */
    sounds?: Partial<Record<SoundName, string>>;
  } = $props();

  /** Heard only from a tab in view: the same change, made on the sheet in another tab, is heard there. */
  const heard = () => Boolean(sounds) && document.visibilityState === 'visible';
  const total = $derived(max + temp);
  const pct = (n: number) => (total > 0 ? Math.max(0, Math.min(100, (n / total) * 100)) : 0);
  /** Short of full, the liquid's end waves: the temporary stretch's when there is one, else the fill's. */
  const short = $derived(cur < max);
  /** Temporary hit points beyond some of the character's own: their stretch runs under the fill's wave. */
  const under = $derived(temp > 0 && cur > 0);
  const curWave = $derived(short || temp > 0);
  const hurt = $derived(vital === 'bloodied' || vital === 'critical' || vital === 'down' || vital === 'dead');

  let ghost = $state<{ left: number; width: number; kind: 'damage' | 'heal'; wave: boolean } | null>(null);
  let pulse = $state(0);
  let healed = $state(false);
  let wounded = $state(false);
  let shored = $state(false);
  let struck = $state(false);
  let blow = $state('');
  let float = $state<{ text: string; kind: 'heal' | 'temp' | 'hurt'; id: number } | null>(null);
  const timers: Record<string, ReturnType<typeof setTimeout>> = {};
  /** Off then on across a frame, so a second change restarts the animation. */
  function replay(name: string, set: (on: boolean) => void, ms: number) {
    set(false);
    requestAnimationFrame(() => set(true));
    clearTimeout(timers[name]);
    timers[name] = setTimeout(() => set(false), ms);
  }
  function floatUp(text: string, kind: 'heal' | 'temp' | 'hurt') {
    float = { text, kind, id: (float?.id ?? 0) + 1 };
    clearTimeout(timers.float);
    timers.float = setTimeout(() => (float = null), 1100);
  }

  /* Plain variables: what was there before this change, not reactive state. */
  let previous = -1;
  let previousTemp = -1;
  $effect(() => {
    const now = cur;
    const nowTemp = temp;
    if (previous === -1) {
      previous = now;
      previousTemp = nowTemp;
      return;
    }
    if (nowTemp > previousTemp) {
      if (heard()) playAs('shield', sounds);
      replay('temp', (on) => (shored = on), 1000);
      floatUp(`+${nowTemp - previousTemp} temp`, 'temp');
    } else if (nowTemp < previousTemp && now === previous) {
      replay('hurt', (on) => (wounded = on), 950);
      floatUp(`−${previousTemp - nowTemp} temp`, 'hurt');
    }
    previousTemp = nowTemp;
    if (now === previous) return;
    const from = pct(previous);
    const to = pct(now);
    const lost = previous - now;
    ghost = lost > 0
      ? { left: to, width: Math.max(from - to, 0.8), kind: 'damage', wave: from < 99.9 }
      : { left: from, width: Math.max(to - from, 0.8), kind: 'heal', wave: to < 99.9 };
    previous = now;
    pulse += 1;
    if (lost > 0) {
      replay('hurt', (on) => (wounded = on), 950);
      floatUp(`−${lost}`, 'hurt');
      const sev = hitSeverity(lost, max);
      // A blow that kills rings the death bell instead (below).
      if (heard() && vital !== 'dead') playAs('hit', sounds, sev);
      const ms = Math.round(380 + sev * 520);
      blow = `--amp:${(2 + sev * 7).toFixed(2)}px;--flash:${(0.2 + sev * 0.5).toFixed(2)};--dur:${ms}ms`;
      replay('struck', (on) => (struck = on), ms + 40);
    } else {
      if (heard()) playAs('heal', sounds);
      replay('heal', (on) => (healed = on), 950);
      floatUp(`+${-lost}`, 'heal');
    }
    clearTimeout(timers.ghost);
    timers.ghost = setTimeout(() => (ghost = null), 760);
  });
  $effect(() => () => Object.values(timers).forEach(clearTimeout));

  /* Dead, from alive (not on the first look): the character's death bell, for the whole table. */
  let wasVital: Vital | null = null;
  $effect(() => {
    const now = vital;
    if (heard() && wasVital !== null && now === 'dead' && wasVital !== 'dead') playAs('deathBell', sounds);
    wasVital = now;
  });
</script>

<div class="hp" class:healed class:wounded class:shored class:struck class:hurt class:dying={vital === 'down'}
     class:dead={vital === 'dead'} style={blow}
     title="{cur} of {max} hit points{temp ? `, ${temp} temporary` : ''}">
  <div class="hpline">
    <span class="cap">HP</span>
    {#key pulse}<b class:beat={pulse > 0}><CountUp value={cur} /></b>{/key}
    <span class="of">/ {max}</span>
    {#if temp}<span class="temp">+{temp}</span>{/if}
    <!-- The amount, beside the number it changed, rising and fading. -->
    {#if float}
      {#key float.id}<span class="float {float.kind}" aria-hidden="true">{float.text}</span>{/key}
    {/if}
    {#key vital}<span class="vital" in:statusPop>{label}</span>{/key}
  </div>
  <div class="gauge">
    <div class="bar" class:shielded={temp > 0} aria-hidden="true">
      <i class="cur hpflow" class:hpwave={curWave} style:width="{pct(cur)}%" style:--wave-at={curWave ? wavePhase() : undefined}></i>
      <i class="tmp" class:hpwave={short && temp > 0} class:under style:width={under ? `calc(${pct(temp)}% + 6px)` : `${pct(temp)}%`}
         style:--wave-at={temp > 0 ? wavePhase() : undefined}></i>
      {#if healed}<i class="hpsweep"></i>{/if}
      {#if wounded}<i class="hpsweep back"></i>{/if}
      {#if ghost}
        {#key pulse}
          {@const tuck = ghost.left > 0 ? 6 : 0}
          <i class="ghost {ghost.kind}" class:hpwave={ghost.wave} class:hpwavein={ghost.kind === 'heal' && tuck > 0} style:left="calc({ghost.left}% - {tuck}px)"
             style:width="calc({ghost.width}% + {tuck}px)" style:--wave-at={wavePhase()}></i>
        {/key}
      {/if}
    </div>
  </div>
</div>

<style>
  .hp { --heal-green: oklch(74% 0.17 150); --shield: oklch(91% 0.11 95); }
  :global([data-mode='light']) .hp { --heal-green: oklch(58% 0.16 150); --shield: oklch(76% 0.15 85); }
  .hpline { display: flex; align-items: baseline; gap: 0.3125rem; }
  .cap { font-size: 0.625rem; letter-spacing: 0.12em; color: var(--label); font-weight: 600; margin-right: 0.125rem; }
  .hpline b { display: inline-block; font-size: 1.25rem; font-variant-numeric: tabular-nums; }
  .hurt .hpline b { color: var(--hurt-red); }
  .of { color: var(--dim); font-size: 0.8125rem; }
  .temp { color: var(--dim); font-size: 0.8125rem; font-weight: 600; }
  .vital { margin-left: auto; font-size: 0.75rem; color: var(--dim); display: inline-block; }
  .hurt .vital { color: var(--hurt-red); font-weight: 600; }

  .gauge { position: relative; }
  .bar {
    position: relative; display: flex; height: 6px; border-radius: 3px; background: var(--bg);
    overflow: hidden; margin-top: 0.3125rem; transition: box-shadow 0.45s var(--ease-out);
  }
  .bar i { display: block; height: 100%; transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1); }
  .cur { --hp-base: var(--accent, var(--a)); }
  .hurt .cur { --hp-base: var(--hurt-red); }
  .tmp { background: color-mix(in oklch, var(--shield) 85%, transparent); }
  /* With temporary hit points the fill's end waves too, the temporary stretch running 6px under it
     so its color shows in the wave's troughs: the seam between the two is liquid as well. */
  .bar > .cur { position: relative; z-index: 1; }
  .tmp.under { margin-left: -6px; }
  /* A heal's ghost lights the stretch gained, over the fill, its left edge the wave the liquid had
     there; a hit's runs 6px under the fill's wavy end, so what drains shows in its troughs. Either
     waves at its end where it stops short of the wall. */
  .ghost.heal, .hpsweep { z-index: 2; }
  .bar.shielded { box-shadow: 0 0 0 1px var(--shield), 0 0 8px -2px color-mix(in oklch, var(--shield) 70%, transparent); }

  /* The stretch that was lost or gained, fading. */
  .ghost { position: absolute; top: 0; bottom: 0; pointer-events: none; animation: ghostOut 0.7s ease-out forwards; }
  .ghost.hpwave { animation: ghostOut 0.7s ease-out forwards, hpWave 1.2s linear var(--wave-at, 0s) infinite; }
  .ghost.hpwavein { animation: ghostOut 0.7s ease-out forwards, hpWaveIn 1.2s linear var(--wave-at, 0s) infinite; }
  .ghost.hpwavein.hpwave { animation: ghostOut 0.7s ease-out forwards, hpWaveBoth 1.2s linear var(--wave-at, 0s) infinite; }
  .ghost.damage { background: var(--hurt-red); }
  .ghost.heal { background: var(--heal-green); }
  @keyframes ghostOut { 0%, 35% { opacity: 0.95; } 100% { opacity: 0; } }

  /* The light along the bar is app.css's `.hpsweep`, shared with the sheet. */

  .healed .bar { animation: healGlow 0.95s ease-out; }
  .wounded .bar { animation: hurtGlow 0.95s ease-out; }
  @keyframes healGlow {
    30% { box-shadow: 0 0 0 1px var(--heal-green), 0 0 14px 2px color-mix(in oklch, var(--heal-green) 55%, transparent); }
  }
  @keyframes hurtGlow {
    30% { box-shadow: 0 0 0 1px var(--hurt-red), 0 0 14px 2px color-mix(in oklch, var(--hurt-red) 55%, transparent); }
  }
  .shored .bar.shielded { animation: shieldUp 1s cubic-bezier(0.2, 0.8, 0.3, 1); }
  @keyframes shieldUp {
    35% { box-shadow: 0 0 0 2px white, 0 0 16px 3px color-mix(in oklch, var(--shield) 80%, transparent); }
  }
  .healed .hpline b { animation: healNum 0.8s ease-out; }
  .wounded .hpline b { animation: hurtNum 0.8s ease-out; }
  @keyframes healNum {
    30% { color: var(--heal-green); transform: scale(1.12); text-shadow: 0 0 12px color-mix(in oklch, var(--heal-green) 60%, transparent); }
  }
  @keyframes hurtNum {
    30% { color: var(--hurt-red); transform: scale(1.12); text-shadow: 0 0 12px color-mix(in oklch, var(--hurt-red) 60%, transparent); }
  }
  .beat { animation: beat 0.45s cubic-bezier(0.2, 0.8, 0.3, 1); }
  @keyframes beat { 35% { transform: scale(1.07); } }

  /* A hit jolts the bar and kicks the line, harder the harder it was. */
  .struck .bar { animation: jolt var(--dur, 420ms) cubic-bezier(0.36, 0.07, 0.19, 0.97), hurtGlow 0.95s ease-out; }
  @keyframes jolt {
    0%, 100% { transform: translateX(0); }
    12% { transform: translateX(calc(var(--amp, 4px) * -1)); }
    28% { transform: translateX(var(--amp, 4px)); }
    46% { transform: translateX(calc(var(--amp, 4px) * -0.6)); }
    66% { transform: translateX(calc(var(--amp, 4px) * 0.3)); }
  }
  .struck .bar::after {
    content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--hurt-red);
    opacity: 0; pointer-events: none; animation: hpFlash var(--dur, 420ms) var(--ease-out);
  }
  .struck .hpline { animation: kick var(--dur, 420ms) cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  @keyframes kick {
    14% { transform: translateX(calc(var(--amp, 4px) * 0.45)); }
    32% { transform: translateX(calc(var(--amp, 4px) * -0.4)); }
    54% { transform: translateX(calc(var(--amp, 4px) * 0.2)); }
  }

  /* At 0 and fighting for it, a red glow breathes; dead, it stays. */
  .dying .bar { animation: dyingPulse 1.6s ease-in-out infinite; }
  @keyframes dyingPulse {
    0%, 100% { box-shadow: 0 0 0 1px color-mix(in oklch, var(--hurt-red) 55%, transparent); }
    50% { box-shadow: 0 0 0 1.5px var(--hurt-red), 0 0 14px 3px color-mix(in oklch, var(--hurt-red) 60%, transparent); }
  }
  .dead .bar { box-shadow: 0 0 0 1.5px var(--hurt-red), 0 0 12px 2px color-mix(in oklch, var(--hurt-red) 55%, transparent); }

  /* The amount, rising off the bar. */
  .float {
    display: inline-block; margin-left: 0.25rem; pointer-events: none;
    text-shadow: 0 1px 3px rgb(0 0 0 / 0.55); font-size: 0.6875rem; font-weight: 700;
    font-variant-numeric: tabular-nums; white-space: nowrap;
    animation: floatUp 1.1s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
  }
  .float.heal { color: var(--heal-green); }
  .float.temp { color: var(--shield); }
  .float.hurt { color: var(--hurt-red); }
  @keyframes floatUp {
    0% { opacity: 0; transform: translateY(4px); }
    20% { opacity: 1; transform: translateY(-1px); }
    70% { opacity: 1; }
    100% { opacity: 0; transform: translateY(-9px); }
  }
  :global(html[data-motion='reduce']) .float { display: none; }
  :global(html[data-motion='reduce']) .bar, :global(html[data-motion='reduce']) .hpline, :global(html[data-motion='reduce']) .hpline b { animation: none !important; }
  :global(html[data-motion='reduce']) .ghost.hpwave, :global(html[data-motion='reduce']) .ghost.hpwavein { animation: ghostOut 0.7s ease-out forwards; }
</style>
