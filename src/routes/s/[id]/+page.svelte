<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import AbilityBand from '$lib/components/AbilityBand.svelte';
  import AttackList from '$lib/components/AttackList.svelte';
  import Currency from '$lib/components/Currency.svelte';
  import DetailsBlock from '$lib/components/DetailsBlock.svelte';
  import EditableField from '$lib/components/EditableField.svelte';
  import EntryLink from '$lib/components/EntryLink.svelte';
  import EquipmentList from '$lib/components/EquipmentList.svelte';
  import ListEditor from '$lib/components/ListEditor.svelte';
  import HitPoints from '$lib/components/HitPoints.svelte';
  import RestButtons from '$lib/components/RestButtons.svelte';
  import SaveIndicator from '$lib/components/SaveIndicator.svelte';
  import SkillRail from '$lib/components/SkillRail.svelte';
  import SpellTable from '$lib/components/SpellTable.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import TrackerGroup from '$lib/components/TrackerGroup.svelte';
  import ThemePicker from '$lib/components/ThemePicker.svelte';
  import UndoToast from '$lib/components/UndoToast.svelte';
  import { sheetRepo } from '$lib/data/sheets';
  import { formulaContext, modifierOf, passiveScore, spellSaveDC } from '$lib/rules/derived';
  import { themeStyle } from '$lib/theme';
  import { session } from '$lib/stores/session';
  import { sheetStore } from '$lib/stores/sheet';
  import { canUndo, lastLabel, resetUndo, snapshot, undo } from '$lib/stores/undo';
  import type {
    Definition,
    Feature,
    RestKind,
    Sheet,
    Spell,
    State,
    Tracker,
    TrackerDirection,
    TrackerType
  } from '$lib/types';

  const TABS = ['Combat', 'Spells', 'Equipment', 'Features', 'Character', 'Notes'];
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
  const initiative = $derived(
    definition ? (definition.combat?.initiative ?? modifierOf(definition, 'dex')) : 0
  );
  /** Only a character who casts something has one; most martials do not. */
  const saveDc = $derived(
    definition?.spellcastingAbility
      ? spellSaveDC(definition, definition.spellcastingAbility)
      : null
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

  function patchCombat(key: string, value: string | number) {
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
        <span class="lvl">LV {definition.identity.level ?? 1}</span>
      </div>

      <div class="who">
        <h1>
          <EditableField value={definition.identity.name} {editable} label="Name"
                         onchange={(v) => patchIdentity('name', v)} />
        </h1>
        <p class="sub">
          <EditableField value={definition.identity.class} {editable} label="Class"
                         placeholder="Class" onchange={(v) => patchIdentity('class', v)} />
          <EditableField value={definition.identity.subclass} {editable} label="Subclass"
                         placeholder="Subclass" onchange={(v) => patchIdentity('subclass', v)} />
          <EditableField value={definition.identity.ancestry} {editable} label="Ancestry"
                         placeholder="Ancestry" onchange={(v) => patchIdentity('ancestry', v)} />
          {#if editable}
            <span class="lvledit">level
              <EditableField value={definition.identity.level} editable={true} type="number"
                             label="Level" onchange={(v) => patchIdentity('level', Number(v))} />
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

      <section class="panel">
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
              <AttackList {definition} {editable} onchange={setDefinition} />
            {:else if tab === 'Spells'}
              {#if !editable || (definition.spells ?? []).length > 0}
                <SpellTable {definition} />
              {/if}
              {#if editable}
                <ListEditor
                  title="Edit spells"
                  items={definition.spells ?? []}
                  onchange={(spells) => setDefinition({ ...definition, spells: spells as Spell[] })}
                  blank={() => ({ name: 'New spell' }) as Spell}
                  columns={[
                    { key: 'name', label: 'Name', width: '18%', placeholder: 'Shield' },
                    { key: 'time', label: 'Cast time', width: '12%', placeholder: '1 reaction' },
                    { key: 'range', label: 'Range', width: '10%', placeholder: 'Self' },
                    { key: 'duration', label: 'Duration', width: '12%', placeholder: '1 round' },
                    { key: 'save', label: 'Save / effect', width: '12%', placeholder: 'WIS 15' },
                    { key: 'notes', label: 'Notes', placeholder: '+5 AC until your next turn' },
                    { key: 'source', label: 'Source', width: '10%', placeholder: 'xphb' }
                  ]}
                />
              {/if}
            {:else if tab === 'Equipment'}
              <EquipmentList {definition} {editable} onchange={setDefinition} />
            {:else if tab === 'Features'}
              {#each definition.features ?? [] as feature, i (i)}
                <article class="feature">
                  <h3>{feature.title}<EntryLink name={feature.title} source={feature.source}
                                                category="feats" override={feature.lookupUrl} /></h3>
                  <p>{feature.body}</p>
                </article>
              {:else}
                {#if !editable}<p class="empty">No features yet.</p>{/if}
              {/each}
              {#if editable}
                <ListEditor
                  title="Edit features"
                  items={definition.features ?? []}
                  onchange={(features) => setDefinition({ ...definition, features: features as Feature[] })}
                  blank={() => ({ title: 'New feature', body: '' }) as Feature}
                  columns={[
                    { key: 'title', label: 'Title', width: '26%', placeholder: "Sheriff's Star" },
                    { key: 'body', label: 'Description', placeholder: '+1 AC, 3 charges that reset at dawn' },
                    { key: 'source', label: 'Source', width: '12%', placeholder: 'homebrew' }
                  ]}
                />
              {/if}
            {:else if tab === 'Character'}
              <DetailsBlock {definition} {editable} onchange={setDefinition} />
              {#if editable}
                <div class="themerow">
                  <span class="cap">Character theme</span>
                  <ThemePicker value={definition.identity.theme}
                               onchange={(name) => patchIdentity('theme', name)} />
                </div>
                <ListEditor
                  title="Trackers"
                  items={trackerRows}
                  onchange={saveTrackers}
                  blank={blankTracker}
                  columns={[
                    { key: 'label', label: 'Label', width: '22%', placeholder: 'Risk Dice' },
                    { key: 'max', label: 'Max or formula', width: '16%', placeholder: '4 or prof + 1' },
                    { key: 'die', label: 'Die', width: '8%', placeholder: 'd8' },
                    { key: 'type', label: 'Shape', type: 'select', options: ['pips', 'counter', 'gauge'] },
                    { key: 'direction', label: 'Direction', type: 'select', options: ['spend', 'accrue'] },
                    { key: 'resetOn', label: 'Resets on', type: 'select', options: ['manual', 'short', 'long', 'dawn'] },
                    { key: 'resetAmount', label: 'Refill', width: '10%', placeholder: 'full' },
                    { key: 'group', label: 'Group', width: '12%', placeholder: 'Class' },
                    { key: 'source', label: 'Source', width: '10%', placeholder: 'valdagunslinger' }
                  ]}
                />
                <p class="hint">
                  Max accepts a number or a formula over <code>level</code>, <code>prof</code> and
                  ability modifiers — <code>prof + 1</code>, <code>level / 2</code>. Source
                  <code>homebrew</code> marks an entry as yours and drops the 5e.tools link.
                </p>
              {/if}
            {:else}
              <div class="notes">
                <EditableField value={definition.notes} {editable} type="textarea" label="Notes"
                               placeholder="Nothing written yet."
                               onchange={(v) => setDefinition({ ...definition, notes: String(v) })} />
              </div>
            {/if}
          {/snippet}
        </Tabs>
      </section>

      <section class="panel rail-right">
        <h2 class="cap">Defense</h2>
        <div class="defense">
          <div class="defbox">
            <b>
              <EditableField value={definition.combat?.ac} {editable} type="number"
                             label="AC" onchange={(v) => patchCombat('ac', Number(v))} />
            </b>
            <span class="cap">Armor class</span>
          </div>
          <div class="defbox"><b>{sign(initiative)}</b><span class="cap">Initiative</span></div>
        </div>

        <div class="stats">
          <div class="statbox">
            <b>
              <EditableField value={definition.proficiency} display={sign(definition.proficiency)}
                             {editable} type="number" label="Proficiency bonus"
                             onchange={(v) => setDefinition({ ...definition, proficiency: Number(v) })} />
            </b>
            <span class="cap">Prof</span>
          </div>
          <div class="statbox">
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
          <div class="statbox" title={saveDc === null
              ? 'Set a spellcasting ability under Character to work this out'
              : `8 + proficiency + ${definition.spellcastingAbility?.toUpperCase()} modifier`}>
            <b>{saveDc ?? '—'}</b>
            <span class="cap">Save DC</span>
          </div>
        </div>

        <div class="passives">
          <h2 class="cap">Passive</h2>
          {#each PASSIVES as skill (skill)}
            <div class="passive">
              <span>{skill[0].toUpperCase() + skill.slice(1)}</span>
              <b>{passiveScore(definition, skill)}</b>
            </div>
          {/each}
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
    width: 4.5rem; height: 4.5rem; border-radius: var(--r); border: 1px solid var(--a-edge);
    flex: none; display: flex; align-items: flex-end; justify-content: center;
    position: relative; overflow: visible;
    background: linear-gradient(150deg, oklch(32% calc(0.05 * var(--c)) var(--h)),
                                        oklch(18% calc(0.02 * var(--c)) var(--h)));
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
  .who h1 { margin: 0; font-size: 1.375rem; font-weight: 600; letter-spacing: -0.015em; }
  .sub {
    margin: 0.25rem 0 0; color: var(--dim); font-size: 0.8125rem;
    display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: baseline;
  }
  .lvledit { display: inline-flex; gap: 0.3rem; align-items: baseline; }
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
    background: var(--raised); border: 1px solid var(--line); color: var(--dim);
    border-radius: var(--r-sm); padding: 0.375rem 0.875rem; font-size: 0.8125rem;
    text-decoration: none; flex: none; line-height: 1.5;
  }
  .back:hover { border-color: var(--a-edge); color: var(--a); }

  /* Equal heights: the hit point module matches the ability band beside it. */
  .band {
    display: grid; grid-template-columns: minmax(16rem, 1fr) 2.05fr;
    gap: 1rem; margin-bottom: 1rem; align-items: stretch;
  }
  .hp { display: flex; flex-direction: column; }

  .main { display: grid; grid-template-columns: 16.5rem 1fr 18.75rem; gap: 1rem; align-items: stretch; }
  .rail-skills { order: -1; }
  .rail-right { order: 1; display: flex; flex-direction: column; }
  .centre { display: flex; flex-direction: column; }

  .defense { display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem; margin: 0.625rem 0 0; }
  .defbox {
    background: var(--raised); border: 1px solid var(--line-soft); border-radius: var(--r);
    padding: 0.875rem 0.625rem; text-align: center;
    transition: border-color 0.2s ease;
  }
  .defbox:hover { border-color: var(--line); }
  .defbox b {
    display: block; font-size: 1.6875rem; font-weight: 600; line-height: 1;
    color: var(--a-hi); font-variant-numeric: tabular-nums;
  }
  .defbox .cap { margin-top: 0.4375rem; }
  .defbox :global(.field) {
    --fld-leading: 1; --fld-pad-y: 0px;
    field-sizing: fixed; display: block; margin-inline: auto;
    width: 4rem; text-align: center; font-size: 1.6875rem;
  }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.625rem; margin-top: 0.625rem; }
  .statbox {
    background: var(--raised); border: 1px solid var(--line-soft); border-radius: var(--r-sm);
    padding: 0.5rem 0.3125rem; text-align: center; min-width: 0;
  }
  .statbox b { display: block; font-size: 1.0625rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  .statbox .cap { margin-top: 0.1875rem; }
  .statbox :global(.field) {
    --fld-leading: 1.2; --fld-pad-y: 0px;
    field-sizing: fixed; display: block; margin-inline: auto;
    width: 3.25rem; text-align: center; font-size: 1.0625rem;
  }
  .trk { padding-top: 1.25rem; }
  .trk .cap { margin-bottom: 0.625rem; }
  /* Directly below the trackers. With equal-height rails the slack falls to
     the bottom of the panel, not into a gap above this. */
  .passives { padding-top: 1.25rem; }
  .money { padding-top: 1.25rem; }
  .money .cap { margin-bottom: 0.5rem; }
  .passive {
    display: flex; justify-content: space-between; font-size: 0.8125rem;
    padding: 0.375rem 0; color: var(--dim); border-bottom: 1px solid var(--line-soft);
  }
  .passive:last-child { border-bottom: 0; }
  .passive b { color: var(--text); font-variant-numeric: tabular-nums; font-weight: 600; }

  .feature { border-top: 1px solid var(--line-soft); padding: 0.625rem 0; }
  .feature:first-child { border-top: 0; }
  .feature h3 { margin: 0 0 0.2rem; font-size: 0.95rem; display: flex; gap: 0.3rem; align-items: center; }
  .feature p { margin: 0; font-size: 0.875rem; color: var(--dim); overflow-wrap: anywhere; }
  /* Matches the notes placeholder: body size, --dim. */
  .empty { color: var(--dim); margin: 0; }
  .hint { color: var(--faint); font-size: 0.78rem; margin: 0.5rem 0 0; line-height: 1.5; }
  .hint code { background: var(--raised); border-radius: 3px; padding: 0.05rem 0.25rem; font-size: 0.95em; }
  .themerow { display: flex; align-items: center; gap: 1rem; margin: 1.25rem 0; flex-wrap: wrap; }
  /* Every other tab starts its content at the panel's edge; the notes field
     insets its text by its own padding and border, so pull the box back by
     exactly that and widen it to match. The text then lines up with the table
     in Combat, in both states. */
  .notes { margin: calc(-0.15rem - 1px) calc(-0.3rem - 1px) 0; }
  .notes :global(.field) {
    field-sizing: fixed;
    width: calc(100% + 0.6rem + 2px);
    white-space: pre-wrap; overflow-wrap: anywhere;
  }

  @media (max-width: 860px) {
    .sheet { padding: 0.875rem; }
    .band, .main { grid-template-columns: 1fr; }
    /* On a phone the attacks must come before an 18-row skill list. */
    .rail-skills { order: 3; }
    .identity { gap: 0.75rem; }
  }
</style>
