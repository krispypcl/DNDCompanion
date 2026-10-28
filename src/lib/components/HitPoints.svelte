<script lang="ts">
  /**
   * The hit point module. It fills the height of the ability band beside it,
   * and the room that buys is spent on temp HP and hit dice — numbers that had
   * nowhere sensible to live before — rather than on padding.
   */
  import CountUp from './CountUp.svelte';
  import EditableField from './EditableField.svelte';
  import { applyDamage, applyHealing, setDeathSave, setTempHp } from '$lib/rules/hp';
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

<span class="cap">Hit points</span>

<div class="readout">
  <strong class:bloodied class:down><CountUp value={sheetState.hpCurrent} /></strong>
  <span class="max">/
    {#if editDefinition}
      <EditableField value={hpMax} editable={true} type="number" label="Max HP"
                     onchange={(v) => patchCombat('hpMax', Number(v))} />
    {:else}{hpMax}{/if}
  </span>
  {#if sheetState.hpTemp > 0}
    <span class="temp" title="Temporary hit points">+{sheetState.hpTemp}</span>
  {/if}
</div>

<div class="bar" aria-hidden="true">
  <i class="cur" class:bloodied class:down style:width="{pct(sheetState.hpCurrent)}%"></i>
  <i class="tmp" style:width="{pct(sheetState.hpTemp)}%"></i>
</div>

<div class="pairs">
  <div class="pair">
    <span class="cap">Hit dice</span>
    <b>
      {#if editDefinition}
        <EditableField value={definition.combat?.hitDice ?? ''} editable={true} label="Hit dice"
                       placeholder="5d10" onchange={(v) => patchCombat('hitDice', String(v))} />
      {:else}{definition.combat?.hitDice || '—'}{/if}
    </b>
  </div>
</div>

{#if down}
  <div class="deaths">
    <span class="cap">Death saves</span>
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
{/if}

<div class="controls">
  {#if editable}
    <button onclick={() => act('Damage', applyDamage(sheetState, amount, hpMax))}>Damage</button>
    <input type="number" min="1" bind:value={amount} aria-label="Amount" />
    <button onclick={() => act('Healing', applyHealing(sheetState, amount, hpMax))}>Heal</button>
    <button onclick={() => act('Temp HP', setTempHp(sheetState, amount))}>Temp</button>
  {/if}
  {@render children?.()}
</div>

<style>
  .cap {
    display: block;
    font-size: 0.625rem; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--dim); font-weight: 600;
  }
  .readout { display: flex; align-items: baseline; gap: 0.5rem; margin-top: 0.375rem; }
  .readout strong {
    font-size: 2.375rem; line-height: 1; font-weight: 600;
    color: var(--a-hi); font-variant-numeric: tabular-nums;
  }
  .readout strong.bloodied, .readout strong.down { color: var(--danger); }
  .max { color: var(--dim); font-size: 1rem; font-variant-numeric: tabular-nums; }
  .temp {
    color: var(--dim); font-size: 1.125rem; font-weight: 600;
    font-variant-numeric: tabular-nums; margin-left: 0.125rem;
  }
  .max :global(input) { width: 4rem; }
  .bar {
    height: 6px; background: oklch(20% 0.004 286); border-radius: 3px;
    overflow: hidden; margin: 0.75rem 0 1rem; display: flex;
  }
  .bar i { display: block; height: 100%; transition: width 0.35s ease; }
  .cur { background: var(--a-mid); }
  .cur.bloodied, .cur.down { background: var(--danger); }
  .tmp { background: var(--dim); }
  .pairs { display: grid; grid-template-columns: 1fr; gap: 0.625rem; }
  .pair {
    background: var(--raised); border: 1px solid var(--line-soft);
    border-radius: var(--r-sm); padding: 0.5rem 0.625rem; min-width: 0;
  }
  .pair b {
    display: block; font-size: 1.0625rem; font-weight: 600;
    margin-top: 0.125rem; font-variant-numeric: tabular-nums;
  }
  .pair :global(input), .pair :global(.readout) { font-size: 1.0625rem; padding: 0; width: 100%; }
  .deaths { margin-top: 1rem; }
  .drow { display: flex; align-items: center; gap: 0.3125rem; margin-top: 0.3125rem; }
  .kind { font-size: 0.75rem; color: var(--dim); width: 2.75rem; }
  .pip {
    width: 0.95rem; height: 0.95rem; border-radius: 50%;
    border: 1px solid var(--faint); background: transparent; padding: 0; cursor: pointer;
  }
  .pip[aria-pressed='true'] { background: var(--a); border-color: var(--a); }
  .pip.fail[aria-pressed='true'] { background: var(--danger); border-color: var(--danger); }
  .controls { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: auto; padding-top: 1rem; }
  /* The rest buttons are handed in as children inside their own wrapper; this
     dissolves it so they lay out in the same row rather than on a line below. */
  .controls :global(.rests) { display: contents; }
  .controls input {
    width: 3.4rem; background: var(--raised); border: 1px solid var(--line);
    color: var(--text); border-radius: var(--r-sm); padding: 0.3125rem 0.4375rem;
    font: inherit; font-size: 0.8125rem;
  }
  .controls button {
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); padding: 0.3125rem 0.75rem;
    font: inherit; font-size: 0.8125rem; cursor: pointer;
  }
  .controls button:hover { border-color: var(--a-edge); color: var(--a); }
</style>
