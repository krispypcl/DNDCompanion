<script lang="ts">
  import { advantageFrom } from '$lib/rules/equipment';
  /** Abilities and saving throws. The modifier is the hero number and the
      score sits under it, because the modifier is what you use every round. */
  import { signed as sign } from '$lib/actions';
  import EditableField from './EditableField.svelte';
  import { modifierOf, saveBonus, saveExtra, saveParts } from '$lib/rules/derived';
  import { abilityScoreParts } from '$lib/rules/equipment';
  import Why from './Why.svelte';
  import { ABILITIES, type Ability, type Definition } from '$lib/types';
  import { bump } from '$lib/motion';

  let {
    definition,
    editable,
    onchange,
    onroll
  }: {
    definition: Definition;
    editable: boolean;
    onchange: (next: Definition) => void;
    /** Out of edit mode, a saving throw rolls in the dice tray (the owner's). */
    onroll?: (label: string, bonus: number, mode?: 'normal' | 'advantage') => void;
  } = $props();

  const NAMES: Record<Ability, string> = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution',
    int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'
  };


  function setScore(ability: Ability, score: number) {
    onchange({ ...definition, abilities: { ...definition.abilities, [ability]: score } });
  }

  function breakdown(ability: Ability) {
    const extra = saveExtra(definition, ability);
    const parts = [`${NAMES[ability]} modifier`];
    if (definition.saves?.[ability]) parts.push('proficiency');
    if (extra !== 0) parts.push(`bonus ${sign(extra)}`);
    return parts.join(' + ');
  }

  /** Zero is the default, so an emptied field reads as 0. It is dropped from
      the stored object rather than written as a 0, which keeps a sheet that
      has no bonuses free of six pointless keys; `saveExtra` reads a missing
      one as zero either way. */
  function setBonus(ability: Ability, raw: number | string) {
    const next = { ...(definition.saveBonuses ?? {}) };
    const value = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(value) || value === 0) delete next[ability];
    else next[ability] = value;
    onchange({ ...definition, saveBonuses: next });
  }

  function toggleSave(ability: Ability) {
    onchange({
      ...definition,
      saves: { ...definition.saves, [ability]: !definition.saves?.[ability] }
    });
  }
</script>

<span class="cap">Abilities</span>
<div class="abilities">
  {#each ABILITIES as ability (ability)}
    {@const sc = abilityScoreParts(definition, ability)}
    <Why title={NAMES[ability]} parts={sc.parts} total="{sc.score} ({sign(modifierOf(definition, ability))})"
         hint="The modifier is half the score above 10, rounded down.">
    <div class="ability">
      <span class="name">{NAMES[ability]}</span>
      <span class="mod" use:bump={modifierOf(definition, ability)}>{sign(modifierOf(definition, ability))}</span>
      <span class="score">
        <EditableField
          value={definition.abilities[ability]}
          {editable}
          type="number"
          label="{NAMES[ability]} score"
          onchange={(v) => setScore(ability, Number(v))}
        />
      </span>
    </div>
    </Why>
  {/each}
</div>

<span class="cap saves-cap">Saving throws</span>
<div class="saves">
  {#each ABILITIES as ability (ability)}
    {@const adv = advantageFrom(definition, 'save', ability)}
    <Why title="{NAMES[ability]} save" parts={saveParts(definition, ability)} total={sign(saveBonus(definition, ability))}
         hint={[adv.length ? `Advantage from ${adv.join(', ')}.` : '', !editable && onroll ? 'Press it to roll the save.' : ''].filter(Boolean).join(' ')}>
    <div class="save" class:on={definition.saves?.[ability]} class:rollable={!editable && onroll}>
      <button
        class="toggle"
        class:rolls={!editable && onroll}
        disabled={!editable && !onroll}
        aria-pressed={editable ? Boolean(definition.saves?.[ability]) : undefined}
        aria-label={editable || !onroll ? `${NAMES[ability]} saving throw proficiency` : `Roll a ${NAMES[ability]} saving throw`}
        title={editable || !onroll ? breakdown(ability) : `Roll a ${NAMES[ability]} save: d20 ${sign(saveBonus(definition, ability))} (${breakdown(ability)})`}
        onclick={() => (editable ? toggleSave(ability) : onroll?.(`${NAMES[ability]} save`, saveBonus(definition, ability), adv.length ? 'advantage' : 'normal'))}
      >
        <!-- The same mark as a skill's, but only ever empty or full: there
             is no expertise in a saving throw. -->
        <i class="dot" class:on={definition.saves?.[ability]} aria-hidden="true"></i>
        {#if !editable && onroll}
          <!-- This one rolls: a d20 in the corner, across from the proficiency dot. -->
          <svg class="d20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 20.5 7.4v9.2L12 21.5 3.5 16.6V7.4zM12 7.5l4.3 7.4H7.7zM12 2.5v5M20.5 7.4l-4.2 7.5M3.5 7.4l4.2 7.5M7.7 14.9 3.5 16.6M16.3 14.9l4.2 1.7M7.7 14.9 12 21.5l4.3-6.6" /></svg>
        {/if}
        <b use:bump={saveBonus(definition, ability)}>{sign(saveBonus(definition, ability))}</b>
        {#if adv.length}<span class="adv" title="Advantage from {adv.join(', ')}">ADV</span>{/if}
      </button>
      <!-- A flat bonus from an item or aura. Always rendered, so entering edit
           mode does not move the band. -->
      <span class="bonus">
        <EditableField
          value={saveExtra(definition, ability)}
          {editable}
          type="number"
          display={sign(saveExtra(definition, ability))}
          label="{NAMES[ability]} saving throw bonus"
          onchange={(v) => setBonus(ability, v)}
        />
      </span>
    </div>
    </Why>
  {/each}
</div>

<style>
  /* Out of edit mode a save is a die to roll. Unlike a skill's dashed
     outline, the whole chip is the button: a d20 waits in its corner, and on
     hover the chip rises, takes the accent and the die gives a turn. */
  .toggle.rolls { cursor: pointer; }
  .save.rollable { transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.2s cubic-bezier(0.3, 1.4, 0.5, 1), box-shadow 0.2s ease; }
  .save.rollable:hover {
    border-color: var(--a-edge); transform: translateY(-2px);
    box-shadow: 0 6px 14px -8px color-mix(in oklch, var(--a) 70%, transparent);
  }
  .save.rollable:hover b { color: var(--a); }
  .save.rollable:active { transform: translateY(0); box-shadow: none; }
  .d20 {
    position: absolute; top: 0.3125rem; right: 0.3125rem; width: 0.75rem; height: 0.75rem;
    fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linejoin: round; color: var(--faint);
    transition: color 0.2s ease, transform 0.35s cubic-bezier(0.3, 1.5, 0.5, 1);
  }
  /* Advantage, from a feature or an item: a small tag beside the number. */
  .adv {
    display: inline-block; vertical-align: 0.15em; margin-left: 0.1875rem; font-size: 0.5rem; font-weight: 700;
    letter-spacing: 0.06em; padding: 0 0.1875rem; border-radius: 3px; line-height: 1.5;
    color: var(--good, var(--a)); background: color-mix(in oklch, var(--good, var(--a)) 16%, transparent);
  }
  .save.rollable:hover .d20 { color: var(--a); transform: rotate(72deg) scale(1.2); }
  .cap {
    display: block;
    font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--label); font-weight: 600;
  }
  .abilities, .saves { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.625rem; }
  /* Each half owns its title. The abilities sit at the top of the module and
     the saving throws at the foot, so the space between them is the gap
     rather than a rule. */
  .abilities { margin-top: 0.625rem; }
  .saves-cap { margin-top: auto; padding-top: 1rem; }
  .saves { margin-top: 0.625rem; }
  .ability {
    background: var(--raised); border: 1px solid var(--line);
    border-radius: var(--r); padding: 0.625rem 0.5rem 0.5rem; text-align: center; min-width: 0;
    transition: border-color 0.2s ease, background-color 0.2s ease;
  }
  .ability:hover { border-color: var(--hover-line); background: var(--hover-bg); }
  .name {
    display: block; font-size: 0.78rem; letter-spacing: 0;
    text-transform: none; color: var(--dim); font-weight: 600;
  }
  .mod {
    display: block; font-size: 1.625rem; font-weight: 600; line-height: 1;
    color: var(--a-hi); font-variant-numeric: tabular-nums; margin-top: 0.3125rem;
  }
  /* The score sits under the modifier, the way a sheet prints it. */
  .score { display: block; margin-top: 0.3125rem; }
  .score :global(.field) {
    /* Override the variables rather than the padding directly, so the derived
       height stays in step with it. */
    --fld-leading: 1.4; --fld-pad-y: 0px;
    field-sizing: fixed; display: block; width: 2.75rem; margin-inline: auto;
    font-size: 0.75rem; color: var(--dim); font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .save {
    background: var(--raised); border: 1px solid var(--line-soft);
    border-radius: var(--r-sm); padding: 0.375rem 0.25rem 0.3125rem;
    text-align: center; min-width: 0;
    transition: border-color 0.2s ease, background-color 0.2s ease;
  }
  .save:not(.on):hover { border-color: var(--hover-line); background: var(--hover-bg); }
  .save.on { border-color: var(--a-edge); background: var(--a-wash); }
  .save { position: relative; }
  .dot {
    position: absolute; top: 0.4375rem; left: 0.4375rem;
    width: 0.5625rem; height: 0.5625rem; border-radius: 50%;
    border: 1.5px solid var(--faint); background: transparent;
    transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
  }
  .dot.on { border-color: var(--a); background: var(--a); }
  .toggle:not(:disabled):hover .dot { transform: scale(1.25); }
  .toggle {
    display: block; width: 100%; padding: 0; border: 0; background: none;
    font: inherit; color: inherit; cursor: pointer;
  }
  .toggle:disabled { cursor: default; }
  .save b { display: block; font-size: 1rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  .save.on b { color: var(--a); }
  /* The written bonus, kept quiet: the total above it is the number in play. */
  .bonus { display: block; margin-top: 0.1875rem; }
  .bonus :global(.field) {
    --fld-leading: 1.4; --fld-pad-y: 0px;
    field-sizing: fixed; display: block; width: 2.75rem; margin-inline: auto;
    font-size: 0.75rem; color: var(--dim); font-variant-numeric: tabular-nums;
    text-align: center;
  }


  @media (max-width: 860px) {
    .abilities, .saves { grid-template-columns: repeat(3, 1fr); }
  }
  /* Both carry a zero vertical padding on a laptop, which leaves a 19px
     target. A phone needs something a finger can find. */
  @media (max-width: 700px) {
    .score :global(.field), .bonus :global(.field) {
      --fld-pad-y: 0.3rem;
      /* 0.75rem on a laptop; a phone would zoom in on the field and the
         number is too small to read at arm's length anyway. */
      font-size: 1rem;
      width: 3.5rem;
    }
    .toggle { padding: 0.125rem 0; }
  }
</style>
