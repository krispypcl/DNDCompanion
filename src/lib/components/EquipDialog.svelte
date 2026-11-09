<script lang="ts">
  /**
   * Equipping an item asks what it does while worn: armour (its base AC and
   * how much Dexterity it allows), a shield, a bonus to AC, speed,
   * initiative or saving throws, or an ability score it sets or raises.
   * The name gives a first guess ("Leather armor" starts as armour 11 + Dex).
   * What is chosen is kept on the item, so equipping it again is one press.
   *
   * A feature uses the same dialog (`feature`): what it does, always, with
   * no equipping. Either can also give advantage on initiative or on saves.
   */
  import { untrack } from 'svelte';
  import { fade, scale, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { portal } from '$lib/actions';
  import { prefersReducedMotion } from '$lib/motion';
  import { guessEffects } from '$lib/rules/equipment';
  import { ABILITIES, type Ability, type Item, type ItemEffect } from '$lib/types';

  let {
    item,
    feature = false,
    onsave,
    onclose
  }: {
    item: Pick<Item, 'name' | 'effects' | 'equipped'>;
    /** A feature's effects, not an item's: nothing to equip, always on. */
    feature?: boolean;
    onsave: (effects: ItemEffect[], equipped: boolean) => void;
    onclose: () => void;
  } = $props();

  const NAMES: Record<Ability, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
  type Kind = ItemEffect['kind'];
  // Read once, when the dialog opens: the fields below are the draft.
  const start = untrack(() => (item.effects?.length ? item.effects : feature ? [] : guessEffects(item.name ?? '')));
  const has = (k: Kind) => start.find((e) => e.kind === k);

  // One of each kind, switched on or off.
  let on = $state<Record<Kind, boolean>>({
    armor: Boolean(has('armor')), shield: Boolean(has('shield')), ac: Boolean(has('ac')), speed: Boolean(has('speed')),
    init: Boolean(has('init')), save: Boolean(has('save')), ability: Boolean(has('ability')), advantage: Boolean(has('advantage'))
  });
  const adv = has('advantage') as Extract<ItemEffect, { kind: 'advantage' }> | undefined;
  // Advantage on initiative, on all saves, or on one ability's saves.
  let advOn = $state<'init' | Ability | 'all'>(adv ? (adv.on === 'init' ? 'init' : adv.ability ?? 'all') : 'init');
  const a = has('armor') as Extract<ItemEffect, { kind: 'armor' }> | undefined;
  let armorBase = $state(a?.base ?? 11);
  let armorDex = $state<'full' | 'max2' | 'none'>(a?.dex ?? 'full');
  let shieldBonus = $state((has('shield') as { bonus: number } | undefined)?.bonus ?? 2);
  let acBonus = $state((has('ac') as { bonus: number } | undefined)?.bonus ?? 1);
  let speedBonus = $state((has('speed') as { bonus: number } | undefined)?.bonus ?? 10);
  let initBonus = $state((has('init') as { bonus: number } | undefined)?.bonus ?? 1);
  const sv = has('save') as Extract<ItemEffect, { kind: 'save' }> | undefined;
  let saveAbility = $state<Ability | 'all'>(sv?.ability ?? 'all');
  let saveBonus = $state(sv?.bonus ?? 1);
  const ab = has('ability') as Extract<ItemEffect, { kind: 'ability' }> | undefined;
  let abAbility = $state<Ability>(ab?.ability ?? 'str');
  let abMode = $state<'set' | 'bonus'>(ab?.mode ?? 'set');
  let abValue = $state(ab?.value ?? 19);

  function effects(): ItemEffect[] {
    const out: ItemEffect[] = [];
    if (on.armor) out.push({ kind: 'armor', base: Number(armorBase) || 10, dex: armorDex });
    if (on.shield) out.push({ kind: 'shield', bonus: Number(shieldBonus) || 0 });
    if (on.ac) out.push({ kind: 'ac', bonus: Number(acBonus) || 0 });
    if (on.speed) out.push({ kind: 'speed', bonus: Number(speedBonus) || 0 });
    if (on.init) out.push({ kind: 'init', bonus: Number(initBonus) || 0 });
    if (on.save) out.push({ kind: 'save', ability: saveAbility, bonus: Number(saveBonus) || 0 });
    if (on.ability) out.push({ kind: 'ability', ability: abAbility, mode: abMode, value: Number(abValue) || 0 });
    if (on.advantage) out.push(advOn === 'init' ? { kind: 'advantage', on: 'init' } : { kind: 'advantage', on: 'save', ability: advOn });
    return out;
  }
  const ROWS: { k: Kind; label: string }[] = [
    { k: 'armor', label: 'Armor' }, { k: 'shield', label: 'Shield' }, { k: 'ac', label: 'Armor Class Bonus' },
    { k: 'speed', label: 'Speed' }, { k: 'init', label: 'Initiative' }, { k: 'save', label: 'Saving Throws' },
    { k: 'ability', label: 'Ability Score' }, { k: 'advantage', label: 'Advantage' }
  ];
  const unfold = () => ({ duration: prefersReducedMotion() ? 0 : 200, easing: cubicOut });
  function focusFirst(node: HTMLElement) {
    (node.querySelector('input, button') as HTMLElement | null)?.focus();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="scrim" use:portal transition:fade={{ duration: prefersReducedMotion() ? 0 : 160 }}
     onclick={onclose} role="presentation"></div>
<div class="dialog" use:portal use:focusFirst role="dialog" aria-modal="true"
     aria-label={feature ? `What ${item.name || 'this feature'} does` : `Equip ${item.name || 'item'}`}
     transition:scale={{ duration: prefersReducedMotion() ? 0 : 200, start: 0.94, easing: cubicOut }}>
  <h2>{feature ? `What ${item.name || 'This Feature'} Does` : `Equip ${item.name || 'This Item'}`}</h2>
  <p class="lead">
    {feature ? 'What does it change, always? Tick what applies; the sheet works out the rest.'
             : 'What does it do while it’s worn? Tick what applies; the sheet works out the rest.'}
  </p>
  <div class="rows">
    {#each ROWS as row (row.k)}
      <div class="row" class:on={on[row.k]}>
        <label class="pick"><input type="checkbox" bind:checked={on[row.k]} /> {row.label}</label>
        {#if on[row.k]}
          <div class="opts" transition:slide={unfold()}>
            {#if row.k === 'armor'}
              <label>Base AC <input type="number" min="10" max="25" bind:value={armorBase} /></label>
              <label>Dexterity
                <select bind:value={armorDex}>
                  <option value="full">Full (Light)</option><option value="max2">Up to +2 (Medium)</option><option value="none">None (Heavy)</option>
                </select>
              </label>
            {:else if row.k === 'shield'}
              <label>AC + <input type="number" min="0" max="10" bind:value={shieldBonus} /></label>
            {:else if row.k === 'ac'}
              <label>AC + <input type="number" min="-5" max="10" bind:value={acBonus} /></label>
            {:else if row.k === 'speed'}
              <label>Speed + <input type="number" step="5" min="-30" max="60" bind:value={speedBonus} /> ft.</label>
            {:else if row.k === 'init'}
              <label>Initiative + <input type="number" min="-5" max="10" bind:value={initBonus} /></label>
            {:else if row.k === 'save'}
              <label>
                <select bind:value={saveAbility}>
                  <option value="all">All Saves</option>
                  {#each ABILITIES as ab (ab)}<option value={ab}>{NAMES[ab]} Saves</option>{/each}
                </select>
                + <input type="number" min="-5" max="10" bind:value={saveBonus} />
              </label>
            {:else if row.k === 'ability'}
              <label>
                <select bind:value={abAbility}>{#each ABILITIES as ab (ab)}<option value={ab}>{NAMES[ab]}</option>{/each}</select>
                <select bind:value={abMode}><option value="set">Becomes</option><option value="bonus">Goes Up By</option></select>
                <input type="number" min="-10" max="30" bind:value={abValue} />
              </label>
            {:else if row.k === 'advantage'}
              <label>On
                <select bind:value={advOn}>
                  <option value="init">Initiative</option>
                  <option value="all">All Saves</option>
                  {#each ABILITIES as ab (ab)}<option value={ab}>{NAMES[ab]} Saves</option>{/each}
                </select>
              </label>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
  <div class="actions">
    {#if !feature && item.equipped}
      <button class="ghost" onclick={() => onsave(effects(), false)}>Take It Off</button>
    {/if}
    <span class="grow"></span>
    <button class="ghost" onclick={onclose}>Cancel</button>
    <button class="go" onclick={() => onsave(effects(), true)}>{feature || item.equipped ? 'Save' : 'Equip'}</button>
  </div>
</div>

<style>
  .scrim { position: fixed; inset: 0; z-index: 80; background: rgb(0 0 0 / 0.45); }
  .dialog {
    position: fixed; z-index: 81; left: 50%; top: 50%; translate: -50% -50%; width: min(28rem, calc(100vw - 2rem));
    max-height: calc(100vh - 2rem); overflow-y: auto; padding: 1.25rem; border-radius: var(--r);
    background: var(--surface); border: 1px solid var(--line); color: var(--text); box-shadow: 0 24px 60px -20px rgb(0 0 0 / 0.7);
  }
  h2 { margin: 0; font-size: 1.0625rem; }
  .lead { margin: 0.375rem 0 0.875rem; color: var(--dim); font-size: 0.875rem; line-height: 1.45; }
  .rows { display: grid; gap: 0.375rem; }
  .row { border: 1px solid var(--line-soft); border-radius: var(--r-sm); padding: 0.5rem 0.625rem; transition: border-color 0.18s ease, background-color 0.18s ease; }
  .row.on { border-color: var(--a-edge); background: var(--a-wash); }
  .pick { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9375rem; }
  .pick input { accent-color: var(--a); width: 1rem; height: 1rem; }
  .opts { display: flex; flex-wrap: wrap; gap: 0.5rem 0.875rem; padding: 0.5rem 0 0 1.5rem; font-size: 0.875rem; color: var(--dim); }
  .opts label { display: inline-flex; align-items: center; gap: 0.375rem; }
  .opts input, .opts select {
    font: inherit; font-size: 0.875rem; color: var(--text); background: var(--bg); border: 1px solid var(--line);
    border-radius: var(--r-sm); padding: 0.25rem 0.375rem;
  }
  .opts input { width: 4rem; }
  .actions { display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; }
  .grow { flex: 1; }
  .actions button {
    font: inherit; font-size: 0.875rem; cursor: pointer; border-radius: var(--r-sm); padding: 0.4375rem 0.875rem;
    border: 1px solid var(--line); background: var(--raised); color: var(--text);
  }
  .actions .go { border-color: var(--a-edge); background: var(--a-wash); color: var(--a); }
  .actions button:hover { border-color: var(--a-edge); }
</style>
