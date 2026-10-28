<script lang="ts">
  import CountUp from './CountUp.svelte';
  import EditableField from './EditableField.svelte';
  import SaveIndicator from './SaveIndicator.svelte';
  import { applyDamage, applyHealing, setDeathSave, setTempHp } from '$lib/rules/hp';
  import { snapshot } from '$lib/stores/undo';
  import type { Definition, State } from '$lib/types';

  let {
    definition,
    state: sheetState,
    editable,
    editDefinition = false,
    onchange,
    ondefinition
  }: {
    definition: Definition;
    state: State;
    /** Owner may move HP and death saves. */
    editable: boolean;
    /** Owner is in edit mode, so the written numbers themselves may change. */
    editDefinition?: boolean;
    onchange: (next: State) => void;
    ondefinition?: (next: Definition) => void;
  } = $props();

  let amount = $state(1);

  const hpMax = $derived(definition.combat?.hpMax ?? 0);
  const ratio = $derived(hpMax > 0 ? Math.min(1, sheetState.hpCurrent / hpMax) : 0);
  const down = $derived(sheetState.hpCurrent === 0);

  function act(label: string, next: State) {
    snapshot(sheetState, label);
    onchange(next);
  }

  function patchCombat(key: string, value: string | number) {
    ondefinition?.({ ...definition, combat: { ...definition.combat, [key]: value } });
  }
</script>

<header class="vitals">
  <div class="hp">
    <span class="label">Hit points</span>
    <div class="readout">
      <strong class:bloodied={ratio <= 0.5} class:down><CountUp value={sheetState.hpCurrent} /></strong>
      <span class="max">/ {#if editDefinition}<EditableField
          value={hpMax}
          editable={true}
          type="number"
          label="Max HP"
          onchange={(v) => patchCombat('hpMax', Number(v))}
        />{:else}{hpMax}{/if}</span>
      {#if sheetState.hpTemp > 0}<span class="temp">+{sheetState.hpTemp}</span>{/if}
    </div>
    <div class="bar" aria-hidden="true"><i style:width="{ratio * 100}%"></i></div>

    {#if editable}
      <div class="controls">
        <input
          type="number"
          min="1"
          bind:value={amount}
          aria-label="Amount"
        />
        <button onclick={() => act('Damage', applyDamage(sheetState, amount, hpMax))}>Damage</button>
        <button onclick={() => act('Healing', applyHealing(sheetState, amount, hpMax))}>Heal</button>
        <button onclick={() => act('Temp HP', setTempHp(sheetState, amount))}>Temp</button>
      </div>
    {/if}
  </div>

  <div class="stat">
    <span class="label">AC</span>
    <strong>
      {#if editDefinition}
        <EditableField value={definition.combat?.ac ?? 0} editable={true} type="number" label="AC"
                       onchange={(v) => patchCombat('ac', Number(v))} />
      {:else}{definition.combat?.ac ?? '—'}{/if}
    </strong>
  </div>

  <div class="stat">
    <span class="label">Speed</span>
    <strong>
      {#if editDefinition}
        <EditableField value={definition.combat?.speed ?? 0} editable={true} type="number" label="Speed"
                       onchange={(v) => patchCombat('speed', Number(v))} />
      {:else}{definition.combat?.speed ?? '—'}{/if}<small>ft</small>
    </strong>
  </div>

  <div class="stat">
    <span class="label">Hit dice</span>
    <strong class="dice">
      {#if editDefinition}
        <EditableField value={definition.combat?.hitDice ?? ''} editable={true} label="Hit dice"
                       placeholder="5d10" onchange={(v) => patchCombat('hitDice', String(v))} />
      {:else}{definition.combat?.hitDice || '—'}{/if}
    </strong>
  </div>

  {#if down}
    <div class="deaths">
      <span class="label">Death saves</span>
      {#each (['successes', 'failures'] as const) as kind (kind)}
        <div class="row">
          <span class="kind">{kind === 'successes' ? 'Saves' : 'Fails'}</span>
          {#each [1, 2, 3] as n (n)}
            <button
              class="pip"
              class:fail={kind === 'failures'}
              aria-pressed={sheetState.deathSaves[kind] >= n}
              aria-label="{kind} {n}"
              disabled={!editable}
              onclick={() =>
                act(
                  'Death save',
                  setDeathSave(sheetState, kind, sheetState.deathSaves[kind] >= n ? n - 1 : n)
                )}
            ></button>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  <div class="save"><SaveIndicator /></div>
</header>

<style>
  .vitals {
    position: sticky;
    top: env(safe-area-inset-top, 0px);
    z-index: 10;
    background: var(--bg);
    border-bottom: 1px solid var(--line);
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 1rem 1.5rem;
    padding: 0.75rem 1rem;
  }
  .label {
    display: block;
    font-size: 0.68rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--dim);
  }
  .hp { min-width: 12rem; flex: 1 1 12rem; }
  .readout { display: flex; align-items: baseline; gap: 0.35rem; }
  .readout strong { font-size: 1.9rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .bloodied { color: var(--accent); }
  .down { color: var(--bad); }
  .max { color: var(--dim); font-variant-numeric: tabular-nums; }
  .temp { color: var(--good); font-size: 0.9rem; }
  .bar {
    height: 3px;
    background: var(--line);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 0.3rem;
  }
  .bar i { display: block; height: 100%; background: var(--accent); transition: width 0.35s ease; }
  .controls { display: flex; gap: 0.3rem; margin-top: 0.5rem; flex-wrap: wrap; }
  .controls input {
    width: 3.2rem;
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--text);
    border-radius: 5px;
    padding: 0.25rem 0.4rem;
    font: inherit;
    font-size: 0.85rem;
  }
  .controls button {
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--text);
    border-radius: 5px;
    padding: 0.25rem 0.6rem;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .controls button:hover { border-color: var(--dim); }
  .stat strong { font-size: 1.5rem; font-variant-numeric: tabular-nums; }
  .stat .dice { font-size: 1.1rem; }
  .stat small { font-size: 0.7rem; color: var(--dim); margin-left: 0.15rem; }
  .deaths .row { display: flex; align-items: center; gap: 0.3rem; margin-top: 0.25rem; }
  .kind { font-size: 0.7rem; color: var(--dim); width: 2.6rem; }
  .pip {
    width: 0.95rem;
    height: 0.95rem;
    border-radius: 50%;
    border: 1px solid var(--dim);
    background: transparent;
    padding: 0;
    cursor: pointer;
  }
  .pip[aria-pressed='true'] { background: var(--good); border-color: var(--good); }
  .pip.fail[aria-pressed='true'] { background: var(--bad); border-color: var(--bad); }
  .save { margin-left: auto; align-self: center; }
  @media (max-width: 420px) {
    .vitals { gap: 0.75rem 1rem; padding: 0.6rem 0.8rem; }
    .readout strong { font-size: 1.6rem; }
  }
</style>
