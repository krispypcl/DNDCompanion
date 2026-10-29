<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import AbilityBand from '$lib/components/AbilityBand.svelte';
  import ModeToggle from '$lib/components/ModeToggle.svelte';
  import CombatActions from '$lib/components/CombatActions.svelte';
  import Currency from '$lib/components/Currency.svelte';
  import DetailsBlock from '$lib/components/DetailsBlock.svelte';
  import EditableField from '$lib/components/EditableField.svelte';
  import EntryLink from '$lib/components/EntryLink.svelte';
  import HitPoints from '$lib/components/HitPoints.svelte';
  import RestButtons from '$lib/components/RestButtons.svelte';
  import SaveIndicator from '$lib/components/SaveIndicator.svelte';
  import SkillRail from '$lib/components/SkillRail.svelte';
  import EntryTable from '$lib/components/EntryTable.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import TrackerGroup from '$lib/components/TrackerGroup.svelte';
  import ThemePicker from '$lib/components/ThemePicker.svelte';
  import UndoToast from '$lib/components/UndoToast.svelte';
  import { sheetRepo } from '$lib/data/sheets';
  import {
    characterLevel,
    classLine,
    classList,
    formulaContext,
    modifierOf,
    passiveScore,
    weightCarried
  } from '$lib/rules/derived';
  import { themeStyle } from '$lib/theme';
  import { session } from '$lib/stores/session';
  import { sheetStore } from '$lib/stores/sheet';
  import { canUndo, lastLabel, resetUndo, snapshot, undo } from '$lib/stores/undo';
  import { ABILITIES } from '$lib/types';
  import type {
    Ability,
    Attack,
    ClassEntry,
    Definition,
    Feature,
    Item,
    RestKind,
    Sheet,
    Spell,
    State,
    Tracker,
    TrackerDirection,
    TrackerType
  } from '$lib/types';

  const TABS = ['Combat', 'Spells', 'Equipment', 'Features', 'Trackers', 'Character', 'Notes', 'Backstory'];
  const PASSIVES = ['perception', 'insight', 'investigation'] as const;

  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let activeTab = $state(TABS[0]);
  let editing = $state(false);
  let refilling = $state(false);
  let toast = $state<string | null>(null);

  const sheet = $derived($sheetStore.sheet as Sheet | null);
  const definition = $derived(sheet?.definition as Definition | undefined);
  const sheetState = $derived(sheet?.state as State | undefined);
  const isOwner = $derived(Boolean($session.user && sheet && $session.user.id === sheet.owner_id));
  const editable = $derived(isOwner && editing);
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  const carried = $derived(definition ? weightCarried(definition) : 0);
  const classes = $derived(definition ? classList(definition) : []);
  const totalLevel = $derived(definition ? characterLevel(definition) : 1);

  const CLASS_COLUMNS = [
    { key: 'name', label: 'Class', width: '45%', placeholder: 'Class' },
    { key: 'subclass', label: 'Subclass', width: '35%', placeholder: 'Subclass' },
    { key: 'level', label: 'Level', width: '20%', type: 'number' as const, numeric: true, placeholder: '1' }
  ];

  /**
   * Classes are the source; the older single-class fields and the character
   * level are kept in step so existing sheets, the sheet list and `level`
   * formulas all keep working.
   */
  function saveClasses(rows: ClassEntry[]) {
    if (!definition) return;
    const list = rows.map((r) => ({
      name: String(r.name ?? ''),
      ...(r.subclass ? { subclass: String(r.subclass) } : {}),
      level: Number(r.level) || 0
    }));
    const total = list.reduce((sum, c) => sum + c.level, 0);
    const [first] = list;
    setDefinition({
      ...definition,
      identity: {
        ...definition.identity,
        classes: list,
        class: first?.name ?? definition.identity.class,
        subclass: first?.subclass,
        level: total || definition.identity.level
      }
    });
  }

  const ATTACK_COLUMNS = [
    { key: 'name', label: 'Name', width: '34%', placeholder: 'Longsword' },
    { key: 'bonus', label: 'Hit', width: '13%', numeric: true, placeholder: '+5' },
    { key: 'damage', label: 'Damage', width: '18%', numeric: true, placeholder: '1d8 + 3' },
    { key: 'damageType', label: 'Type', width: '14%', placeholder: 'slashing' },
    { key: 'notes', label: 'Notes', width: '21%', muted: true, placeholder: 'Versatile (1d10)' }
  ];
  /** Blank first: a new row has no level yet, and defaulting it to Cantrip
      would put a level on a spell nobody has written one for. */
  const SPELL_LEVELS = ['', 'Cantrip', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
  const SPELL_COLUMNS = [
    { key: 'name', label: 'Name', width: '18%', placeholder: 'Shield' },
    { key: 'level', label: 'Level', width: '9%', options: SPELL_LEVELS },
    { key: 'time', label: 'Cast time', width: '12%', placeholder: '1 reaction' },
    { key: 'range', label: 'Range', width: '10%', placeholder: 'Self' },
    { key: 'components', label: 'Components', width: '15%', placeholder: 'V, S, M' },
    { key: 'duration', label: 'Duration', width: '12%', placeholder: '1 round' },
    { key: 'save', label: 'Save', width: '10%', placeholder: 'DEX 13' },
    { key: 'notes', label: 'Notes', width: '14%', muted: true, placeholder: '+5 AC' }
  ];
  const ITEM_COLUMNS = [
    { key: 'name', label: 'Item', width: '60%', placeholder: 'Longsword' },
    { key: 'qty', label: 'Amount', width: '20%', type: 'number' as const, numeric: true, placeholder: '1' },
    { key: 'weight', label: 'Weight', width: '20%', type: 'number' as const, numeric: true, placeholder: '3' }
  ];
  const TRACKER_COLUMNS = [
    { key: 'label', label: 'Label', width: '16%', placeholder: 'Second Wind' },
    { key: 'max', label: 'Max', width: '12%', placeholder: '1 or classlevel' },
    { key: 'die', label: 'Die', width: '7%', placeholder: 'd10' },
    { key: 'type', label: 'Shape', width: '12%', options: ['pips', 'gauge'] as const },
    { key: 'direction', label: 'Direction', width: '12%', options: ['spend', 'accrue'] as const },
    { key: 'resetOn', label: 'Resets on', width: '13%', options: ['manual', 'short', 'long', 'dawn'] as const },
    { key: 'resetAmount', label: 'Refill', width: '9%', placeholder: 'full' },
    { key: 'source', label: 'Source', width: '14%', muted: true, placeholder: 'phb' }
  ];
  const FEATURE_COLUMNS = [
    { key: 'title', label: 'Title', width: '26%', placeholder: 'Second Wind' },
    { key: 'body', label: 'Description', width: '58%', placeholder: 'Regain 1d10 + level hit points' },
    { key: 'source', label: 'Source', width: '16%', muted: true, placeholder: 'phb' }
  ];
  const initiative = $derived(
    definition ? (definition.combat?.initiative ?? modifierOf(definition, 'dex')) : 0
  );

  $effect(() => {
    const id = page.params.id;
    if (!id) return;
    loading = true;
    loadError = null;
    resetUndo();
    sheetRepo
      .loadSheet(id)
      .then((found) => {
        sheetStore.load(found);
        if (!found) loadError = 'notfound';
      })
      .catch((e) => (loadError = e instanceof Error ? e.message : 'Could not load this sheet'))
      .finally(() => (loading = false));
  });

  $effect(() => {
    if (typeof location === 'undefined') return;
    const wanted = TABS.find((t) => t.toLowerCase() === location.hash.slice(1).toLowerCase());
    if (wanted) activeTab = wanted;
  });

  function setState(next: State) { sheetStore.setState(next); }
  function setDefinition(next: Definition) { sheetStore.setDefinition(next); }

  function setTracker(id: string, value: number) {
    if (!sheetState) return;
    snapshot(sheetState, 'Tracker');
    setState({ ...sheetState, trackers: { ...sheetState.trackers, [id]: value } });
  }

  function afterRest(label: string) {
    toast = label;
    refilling = true;
    setTimeout(() => (refilling = false), 700);
  }

  function doUndo() {
    const entry = undo();
    if (entry) setState(entry.state);
    toast = null;
  }

  function patchIdentity(key: string, value: string | number) {
    if (!definition) return;
    setDefinition({ ...definition, identity: { ...definition.identity, [key]: value } });
  }

  function patchCombat(key: string, value: string | number | undefined) {
    if (!definition) return;
    setDefinition({ ...definition, combat: { ...definition.combat, [key]: value } });
  }

  /**
   * Trackers nest their reset rule, and a max may be a number or a formula.
   * The editor works on a flat, all-strings row and converts on the way back,
   * so a max of "4" is stored as 4 and "prof + 1" is stored as text.
   */
  type TrackerRow = {
    id: string;
    label: string;
    max: string;
    die: string;
    type: string;
    direction: string;
    resetOn: string;
    resetAmount: string;
    group: string;
    source: string;
  };

  const numeric = (v: string) => /^-?\d+$/.test(v.trim());
  const scalar = (v: string): number | string => (numeric(v) ? Number(v) : v.trim());

  const trackerRows = $derived<TrackerRow[]>(
    (definition?.trackers ?? []).map((t) => ({
      id: t.id,
      label: t.label ?? '',
      max: String(t.max ?? ''),
      die: t.die ?? '',
      type: t.type ?? 'pips',
      direction: t.direction ?? 'spend',
      resetOn: t.reset?.on ?? 'manual',
      resetAmount: String(t.reset?.amount ?? 'full'),
      group: t.group ?? '',
      source: t.source ?? ''
    }))
  );

  function newId() {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `t${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
  }

  function saveTrackers(rows: TrackerRow[]) {
    if (!definition) return;
    const trackers: Tracker[] = rows.map((r) => ({
      id: r.id || newId(),
      label: r.label,
      max: scalar(r.max || '0'),
      ...(r.die ? { die: r.die } : {}),
      type: r.type as TrackerType,
      direction: r.direction as TrackerDirection,
      reset: {
        on: r.resetOn as RestKind | 'manual',
        amount: r.resetAmount.trim() === 'full' ? 'full' : scalar(r.resetAmount || 'full')
      },
      ...(r.group ? { group: r.group } : {}),
      ...(r.source ? { source: r.source } : {})
    }));
    setDefinition({ ...definition, trackers });
  }

  function blankTracker(): TrackerRow {
    return {
      id: newId(),
      label: 'New tracker',
      max: '1',
      die: '',
      type: 'pips',
      direction: 'spend',
      resetOn: 'long',
      resetAmount: 'full',
      group: '',
      source: ''
    };
  }
</script>

<svelte:head>
  <!-- The definition is the character's name as typed; the row's name is a
       projection of it, so prefer the definition and fall back. -->
  <title>{definition?.identity?.name?.trim() || sheet?.name || 'Character sheet'}</title>
</svelte:head>

{#if loading}
  <p class="centred">Loading…</p>
{:else if loadError === 'notfound'}
  <div class="centred">
    <h1>No sheet here</h1>
    <p>This sheet does not exist, or it has been deleted.</p>
    <a href="{base}/">Back to your sheets</a>
  </div>
{:else if loadError}
  <div class="centred"><h1>Could not load</h1><p>{loadError}</p></div>
{:else if sheet && definition && sheetState}
  <!-- The theme is scoped here, not to :root, so a campaign view can later show
       several characters in their own colours at once. -->
  <div class="sheet themed" style={themeStyle(definition.identity.theme)}>
    <header class="identity">
      <div class="portrait" class:has={Boolean(definition.identity.portraitUrl?.trim())}>
        {#if definition.identity.portraitUrl?.trim()}
          <img src={definition.identity.portraitUrl.trim()} alt="" />
        {/if}
        <span class="lvl">LV {totalLevel}</span>
      </div>

      <div class="who">
        <h1>
          <EditableField value={definition.identity.name} {editable} label="Name"
                         placeholder="Character Name"
                         onchange={(v) => patchIdentity('name', v)} />
        </h1>
        <p class="sub">
          <!-- The class is written on the Character tab, not here, so with
               none written there is nothing to label and nothing to press. -->
          {#if classLine(definition)}
            <span class="classline">{classLine(definition)}</span>
          {/if}
          <EditableField value={definition.identity.ancestry} {editable} label="Ancestry"
                         placeholder="Ancestry"
                         onchange={(v) => patchIdentity('ancestry', v)} />
          <EditableField value={definition.identity.background} {editable} label="Background"
                         placeholder="Background"
                         onchange={(v) => patchIdentity('background', v)} />
          {#if editable && classes.length > 1}
            <span class="lvltotal">level {totalLevel}</span>
          {:else if editable}
            <span class="lvledit">level
              <EditableField value={definition.identity.level} editable={true} type="number"
                             label="Level" placeholder="5"
                             onchange={(v) => patchIdentity('level', Number(v))} />
            </span>
          {/if}
          <EntryLink name={definition.identity.class ?? ''}
                     source={definition.identity.lookupUrl ? 'override' : undefined}
                     category="classes" override={definition.identity.lookupUrl} />
        </p>
      </div>

      <SaveIndicator />
      {#if $canUndo}
        <button class="undo" onclick={doUndo}>Undo {$lastLabel}</button>
      {/if}
      {#if isOwner}
        <button class="edit" aria-pressed={editing} onclick={() => (editing = !editing)}>
          {editing ? 'Done' : 'Edit'}
        </button>
      {/if}
      <a class="back" href="{base}/">Back</a>
      <ModeToggle />
    </header>

    <div class="band">
      <section class="panel hp">
        <HitPoints {definition} state={sheetState} editable={isOwner} editDefinition={editable}
                   onchange={setState} ondefinition={setDefinition}>
          {#snippet children()}
            <RestButtons {definition} state={sheetState} editable={isOwner}
                         onchange={setState} onrest={afterRest} />
          {/snippet}
        </HitPoints>
      </section>

      <section class="panel band-abilities">
        <AbilityBand {definition} {editable} onchange={setDefinition} />
      </section>
    </div>

    <div class="main">
      <section class="panel rail-skills">
        <SkillRail {definition} {editable} onchange={setDefinition} />
      </section>

      <section class="panel centre">
        <Tabs tabs={TABS} bind:active={activeTab}>
          {#snippet children(tab)}
            {#if tab === 'Combat'}
              <EntryTable
                items={definition.attacks ?? []}
                columns={ATTACK_COLUMNS}
                {editable}
                category="items"
                emptyText="No attacks yet."
                addLabel="Add attack"
                blank={() => ({ name: '' }) as Attack}
                onchange={(attacks) => setDefinition({ ...definition, attacks: attacks as Attack[] })}
              />
              <CombatActions />
            {:else if tab === 'Spells'}
              <div class="casting">
                <div>
                  <h3>Spellcasting ability</h3>
                  {#if editable}
                    <select
                      aria-label="Spellcasting ability"
                      value={definition.spellcastingAbility ?? 'none'}
                      onchange={(e) => {
                        const next = { ...definition };
                        if (e.currentTarget.value === 'none') delete next.spellcastingAbility;
                        else next.spellcastingAbility = e.currentTarget.value as Ability;
                        setDefinition(next);
                      }}
                    >
                      <option value="none">None</option>
                      {#each ABILITIES as ability (ability)}
                        <option value={ability}>{ability.toUpperCase()}</option>
                      {/each}
                    </select>
                  {:else}
                    <p class="castval">{definition.spellcastingAbility?.toUpperCase() ?? '—'}</p>
                  {/if}
                </div>
                <div>
                  <h3>Spell save DC</h3>
                  <EditableField value={definition.spellSaveDc ?? ''} {editable} type="number"
                                 label="Spell save DC" placeholder="13"
                                 onchange={(v) => setDefinition({ ...definition, spellSaveDc: v === '' ? undefined : Number(v) })} />
                </div>
                <div>
                  <h3>Spell attack bonus</h3>
                  <EditableField value={definition.spellAttackBonus ?? ''}
                                 display={definition.spellAttackBonus != null ? sign(definition.spellAttackBonus) : undefined}
                                 {editable} type="number"
                                 label="Spell attack bonus" placeholder="5"
                                 onchange={(v) => setDefinition({ ...definition, spellAttackBonus: v === '' ? undefined : Number(v) })} />
                </div>
              </div>

              <EntryTable
                items={definition.spells ?? []}
                columns={SPELL_COLUMNS}
                check={{ key: 'prepared', label: 'Prepared' }}
                {editable}
                category="spells"
                emptyText="No spells or abilities recorded."
                addLabel="Add spell"
                blank={() => ({ name: '' }) as Spell}
                onchange={(spells) => setDefinition({ ...definition, spells: spells as Spell[] })}
              />
              {#if editable}
                <p class="hint">
                  Anything you can cast or activate goes here, spell or not — an item&rsquo;s
                  charges belong here as much as a cantrip does. Source <code>homebrew</code>
                  marks an entry as yours and drops the 5e.tools link.
                </p>
              {/if}
            {:else if tab === 'Equipment'}
              <EntryTable
                items={definition.equipment ?? []}
                columns={ITEM_COLUMNS}
                {editable}
                category="items"
                emptyText="Nothing carried."
                addLabel="Add item"
                blank={() => ({ name: '', qty: 1 }) as Item}
                onchange={(equipment) => setDefinition({ ...definition, equipment: equipment as Item[] })}
              />
              {#if editable}
                <p class="hint">
                  Weight is per item, so an amount of two counts twice in the total. Leave it blank
                  for anything whose weight does not matter.
                </p>
              {/if}
            {:else if tab === 'Features'}
              <EntryTable
                items={definition.features ?? []}
                columns={FEATURE_COLUMNS}
                {editable}
                category="feats"
                emptyText="No features yet."
                addLabel="Add feature"
                blank={() => ({ title: '', body: '' }) as Feature}
                onchange={(features) => setDefinition({ ...definition, features: features as Feature[] })}
              />
              {#if editable}
                <p class="hint">
                  Class features, feats and anything an item grants. Source <code>homebrew</code>
                  marks an entry as yours and drops the 5e.tools link.
                </p>
              {/if}
            {:else if tab === 'Trackers'}
              <EntryTable
                items={trackerRows}
                columns={TRACKER_COLUMNS}
                {editable}
                category="items"
                emptyText="No trackers yet."
                addLabel="Add tracker"
                blank={blankTracker}
                onchange={(rows) => saveTrackers(rows as TrackerRow[])}
              />
              {#if editable}
                <p class="hint">
                  Max accepts a number or a formula over <code>level</code>,
                  <code>classlevel</code>, <code>prof</code> and ability modifiers —
                  <code>prof + 1</code>, <code>classlevel / 2</code>. Name the class on a
                  feature that scales with it, or multiclassing will inflate it.
                </p>
              {/if}
            {:else if tab === 'Character'}
              <EntryTable
                items={classes}
                columns={CLASS_COLUMNS}
                {editable}
                category="classes"
                emptyText="No class yet."
                addLabel="Add class"
                blank={() => ({ name: '', level: 1 }) as ClassEntry}
                onchange={(rows) => saveClasses(rows as ClassEntry[])}
              />
              {#if editable}
                <p class="hint">
                  A multiclass character has a row per class. Character level is the sum, and a
                  tracker that uses <code>classlevel</code> follows the class you name on it
                  rather than the total.
                </p>
              {/if}
              <h3 class="sub-h details-h">Details</h3>
              <DetailsBlock {definition} {editable} onchange={setDefinition} />
              {#if editable}
                <div class="themerow">
                  <span class="cap">Character theme</span>
                  <ThemePicker value={definition.identity.theme}
                               onchange={(name) => patchIdentity('theme', name)} />
                </div>
              {/if}
            {:else if tab === 'Notes'}
              <div class="notes">
                <EditableField value={definition.notes} {editable} type="textarea" label="Notes"
                               placeholder="Nothing written yet."
                               onchange={(v) => setDefinition({ ...definition, notes: String(v) })} />
              </div>
            {:else}
              <div class="notes">
                <EditableField value={definition.backstory ?? ''} {editable} type="textarea"
                               label="Backstory"
                               placeholder="Nothing written yet."
                               onchange={(v) => setDefinition({ ...definition, backstory: String(v) })} />
              </div>
            {/if}
          {/snippet}
        </Tabs>
      </section>

      <section class="panel rail-right">
        <h2 class="cap">Defenses</h2>
        <div class="defense">
          <div class="defbox">
            <b>
              <EditableField value={definition.combat?.ac} {editable} type="number"
                             label="AC" onchange={(v) => patchCombat('ac', Number(v))} />
            </b>
            <span class="cap">Armor Class</span>
          </div>
          <div class="defbox">
            <b>
              <EditableField value={definition.combat?.initiative ?? ''}
                             display={definition.combat?.initiative == null ? sign(initiative) : undefined}
                             {editable} type="number" label="Initiative"
                             placeholder={sign(initiative)} hint={String(modifierOf(definition, 'dex'))}
                             onchange={(v) => patchCombat('initiative', v === '' ? undefined : Number(v))} />
            </b>
            <span class="cap">Initiative</span>
          </div>
          <div class="defbox">
            <b>
              <EditableField value={definition.proficiency} display={sign(definition.proficiency)}
                             {editable} type="number" label="Proficiency bonus"
                             onchange={(v) => setDefinition({ ...definition, proficiency: Number(v) })} />
            </b>
            <span class="cap">Proficiency</span>
          </div>
          <div class="defbox">
            <b>
              <EditableField value={definition.combat?.speed}
                             display={definition.combat?.speed != null
                               ? `${definition.combat.speed} ft.`
                               : undefined}
                             {editable} type="number"
                             label="Speed" onchange={(v) => patchCombat('speed', Number(v))} />
            </b>
            <span class="cap">Speed</span>
          </div>
          <div class="defbox">
            <b>
              <EditableField value={definition.abilitySaveDc ?? ''} {editable} type="number"
                             label="Ability save DC" placeholder="13"
                             onchange={(v) => setDefinition({ ...definition, abilitySaveDc: v === '' ? undefined : Number(v) })} />
            </b>
            <span class="cap">Save DC</span>
          </div>
          <div class="defbox themed-num">
            <b>
              <EditableField value={sheetState.inspiration ?? 0} {editable} type="number"
                             label="Inspiration"
                             onchange={(v) => setState({ ...sheetState, inspiration: Number(v) })} />
            </b>
            <span class="cap">Inspiration</span>
          </div>
        </div>

        <div class="passives">
          <h2 class="cap">Passives</h2>
          <div class="defense">
            {#each PASSIVES as skill (skill)}
              <div class="defbox">
                <b>{passiveScore(definition, skill)}</b>
                <span class="cap">{skill[0].toUpperCase() + skill.slice(1)}</span>
              </div>
            {/each}
          </div>
        </div>

        {#if (definition.trackers ?? []).length > 0}
          <div class="trk">
            <h2 class="cap">Trackers</h2>
            <TrackerGroup
              trackers={definition.trackers}
              spent={sheetState.trackers}
              ctx={formulaContext(definition)}
              editable={isOwner}
              {refilling}
              onchange={setTracker}
            />
          </div>
        {/if}

        <div class="money">
          <h2 class="cap">Currency</h2>
          <Currency {definition} editable={editable} onchange={setDefinition} />
          <div class="carried">
            <span>Weight carried</span>
            <b>{carried > 0 ? carried : '—'}</b>
          </div>
        </div>

        <div class="profs">
          <h2 class="cap">Proficiencies</h2>
          <EditableField
            value={definition.traits?.proficiencies ?? ''}
            {editable}
            type="textarea"
            rows={4}
            label="Proficiencies"
            placeholder="—"
            hint="Armour, weapons, tools, saving throws."
            onchange={(v) =>
              setDefinition({
                ...definition,
                traits: { ...(definition.traits ?? {}), proficiencies: String(v) }
              })}
          />
        </div>

        <div class="profs">
          <h2 class="cap">Languages</h2>
          <EditableField
            value={definition.traits?.languages ?? ''}
            {editable}
            type="textarea"
            rows={2}
            label="Languages"
            placeholder="—"
            hint="Common, Thieves' cant, Deep Speech."
            onchange={(v) =>
              setDefinition({
                ...definition,
                traits: { ...(definition.traits ?? {}), languages: String(v) }
              })}
          />
        </div>

        <div class="profs">
          <h2 class="cap">Senses</h2>
          <EditableField
            value={definition.senses ?? ''}
            {editable}
            type="textarea"
            rows={3}
            label="Senses"
            placeholder="—"
            hint="Darkvision 60 ft., blindsight, tremorsense."
            onchange={(v) => setDefinition({ ...definition, senses: String(v) })}
          />
        </div>
      </section>
    </div>
  </div>

  <UndoToast label={toast} onundo={doUndo} onexpire={() => (toast = null)} />
{/if}

<style>
  /* Panels arrive in reading order rather than all at once. */
  @keyframes rise {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }
  .identity, .band > :global(*), .main > :global(*) {
    animation: rise 0.3s cubic-bezier(0.2, 0.7, 0.3, 1) backwards;
  }
  .band > :global(*:nth-child(1)) { animation-delay: 0.04s; }
  .band > :global(*:nth-child(2)) { animation-delay: 0.08s; }
  .main > :global(*:nth-child(1)) { animation-delay: 0.12s; }
  .main > :global(*:nth-child(2)) { animation-delay: 0.16s; }
  .main > :global(*:nth-child(3)) { animation-delay: 0.2s; }

  .centred { max-width: 30rem; margin: 4rem auto; padding: 0 1rem; text-align: center; color: var(--dim); }
  .centred a { color: var(--a); }
  .sheet { padding: 1.5rem; max-width: 110rem; margin: 0 auto; }
  .panel {
    background: var(--surface); border: 1px solid var(--line-soft);
    border-radius: var(--r); padding: 1rem; min-width: 0;
  }
  .cap {
    display: block; font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--label); font-weight: 600; margin: 0;
  }

  .identity { display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .portrait {
    width: 6rem; aspect-ratio: 1; border-radius: var(--r); border: 1px solid var(--a-edge);
    flex: none; display: flex; align-items: flex-end; justify-content: center;
    position: relative; overflow: visible;
    background: linear-gradient(150deg, var(--portrait-from), var(--portrait-to));
  }
  .portrait img {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; border-radius: var(--r);
  }
  /* Sits on the bottom edge, half in and half out. */
  .lvl {
    position: absolute; left: 50%; bottom: 0; transform: translate(-50%, 50%);
    background: var(--surface); border: 1px solid var(--a-edge);
    color: var(--a); border-radius: var(--r-sm); font-size: 0.6875rem; font-weight: 650;
    padding: 0.0625rem 0.5rem; letter-spacing: 0.02em; white-space: nowrap;
  }
  .who { flex: 1 1 auto; min-width: 0; }
  .who h1 { margin: 0; font-size: 1.75rem; font-weight: 600; letter-spacing: -0.015em; }
  .sub :global(input.field) { min-width: 5.5rem; }
  .sub {
    margin: 0.3125rem 0 0; color: var(--dim); font-size: 0.875rem;
    display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: baseline;
  }
  .lvledit { display: inline-flex; gap: 0.3rem; align-items: baseline; }
  /* Must out-specify `.sub :global(input.field)` below, whose min-width was
     holding this open at 5.5rem however narrow the width was set. */
  .sub .lvledit :global(input.field) {
    text-align: left; field-sizing: fixed;
    width: 2.5rem; min-width: 0;
  }
  .lvltotal { color: var(--dim); }
  .classline { color: var(--text); }
  .sub-h {
    font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--label); font-weight: 600; margin: 0 0 0.625rem;
  }
  .details-h { margin-top: 1.75rem; }
  .edit {
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); padding: 0.375rem 0.875rem; font: inherit;
    font-size: 0.8125rem; cursor: pointer; flex: none; min-width: 4.5rem;
  }
  .edit[aria-pressed='true'] { border-color: var(--a-edge); color: var(--a); background: var(--a-wash); }
  .edit, .undo, .back { transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.08s ease; }
  .edit:active, .undo:active, .back:active { transform: translateY(1px); }
  .undo {
    background: none; border: 1px solid var(--line); color: var(--dim);
    border-radius: var(--r-sm); padding: 0.375rem 0.75rem; font: inherit;
    font-size: 0.8125rem; cursor: pointer; flex: none;
  }
  .undo:hover { border-color: var(--a-edge); color: var(--a); }
  .back {
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); padding: 0.375rem 0.875rem; font-size: 0.8125rem;
    text-decoration: none; flex: none; line-height: 1.5;
  }
  .back:hover { border-color: var(--a-edge); color: var(--a); }

  /* Equal heights: the hit point module matches the ability band beside it. */
  .band {
    display: grid; grid-template-columns: minmax(16rem, 1fr) 2.05fr;
    gap: 1rem; margin-bottom: 1rem; align-items: stretch;
  }
  .hp { display: flex; flex-direction: column; position: relative; overflow: hidden; }
  /* A column, so the ability band can push its rows to the bottom. */
  .band-abilities { display: flex; flex-direction: column; }

  .main { display: grid; grid-template-columns: 16.5rem 1fr 18.75rem; gap: 1rem; align-items: stretch; }
  .rail-skills { order: -1; }
  .rail-right { order: 1; display: flex; flex-direction: column; }
  .centre { display: flex; flex-direction: column; }

  .defense { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin: 0.625rem 0 0; }
  .defbox {
    background: var(--raised); border: 1px solid var(--line-soft); border-radius: var(--r);
    padding: 0.625rem 0.3125rem; text-align: center; min-width: 0;
    display: flex; flex-direction: column; justify-content: space-between;
    min-height: 4.125rem;
    transition: border-color 0.2s ease, background-color 0.2s ease;
  }
  .defbox:hover { border-color: var(--hover-line); background: var(--hover-bg); }
  /* Inspiration is the one number here that is spent, so it keeps the theme.
     The field sets its own colour, so the rule has to reach inside it. */
  .defbox.themed-num b,
  .defbox.themed-num :global(.field) { color: var(--a-hi); }
  .defbox b {
    display: block; font-size: 1.375rem; font-weight: 600; line-height: 1;
    color: var(--text); font-variant-numeric: tabular-nums;
    /* "30 ft." must not wrap into its own label. */
    white-space: nowrap;
  }
  /* Tighter than a section title: "INSPIRATION" has to fit a third of the rail. */
  /* These labels are full words in a third of the rail: "Investigation" and
     "Proficiency" both have to fit without breaking. */
  .defbox .cap { margin-top: 0.4375rem; font-size: 0.5375rem; letter-spacing: 0.03em; }
  .defbox :global(.field) {
    --fld-leading: 1; --fld-pad-y: 0px;
    field-sizing: fixed; display: block; margin-inline: auto;
    width: 100%; text-align: center; font-size: 1.375rem; white-space: nowrap;
  }
  .trk { padding-top: 1.25rem; }
  .trk .cap { margin-bottom: 0.625rem; }
  /* Directly below the trackers. With equal-height rails the slack falls to
     the bottom of the panel, not into a gap above this. */
  .passives { padding-top: 1.25rem; }
  .passives .cap:first-child { margin-bottom: 0.625rem; }
  .money { padding-top: 1.25rem; }
  .money .cap { margin-bottom: 0.5rem; }
  .profs { padding-top: 1.25rem; }
  .profs .cap { margin-bottom: 0.5rem; }
  .profs :global(.field) {
    width: 100%; field-sizing: fixed; display: block;
    white-space: pre-wrap; overflow-wrap: anywhere; font-size: 0.8125rem;
  }
  .carried {
    display: flex; justify-content: space-between; font-size: 0.8125rem;
    color: var(--dim); margin-top: 0.625rem; padding-top: 0.5rem;
    border-top: 1px solid var(--line-soft);
  }
  .carried b { color: var(--text); font-variant-numeric: tabular-nums; font-weight: 600; }

  .hint { color: var(--faint); font-size: 0.78rem; margin: 0.5rem 0 0; line-height: 1.5; }
  .hint code { background: var(--raised); border-radius: 3px; padding: 0.05rem 0.25rem; font-size: 0.95em; }
  .themerow { display: flex; align-items: center; gap: 1rem; margin: 1.25rem 0; flex-wrap: wrap; }
  .casting {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 1rem; margin-bottom: 1.25rem; text-align: center;
  }
  .casting h3 {
    font-size: 0.6875rem; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--label); font-weight: 600; margin: 0 0 0.25rem;
  }
  .casting :global(.field) {
    font-size: 1.0625rem; font-weight: 600; width: 4rem;
    field-sizing: fixed; display: inline-block; text-align: center;
  }
  .castval { margin: 0; font-size: 1.0625rem; font-weight: 600; padding: 0.15rem 0.3rem; border: 1px solid transparent; }
  .casting select {
    background: var(--bg); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); padding: 0.15rem 0.3rem; font: inherit;
    font-size: 1.0625rem; font-weight: 600;
  }
  /* Every other tab starts its content at the panel's edge; the notes field
     insets its text by its own padding and border, so pull the box back by
     exactly that and widen it to match. The text then lines up with the table
     in Combat, in both states. */
  .notes { margin: calc(-0.15rem - 1px) calc(-0.3rem - 1px) 0; }
  .notes :global(.field) {
    field-sizing: fixed;
    width: 100%;
    white-space: pre-wrap; overflow-wrap: anywhere;
  }

  @media (max-width: 860px) {
    .sheet { padding: 0.875rem; }
    .band, .main { grid-template-columns: 1fr; }
    /* Proficiencies, languages and senses are long free text; at 13px they
       are both hard to read and small enough that a phone zooms in on focus. */
    .profs :global(.field) { font-size: 1rem; }
    /* On a phone the attacks must come before an 18-row skill list. */
    .rail-skills { order: 3; }
    .identity { gap: 0.75rem; }
  }

  @media (max-width: 700px) {
    /* The header ran to a third of the screen before a single hit point was
       visible. The portrait gives most of that back. */
    .portrait { width: 4rem; }
    .sheet { padding: 0.75rem; }
    .band, .main { gap: 0.75rem; }
    .panel { padding: 0.875rem; }
    /* Six abilities over three columns leaves the names cramped; two rows of
       three with room to breathe reads better at this width. */
    .defense { gap: 0.4375rem; }
  }
</style>
