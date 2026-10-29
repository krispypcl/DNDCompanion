<script lang="ts">
  /**
   * Flat bonuses on saving throws: one that applies to every save — a Cloak
   * of Protection, a paladin's aura — and one per ability on top.
   *
   * Edited here rather than in the ability band, because the band is always
   * on screen and would change shape every time edit was switched on.
   */
  import { saveExtra } from '$lib/rules/derived';
  import { ABILITIES, type Ability, type Definition } from '$lib/types';

  let {
    definition,
    editable,
    onchange
  }: { definition: Definition; editable: boolean; onchange: (next: Definition) => void } = $props();

  const NAMES: Record<Ability, string> = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution',
    int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'
  };

  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  const anyBonus = $derived(ABILITIES.some((a) => saveExtra(definition, a) !== 0));

  function setAll(raw: string) {
    const next = { ...definition };
    if (raw === '') delete next.saveBonusAll;
    else next.saveBonusAll = Number(raw);
    onchange(next);
  }

  function setOne(ability: Ability, raw: string) {
    const bonuses = { ...(definition.saveBonuses ?? {}) };
    if (raw === '') delete bonuses[ability];
    else bonuses[ability] = Number(raw);
    onchange({ ...definition, saveBonuses: bonuses });
  }
</script>

{#if editable || anyBonus}
  <section class="bonuses">
    <div class="all">
      <span class="cap">All saves</span>
      {#if editable}
        <input
          type="number"
          aria-label="Bonus to all saving throws"
          placeholder="0"
          value={definition.saveBonusAll ?? ''}
          onchange={(e) => setAll(e.currentTarget.value)}
        />
      {:else}
        <b>{definition.saveBonusAll ? sign(definition.saveBonusAll) : '—'}</b>
      {/if}
    </div>

    <div class="per">
      <span class="cap">Per ability, on top</span>
      <div class="grid">
        {#each ABILITIES as ability (ability)}
          <label>
            <span class="who">{NAMES[ability]}</span>
            {#if editable}
              <input
                type="number"
                aria-label="{NAMES[ability]} saving throw bonus"
                placeholder="0"
                value={definition.saveBonuses?.[ability] ?? ''}
                onchange={(e) => setOne(ability, e.currentTarget.value)}
              />
            {:else}
              <b>{definition.saveBonuses?.[ability]
                ? sign(definition.saveBonuses[ability] as number)
                : '—'}</b>
            {/if}
          </label>
        {/each}
      </div>
    </div>
  </section>
{/if}

<style>
  .bonuses { display: flex; gap: 1.5rem; align-items: flex-start; flex-wrap: wrap; }
  .all { flex: none; }
  .per { flex: 1 1 22rem; min-width: 0; }
  .cap {
    display: block; font-size: 0.6875rem; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--label); font-weight: 600;
  }
  .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.625rem; margin-top: 0.375rem; }
  label { display: block; text-align: center; min-width: 0; }
  .who {
    display: block; font-size: 0.5875rem; letter-spacing: 0.03em;
    text-transform: uppercase; color: var(--dim); margin-bottom: 0.1875rem;
  }
  b, input {
    display: block; width: 100%; box-sizing: border-box; text-align: center;
    font-size: 0.9375rem; font-weight: 600; font-variant-numeric: tabular-nums;
    padding: 0.25rem 0.25rem; border: 1px solid transparent; border-radius: var(--r-sm);
  }
  .all b, .all input { width: 4rem; margin-top: 0.375rem; }
  input {
    background: var(--bg); border-color: var(--line); color: var(--text); font-family: inherit;
    -moz-appearance: textfield; appearance: textfield;
    transition: border-color 0.15s ease;
  }
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input:hover { border-color: var(--a-edge); }
  b { color: var(--dim); }
  @media (max-width: 760px) { .grid { grid-template-columns: repeat(3, 1fr); } }
</style>
