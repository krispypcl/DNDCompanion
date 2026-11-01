<script lang="ts">
  /**
   * The hit point module. It fills the height of the ability band beside it,
   * and the room that buys is spent on temp HP and hit dice — numbers that had
   * nowhere sensible to live before — rather than on padding.
   */
  import CountUp from './CountUp.svelte';
  import EditableField from './EditableField.svelte';
  import { applyDamage, applyHealing, hitSeverity, setDeathSave, setTempHp } from '$lib/rules/hp';
  import { snapshot } from '$lib/stores/undo';
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
    if (damaged) {
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
  const bloodied = $derived(ratio > 0 && ratio <= 0.5);

  function act(label: string, next: State) {
    snapshot(sheetState, label);
    onchange(next);
  }

  function patchCombat(key: string, value: string | number) {
    ondefinition?.({ ...definition, combat: { ...definition.combat, [key]: value } });
  }
</script>

<div class="hpwrap" class:struck style={blow}>
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

<div class="bar" aria-hidden="true">
  <i class="cur" class:bloodied class:down style:width="{pct(sheetState.hpCurrent)}%"></i>
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

<div class="actions">
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
        <!-- At zero there is no resting, so death saves take this space. -->
        <div class="deaths">
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
  .tmp { background: var(--temp); animation: tempIn 0.4s ease-out; }
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
  .ghost.heal { background: var(--heal); }
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
  .pip[aria-pressed='true'] { background: var(--a); border-color: var(--a); }
  .pip.fail[aria-pressed='true'] { background: var(--danger); border-color: var(--danger); }
  /* Two groups, not one wrapping row: what changes hit points now, and what
     restores them on a rest. The rule between says which is which. */
  .meter { margin-top: auto; }
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
