<script lang="ts">
  /**
   * The hit point module. It fills the height of the ability band beside it,
   * and the room that buys is spent on temp HP and hit dice — numbers that had
   * nowhere sensible to live before — rather than on padding.
   */
  import CountUp from './CountUp.svelte';
  import EditableField from './EditableField.svelte';
  import Reveal from './Reveal.svelte';
  import { applyDamage, applyHealing, hitSeverity, isDead, setDeathSave, setTempHp, vitalStatus, withVitals } from '$lib/rules/hp';
  import { snapshot } from '$lib/stores/undo';
  import { prefersReducedMotion } from '$lib/motion';
  import { backOut } from 'svelte/easing';
  import type { Definition, State } from '$lib/types';

  let {
    definition,
    state: sheetState,
    editable,
    editDefinition = false,
    onchange,
    ondefinition,
    children
  }: {
    definition: Definition;
    state: State;
    /** Owner may move HP and death saves. */
    editable: boolean;
    /** Owner is in edit mode, so the written numbers themselves may change. */
    editDefinition?: boolean;
    onchange: (next: State) => void;
    ondefinition?: (next: Definition) => void;
    /** Rest controls, rendered in the same module as the HP they restore. */
    children?: import('svelte').Snippet;
  } = $props();

  let amount = $state(1);

  /**
   * A damage or heal leaves a ghost on the bar: the stretch that was lost or
   * gained, in the colour of what happened, fading out. Without it the bar
   * just arrives at a new length and you cannot tell how far it moved.
   */
  let ghost = $state<{ left: number; width: number; kind: 'damage' | 'heal' } | null>(null);
  let pulse = $state(0);
  let struck = $state(false);
  /** A heal just landed: the gauge glows green and a light runs along it. */
  let healed = $state(false);
  /** Temporary hit points were just gained: the outline flares. */
  let shored = $state(false);
  /** Damage just landed: the same glow and light as a heal, in red. */
  let wounded = $state(false);
  /** A third death save brought them back: a white flare, once. */
  let rallied = $state(false);
  /** Set while a rally lands, so its return to 1 HP is not also a green heal. */
  let quietHeal = false;
  /** The amount that just changed, floated up off the gauge. */
  let float = $state<{ text: string; kind: 'heal' | 'temp' | 'hurt'; id: number } | null>(null);
  let healTimer: ReturnType<typeof setTimeout> | undefined;
  let hurtTimer: ReturnType<typeof setTimeout> | undefined;
  let rallyTimer: ReturnType<typeof setTimeout> | undefined;
  let tempTimer: ReturnType<typeof setTimeout> | undefined;
  let floatTimer: ReturnType<typeof setTimeout> | undefined;
  let previousTemp = -1;

  /** Off then on across a frame, so a second one restarts the animation. */
  function replay(set: (on: boolean) => void, ms: number, timer: 'heal' | 'temp' | 'hurt' | 'rally') {
    set(false);
    requestAnimationFrame(() => set(true));
    const done = setTimeout(() => set(false), ms);
    if (timer === 'heal') {
      clearTimeout(healTimer);
      healTimer = done;
    } else if (timer === 'hurt') {
      clearTimeout(hurtTimer);
      hurtTimer = done;
    } else if (timer === 'rally') {
      clearTimeout(rallyTimer);
      rallyTimer = done;
    } else {
      clearTimeout(tempTimer);
      tempTimer = done;
    }
  }

  function floatUp(text: string, kind: 'heal' | 'temp' | 'hurt') {
    float = { text, kind, id: (float?.id ?? 0) + 1 };
    clearTimeout(floatTimer);
    floatTimer = setTimeout(() => (float = null), 1100);
  }

  $effect(() => {
    const temp = sheetState.hpTemp;
    if (previousTemp === -1) {
      previousTemp = temp;
      return;
    }
    if (temp > previousTemp) {
      replay((on) => (shored = on), 1000, 'temp');
      floatUp(`+${temp - previousTemp} temp`, 'temp');
    } else if (temp < previousTemp && sheetState.hpCurrent === previous) {
      // A hit the temporary hit points took all of: the red glow still says so.
      replay((on) => (wounded = on), 950, 'hurt');
      floatUp(`−${previousTemp - temp} temp`, 'hurt');
    }
    previousTemp = temp;
  });
  /** How hard the last hit was, as inline variables the shake reads. */
  let blow = $state('');
  /* Plain variables: reading a $state inside the effect would make the effect
     depend on its own write, and returning a cleanup would cancel the timer
     on the very next run. Both cost the first damage its ghost. */
  let previous = -1;
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settle: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const current = sheetState.hpCurrent;
    const span = barTotal;
    if (previous === -1 || span === 0) {
      previous = current;
      return;
    }
    if (current === previous) return;
    const from = pct(previous);
    const to = pct(current);
    ghost =
      current < previous
        ? { left: to, width: Math.max(from - to, 0.8), kind: 'damage' }
        : { left: from, width: Math.max(to - from, 0.8), kind: 'heal' };
    const damaged = current < previous;
    const lost = previous - current;
    previous = current;
    seq += 1;
    pulse = seq;
    if (!damaged && quietHeal) {
      quietHeal = false;
    } else if (!damaged) {
      replay((on) => (healed = on), 950, 'heal');
      floatUp(`+${-lost}`, 'heal');
    }
    if (damaged) {
      replay((on) => (wounded = on), 950, 'hurt');
      floatUp(`−${lost}`, 'hurt');
      // A heavier blow moves the gauge further, longer and with more weight:
      // sideways, then up and down, then a lean, then a thickening. A scratch
      // keeps the small nudge it always had.
      const sev = hitSeverity(lost, hpMax);
      const ms = Math.round(380 + sev * 520);
      blow = [
        `--amp:${(2.5 + sev * 9.5).toFixed(2)}px`,
        `--lift:${(sev * sev * 5).toFixed(2)}px`,
        `--tilt:${(sev * 1.4).toFixed(2)}deg`,
        `--swell:${(1 + sev * 0.7).toFixed(2)}`,
        `--flash:${(0.2 + sev * 0.5).toFixed(2)}`,
        `--dur:${ms}ms`
      ].join(';');
      // Off then on across a frame, so a second hit restarts the animation
      // instead of being ignored because the class is already set.
      struck = false;
      requestAnimationFrame(() => (struck = true));
      clearTimeout(settle);
      settle = setTimeout(() => (struck = false), ms + 40);
    }
    clearTimeout(timer);
    timer = setTimeout(() => (ghost = null), 760);
  });

  const hpMax = $derived(definition.combat?.hpMax ?? 0);
  const ratio = $derived(hpMax > 0 ? Math.min(1, sheetState.hpCurrent / hpMax) : 0);
  /* Temp HP sits beyond the maximum, so the bar is scaled to both and the
     temporary part is the grey tail on the right. */
  const barTotal = $derived(hpMax + sheetState.hpTemp);
  const pct = (n: number) => (barTotal > 0 ? (n / barTotal) * 100 : 0);
  const down = $derived(sheetState.hpCurrent === 0);
  const dead = $derived(isDead(sheetState));
  /** At 0 and still fighting for it: the gauge's red pulse. */
  const dying = $derived(down && hpMax > 0 && !dead);
  const bloodied = $derived(ratio > 0 && ratio <= 0.5);
  const status = $derived(vitalStatus(sheetState.hpCurrent, hpMax, sheetState.deathSaves));
  const percent = $derived(hpMax > 0 ? Math.round(ratio * 100) : null);

  function pop(_node: Element) {
    return {
      duration: prefersReducedMotion() ? 0 : 320,
      easing: backOut,
      css: (t: number) => `opacity: ${Math.min(1, t * 1.6)}; transform: scale(${0.7 + 0.3 * t});`
    };
  }

  function act(label: string, next: State) {
    snapshot(sheetState, label);
    const settled = withVitals(sheetState, next, hpMax);
    if (sheetState.hpCurrent <= 0 && settled.hpCurrent > 0 && next.hpCurrent <= 0) {
      // A third success: a white flare rather than a green heal.
      quietHeal = true;
      replay((on) => (rallied = on), 1000, 'rally');
    }
    onchange(settled);
  }

  function patchCombat(key: string, value: string | number) {
    ondefinition?.({ ...definition, combat: { ...definition.combat, [key]: value } });
  }
</script>

<div class="hpwrap" class:struck class:healed class:shored class:wounded class:rallied class:dying class:dead
     class:reading={!editable} style={blow}>
<span class="cap">Hit points</span>

<div class="meter">
<div class="hp-readout">
  {#key pulse}
    <strong class:bloodied class:down class:beat={pulse > 0}>
      <CountUp value={sheetState.hpCurrent} />
    </strong>
  {/key}
  <span class="max">/
    <EditableField value={hpMax} editable={editDefinition} type="number" label="Max HP"
                   onchange={(v) => patchCombat('hpMax', Number(v))} />
  </span>
  {#if sheetState.hpTemp > 0}
    <span class="temp">+{sheetState.hpTemp}<small>temp</small></span>
  {/if}

  <span class="dice">
    <span class="cap">Hit dice</span>
    <b class="dicenum">
      <EditableField value={definition.combat?.hitDice} editable={editDefinition} label="Hit dice"
                     placeholder="—" onchange={(v) => patchCombat('hitDice', String(v))} />
    </b>
  </span>
</div>

<div class="gauge">
{#if float}
  {#key float.id}
    <!-- Rises from where the gauge now ends. -->
    <span class="float {float.kind}" aria-hidden="true"
          style:left="clamp(1.5rem, {pct(sheetState.hpCurrent + (float.kind === 'temp' ? sheetState.hpTemp : 0))}%, calc(100% - 2.5rem))">{float.text}</span>
  {/key}
{/if}
<div class="bar" class:shielded={sheetState.hpTemp > 0} aria-hidden="true">
  <i class="cur" class:bloodied class:down style:width="{pct(sheetState.hpCurrent)}%"></i>
  {#if healed}<i class="sweep"></i>{/if}
  {#if wounded}<i class="sweep hurt"></i>{/if}
  {#key sheetState.hpTemp}
    <i class="tmp" style:width="{pct(sheetState.hpTemp)}%"></i>
  {/key}
  {#if ghost}
    {#key pulse}
      <i class="ghost {ghost.kind}" style:left="{ghost.left}%" style:width="{ghost.width}%"></i>
    {/key}
  {/if}
</div>
</div>
</div>

<div class="actions">
  {#if !editable}
    <!-- A visitor has no buttons to press, so this space says how the
         character is doing instead. -->
    <div class="statusrow">
      {#key status.vital}
        <span class="status {status.vital}" role="status" in:pop>
          <i class="dot" aria-hidden="true"></i>{status.label}
        </span>
      {/key}
      {#if percent !== null && !down}
        <span class="pct">{percent}% of maximum</span>
      {/if}
      {#if sheetState.hpTemp > 0}
        <span class="pct">+{sheetState.hpTemp} temporary</span>
      {/if}
    </div>
  {/if}
  {#if editable}
    <div class="hprow">
      <input type="number" min="1" bind:value={amount} aria-label="Amount" />
      <button onclick={() => act('Damage', applyDamage(sheetState, amount, hpMax))}>Damage</button>
      <button onclick={() => act('Healing', applyHealing(sheetState, amount, hpMax))}>Heal</button>
      <button onclick={() => act('Temp HP', setTempHp(sheetState, amount))}>Temp</button>
    </div>
  {/if}
  <!-- A visitor can neither rest nor spend: the row is only there for the
       owner, or to show death saves when the character is down. -->
  {#if down || editable}
    <div class="restrow">
      {#if down}
        <!-- At zero there is no resting, so death saves take this space,
             veiled for everyone, the owner too, until looked at. -->
        <Reveal enabled={true} urgent={dying} cue="Death saves · hover to reveal" tapCue="Death saves · tap to reveal">
        <div class="deaths" class:stable={sheetState.deathSaves.successes >= 3}
             class:dead={sheetState.deathSaves.failures >= 3}>
          {#each (['successes', 'failures'] as const) as kind (kind)}
            <div class="drow">
              <span class="kind">{kind === 'successes' ? 'Saves' : 'Fails'}</span>
              {#each [1, 2, 3] as n (n)}
                <button
                  class="pip"
                  class:fail={kind === 'failures'}
                  aria-pressed={sheetState.deathSaves[kind] >= n}
                  aria-label="{kind} {n}"
                  disabled={!editable}
                  onclick={() =>
                    act('Death save',
                        setDeathSave(sheetState, kind, sheetState.deathSaves[kind] >= n ? n - 1 : n))}
                ></button>
              {/each}
            </div>
          {/each}
        </div>
        </Reveal>
      {:else}
        {@render children?.()}
      {/if}
    </div>
  {/if}
</div>
</div>

<style>
  /* A box of its own, so the jolt moves the module and not the panel. */
  .hpwrap { display: flex; flex-direction: column; flex: 1; min-height: 0; }
  /* The variables come from how hard the hit was; the fallbacks are the
     gentle nudge a one-point scratch gets. */
  .struck .bar {
    animation: jolt var(--dur, 420ms) cubic-bezier(0.36, 0.07, 0.19, 0.97);
  }
  @keyframes jolt {
    0%, 100% { transform: translate(0, 0) rotate(0) scaleY(1); }
    10% { transform: translate(calc(var(--amp, 5px) * -1), calc(var(--lift, 0px) * -1)) rotate(calc(var(--tilt, 0deg) * -1)) scaleY(var(--swell, 1)); }
    24% { transform: translate(var(--amp, 5px), var(--lift, 0px)) rotate(var(--tilt, 0deg)) scaleY(calc(1 + (var(--swell, 1) - 1) * 0.6)); }
    40% { transform: translate(calc(var(--amp, 5px) * -0.7), calc(var(--lift, 0px) * -0.5)) rotate(calc(var(--tilt, 0deg) * -0.6)) scaleY(calc(1 + (var(--swell, 1) - 1) * 0.3)); }
    58% { transform: translate(calc(var(--amp, 5px) * 0.45), calc(var(--lift, 0px) * 0.3)) rotate(calc(var(--tilt, 0deg) * 0.3)); }
    78% { transform: translate(calc(var(--amp, 5px) * -0.2), 0) rotate(0); }
  }
  .struck .bar::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--danger);
    opacity: 0;
    pointer-events: none;
    animation: flash var(--dur, 420ms) ease-out;
  }
  @keyframes flash {
    0% { opacity: var(--flash, 0.22); }
    100% { opacity: 0; }
  }
  /* A heavy blow also kicks the number, which the gauge alone undersold. */
  /* On the line, not the number: the number already has its own animation. */
  .struck .hp-readout { animation: kick var(--dur, 420ms) cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  @keyframes kick {
    0%, 100% { transform: translateX(0); }
    14% { transform: translateX(calc(var(--amp, 5px) * 0.45)); }
    32% { transform: translateX(calc(var(--amp, 5px) * -0.4)); }
    54% { transform: translateX(calc(var(--amp, 5px) * 0.2)); }
  }
  .cap {
    display: block;
    font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--label); font-weight: 600;
  }
  /* Label on the left of its value, sharing the temp marker's baseline. */
  .dice { margin-left: auto; display: inline-flex; align-items: baseline; gap: 0.3125rem; }
  .dicenum {
    font-size: 1.0625rem; font-weight: 600; font-variant-numeric: tabular-nums;
  }
  .dice :global(.field) {
    --fld-leading: 1.2; --fld-pad-y: 0px;
    field-sizing: content; min-width: 2.5rem; padding-inline: 0.4375rem;
    display: inline-block; text-align: center;
  }
  .hp-readout { display: flex; align-items: baseline; gap: 0.25rem; margin-top: 0.375rem; }
  .hp-readout strong {
    font-size: 2.875rem; line-height: 1; font-weight: 600;
    color: var(--a-hi); font-variant-numeric: tabular-nums;
  }
  .hp-readout strong.bloodied, .hp-readout strong.down { color: var(--danger); }
  .max { color: var(--dim); font-size: 1rem; font-variant-numeric: tabular-nums; }
  .max :global(.field) {
    --fld-leading: 1.4; --fld-pad-y: 0px;
    /* Sized to the value, so temp HP sits right beside it and only moves if
       the maximum actually gets longer. */
    field-sizing: content; min-width: 1.75rem; padding-inline: 0.4375rem;
    text-align: center; color: var(--dim);
  }
  /* Same weight and size as the maximum beside it, so the two read as one line. */
  .temp { color: var(--dim); font-size: 1rem; font-variant-numeric: tabular-nums; }
  .temp small {
    font-size: 0.6875rem; letter-spacing: 0.1em; text-transform: uppercase;
    margin-left: 0.25rem; color: var(--faint);
  }

  .bar {
    height: 14px; background: var(--track); border-radius: 7px;
    overflow: hidden; margin: 0.875rem 0 0; display: flex; position: relative;
  }
  /* Eases into place rather than snapping, so the bar is seen to catch up
     with the ghost the hit left behind. */
  .bar i { display: block; height: 100%; transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1); }
  .cur { background: var(--a-mid); }
  .cur.bloodied, .cur.down { background: var(--danger); }
  .tmp {
    background: color-mix(in oklch, var(--shield) 85%, transparent);
    animation: tempIn 0.4s ease-out;
  }
  @keyframes tempIn {
    from { filter: brightness(var(--temp-flash)); }
    to { filter: none; }
  }
  .ghost {
    position: absolute; top: 0; bottom: 0;
    animation: ghostOut 0.7s ease-out forwards;
    pointer-events: none;
  }
  .ghost.damage { background: var(--danger); }
  .ghost.heal { background: var(--heal-green); }

  /* Healing: green, always, whatever the character's colours. The gauge
     glows, a light runs along the filled part, and the number brightens. */
  .hpwrap { --heal-green: oklch(74% 0.17 150); --shield: oklch(91% 0.11 95); --hurt-red: oklch(66% 0.22 25); }
  /* On a light page, pale gold vanishes; a deeper gold, green and red read. */
  :global([data-mode='light']) .hpwrap { --heal-green: oklch(58% 0.16 150); --shield: oklch(76% 0.15 85); --hurt-red: oklch(56% 0.21 25); }
  .gauge { position: relative; }
  .healed .bar { animation: healGlow 0.95s ease-out; }
  @keyframes healGlow {
    0% { box-shadow: 0 0 0 0 transparent; }
    30% { box-shadow: 0 0 0 1px var(--heal-green), 0 0 18px 2px color-mix(in oklch, var(--heal-green) 55%, transparent); }
    100% { box-shadow: 0 0 0 0 transparent; }
  }
  .sweep {
    position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(90deg, transparent 0%, color-mix(in oklch, var(--heal-green) 80%, white) 50%, transparent 100%);
    width: 40% !important; opacity: 0.85; mix-blend-mode: screen;
    animation: sweep 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  @keyframes sweep {
    from { transform: translateX(-110%); }
    to { transform: translateX(260%); opacity: 0; }
  }
  /* Damage: the same glow, light and number, in red, running the other way. */
  .wounded .bar { animation: hurtGlow 0.95s ease-out; }
  @keyframes hurtGlow {
    0% { box-shadow: 0 0 0 0 transparent; }
    30% { box-shadow: 0 0 0 1px var(--hurt-red), 0 0 18px 2px color-mix(in oklch, var(--hurt-red) 55%, transparent); }
    100% { box-shadow: 0 0 0 0 transparent; }
  }
  .sweep.hurt {
    background: linear-gradient(90deg, transparent 0%, color-mix(in oklch, var(--hurt-red) 80%, white) 50%, transparent 100%);
    animation-name: sweepBack;
  }
  @keyframes sweepBack {
    from { transform: translateX(260%); }
    to { transform: translateX(-110%); opacity: 0; }
  }
  .wounded .hp-readout strong { animation: hurtNum 0.8s ease-out; }
  @keyframes hurtNum {
    0% { transform: scale(1); }
    30% { color: var(--hurt-red); transform: scale(1.08); text-shadow: 0 0 14px color-mix(in oklch, var(--hurt-red) 60%, transparent); }
    100% { transform: scale(1); }
  }

  /* At 0: a red glow that breathes round the gauge for as long as the
     character is dying. Dead, it stops breathing and stays. A third success
     instead flares white, once. Each takes the place of the one before. */
  .dying .bar { animation: dyingPulse 1.6s ease-in-out infinite; }
  @keyframes dyingPulse {
    0%, 100% { box-shadow: 0 0 0 1px color-mix(in oklch, var(--hurt-red) 55%, transparent), 0 0 6px 0 color-mix(in oklch, var(--hurt-red) 25%, transparent); }
    50% { box-shadow: 0 0 0 1.5px var(--hurt-red), 0 0 22px 4px color-mix(in oklch, var(--hurt-red) 60%, transparent); }
  }
  .dead .bar {
    box-shadow: 0 0 0 1.5px var(--hurt-red), 0 0 20px 3px color-mix(in oklch, var(--hurt-red) 55%, transparent);
  }
  .rallied .bar { animation: rally 1s ease-out; }
  @keyframes rally {
    0% { box-shadow: 0 0 0 0 transparent; }
    30% { box-shadow: 0 0 0 2px white, 0 0 26px 6px rgb(255 255 255 / 0.65); }
    100% { box-shadow: 0 0 0 0 transparent; }
  }
  .healed .hp-readout strong { animation: healNum 0.8s ease-out; }
  @keyframes healNum {
    0% { color: inherit; transform: scale(1); }
    30% { color: var(--heal-green); transform: scale(1.08); text-shadow: 0 0 14px color-mix(in oklch, var(--heal-green) 60%, transparent); }
    100% { transform: scale(1); }
  }

  /* Temporary hit points: a pale gold outline round the gauge for as long as
     there are any, which flares when more are gained. */
  .bar { transition: box-shadow 0.45s ease; }
  .bar.shielded {
    box-shadow: 0 0 0 1.5px var(--shield), 0 0 10px -2px color-mix(in oklch, var(--shield) 70%, transparent);
  }
  .shored .bar.shielded { animation: shieldUp 1s cubic-bezier(0.2, 0.8, 0.3, 1); }
  @keyframes shieldUp {
    0% { box-shadow: 0 0 0 0 var(--shield), 0 0 0 0 transparent; }
    35% { box-shadow: 0 0 0 3px white, 0 0 22px 4px color-mix(in oklch, var(--shield) 80%, transparent); }
    100% { box-shadow: 0 0 0 1.5px var(--shield), 0 0 10px -2px color-mix(in oklch, var(--shield) 70%, transparent); }
  }

  /* What just changed, rising off the gauge and fading. */
  .float {
    /* Starts just above the gauge, so the bar never covers it. */
    position: absolute; bottom: 18px; line-height: 14px; pointer-events: none;
    translate: -50% 0; text-shadow: 0 1px 3px rgb(0 0 0 / 0.55);
    font-size: 0.75rem; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap;
    animation: floatUp 1.1s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
  }
  .float.heal { color: var(--heal-green); }
  .float.temp { color: var(--shield); }
  .float.hurt { color: var(--hurt-red); }
  /* From the gauge up into the gap above it, never as far as the line of
     numbers. */
  @keyframes floatUp {
    0% { opacity: 0; transform: translateY(4px); }
    20% { opacity: 1; transform: translateY(-2px); }
    70% { opacity: 1; }
    100% { opacity: 0; transform: translateY(-10px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .sweep, .float { display: none; }
  }
  @keyframes ghostOut {
    0% { opacity: 0.95; }
    35% { opacity: 0.95; }
    100% { opacity: 0; }
  }
  .beat { animation: beat 0.45s cubic-bezier(0.2, 0.8, 0.3, 1); }
  @keyframes beat {
    0% { transform: scale(1); }
    35% { transform: scale(1.07); }
    100% { transform: scale(1); }
  }
  /* Side by side, so the row is the height the rest buttons were. */
  .deaths { display: flex; gap: 1.25rem; align-items: center; justify-content: center; }
  .drow { display: flex; align-items: center; gap: 0.375rem; }
  .kind {
    font-size: 0.5875rem; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--label); font-weight: 600;
  }
  .pip {
    width: 0.95rem; height: 0.95rem; border-radius: 50%;
    border: 1px solid var(--faint); background: transparent; padding: 0; cursor: pointer;
  }
  .pip[aria-pressed='true'] { background: var(--a); border-color: var(--a); animation: pipPop 0.35s cubic-bezier(0.3, 1.6, 0.5, 1); }
  @keyframes pipPop { from { transform: scale(0.3); } 60% { transform: scale(1.3); } }
  .pip { transition: background-color 0.2s ease, border-color 0.2s ease; }
  .deaths { padding: 0.25rem 0.625rem; }
  /* Failures are red whatever the theme. */
  .pip.fail[aria-pressed='true'] { background: var(--hurt-red); border-color: var(--hurt-red); }
  /* Two groups, not one wrapping row: what changes hit points now, and what
     restores them on a rest. The rule between says which is which. */
  .meter { margin-top: auto; }
  /* A visitor has no buttons below, so what there is sits in the middle of
     the card under its title, rather than at the foot of it. */
  .reading .actions { margin-bottom: auto; }
  .statusrow {
    display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
    min-height: 2.375rem;
  }
  .status {
    display: inline-flex; align-items: center; gap: 0.4375rem;
    border-radius: 999px; padding: 0.25rem 0.75rem 0.25rem 0.625rem;
    font-size: 0.8125rem; font-weight: 600; letter-spacing: 0.01em;
    border: 1px solid var(--line); background: var(--raised); color: var(--text);
    transform-origin: left center;
  }
  .dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: currentColor; flex: none; }
  /* The sheet's own colours: the accent while well, danger as it fails. */
  .status.healthy { color: var(--a); border-color: var(--a-edge); background: var(--a-wash); }
  .status.bloodied {
    color: color-mix(in oklch, var(--danger) 70%, var(--text));
    border-color: color-mix(in oklch, var(--danger) 40%, transparent);
    background: color-mix(in oklch, var(--danger-wash) 60%, transparent);
  }
  .status.critical, .status.down, .status.dead {
    color: var(--danger); border-color: color-mix(in oklch, var(--danger) 55%, transparent);
    background: var(--danger-wash);
  }
  .status.stable { color: var(--text); }
  .status.critical .dot, .status.down .dot { animation: throb 1.4s ease-in-out infinite; }
  @keyframes throb {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.55; }
  }
  .pct { font-size: 0.78rem; color: var(--dim); font-variant-numeric: tabular-nums; }
  .actions { padding-top: 0.75rem; }
  .hprow { display: flex; gap: 0.5rem; }
  /* Fixed height, so swapping rests for death saves cannot resize the module. */
  .restrow {
    margin-top: 0.625rem; padding-top: 0.625rem; border-top: 1px solid var(--line-soft);
    min-height: 3.125rem; display: flex; align-items: center;
  }
  .restrow > :global(*) { flex: 1; }
  .restrow :global(.rests) { display: flex; gap: 0.5rem; }
  .restrow :global(.rests button) { flex: 1 1 0; }
  .hprow input {
    width: 3.5rem; flex: none; background: var(--bg); border: 1px solid var(--line);
    color: var(--text); border-radius: var(--r-sm); padding: 0.5rem 0.375rem;
    font: inherit; font-size: 0.9375rem; font-weight: 600; text-align: center;
    font-variant-numeric: tabular-nums;
    -moz-appearance: textfield; appearance: textfield;
  }
  .hprow input::-webkit-outer-spin-button,
  .hprow input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .hprow button, .restrow :global(.rests button) {
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); padding: 0.5rem 0.5rem;
    font: inherit; font-size: 0.875rem; cursor: pointer; flex: 1 1 0; min-width: 0;
    transition: border-color 0.15s ease, color 0.15s ease, transform 0.08s ease;
  }
  .hprow button:active, .restrow :global(.rests button:active) { transform: translateY(1px); }
  .hprow button:hover, .restrow :global(.rests button:hover) {
    border-color: var(--a-edge); color: var(--a);
  }

  @media (max-width: 700px) {
    .hprow input { font-size: 16px; }
  }
</style>
