<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import AbilityBlock from '$lib/components/AbilityBlock.svelte';
  import AttackList from '$lib/components/AttackList.svelte';
  import DetailsBlock from '$lib/components/DetailsBlock.svelte';
  import EditableField from '$lib/components/EditableField.svelte';
  import EntryLink from '$lib/components/EntryLink.svelte';
  import EquipmentList from '$lib/components/EquipmentList.svelte';
  import ListEditor from '$lib/components/ListEditor.svelte';
  import RestButtons from '$lib/components/RestButtons.svelte';
  import SiteHeader from '$lib/components/SiteHeader.svelte';
  import SkillList from '$lib/components/SkillList.svelte';
  import SpellTable from '$lib/components/SpellTable.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import TrackerGroup from '$lib/components/TrackerGroup.svelte';
  import UndoToast from '$lib/components/UndoToast.svelte';
  import VitalsStrip from '$lib/components/VitalsStrip.svelte';
  import { sheetRepo } from '$lib/data/sheets';
  import { formulaContext } from '$lib/rules/derived';
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

  const TABS = ['Play', 'Character', 'Spells', 'Notes'];

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

<svelte:head><title>{sheet?.name ?? 'Character sheet'}</title></svelte:head>

<SiteHeader showBack />

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
  <VitalsStrip
    {definition}
    state={sheetState}
    editable={isOwner}
    editDefinition={editable}
    onchange={setState}
    ondefinition={setDefinition}
  />

  <div class="title">
    <div class="who">
      <h1><EditableField value={definition.identity.name} editable={editable} label="Name" onchange={(v) => patchIdentity('name', v)} /></h1>
      <p class="sub">
        <EditableField value={definition.identity.class} editable={editable} label="Class" placeholder="Class" onchange={(v) => patchIdentity('class', v)} />
        <EditableField value={definition.identity.subclass} editable={editable} label="Subclass" placeholder="Subclass" onchange={(v) => patchIdentity('subclass', v)} />
        <span class="lvl">level <EditableField value={definition.identity.level} editable={editable} type="number" label="Level" onchange={(v) => patchIdentity('level', Number(v))} /></span>
        <EditableField value={definition.identity.ancestry} editable={editable} label="Ancestry" placeholder="Ancestry" onchange={(v) => patchIdentity('ancestry', v)} />
        <EntryLink name={definition.identity.class ?? ''} source={definition.identity.lookupUrl ? 'override' : undefined} category="classes" override={definition.identity.lookupUrl} />
      </p>
    </div>
    {#if isOwner}
      <button class="edit" aria-pressed={editing} onclick={() => (editing = !editing)}>
        {editing ? 'Done' : 'Edit'}
      </button>
    {/if}
  </div>

  <Tabs tabs={TABS} bind:active={activeTab}>
    {#snippet children(tab)}
      {#if tab === 'Play'}
        <div class="row">
          <RestButtons {definition} state={sheetState} editable={isOwner} onchange={setState} onrest={afterRest} />
          {#if $canUndo}
            <button class="undo" onclick={doUndo}>Undo {$lastLabel}</button>
          {/if}
        </div>
        <div class="trackers">
          <TrackerGroup
            trackers={definition.trackers ?? []}
            spent={sheetState.trackers}
            ctx={formulaContext(definition)}
            editable={isOwner}
            {refilling}
            onchange={setTracker}
          />
          {#if (definition.trackers ?? []).length === 0}
            <p class="empty">
              No trackers yet.{#if isOwner} Press Edit to add Risk Dice, spell slots or anything else your class uses.{/if}
            </p>
          {/if}
        </div>
        {#if editable}
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
            Max accepts a number or a formula over <code>level</code>, <code>prof</code> and ability
            modifiers — <code>prof + 1</code>, <code>level / 2</code>. Source <code>homebrew</code> marks
            an entry as yours and drops the 5e.tools link.
          </p>
        {/if}
        <AttackList {definition} {editable} onchange={setDefinition} />
      {:else if tab === 'Character'}
        <DetailsBlock {definition} {editable} onchange={setDefinition} />
        <AbilityBlock {definition} {editable} onchange={setDefinition} />
        <div class="prof-row">
          <span class="cap">Proficiency bonus</span>
          <EditableField value={definition.proficiency} editable={editable} type="number" label="Proficiency bonus" onchange={(v) => setDefinition({ ...definition, proficiency: Number(v) })} />
        </div>
        <SkillList {definition} {editable} onchange={setDefinition} />
        <h2>Features</h2>
        {#each definition.features ?? [] as feature, i (i)}
          <article class="feature">
            <h3>{feature.title}<EntryLink name={feature.title} source={feature.source} category="feats" override={feature.lookupUrl} /></h3>
            <p>{feature.body}</p>
          </article>
        {:else}
          <p class="empty">No features yet.</p>
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
        <div class="hitdice">
          <span class="cap">Hit dice</span>
          <EditableField value={definition.combat?.hitDice ?? ''} editable={editable} label="Hit dice total" placeholder="5d10" onchange={(v) => setDefinition({ ...definition, combat: { ...definition.combat, hitDice: String(v) } })} />
        </div>
      {:else if tab === 'Spells'}
        <SpellTable {definition} />
        {#if (definition.spells ?? []).length === 0 && !editable}
          <p class="empty">
            No spells yet.{#if isOwner} Press Edit to add them.{/if}
          </p>
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
      {:else}
        <EquipmentList {definition} {editable} onchange={setDefinition} />
        <h2>Notes</h2>
        <div class="notes">
          <EditableField value={definition.notes} editable={editable} type="textarea" label="Notes" placeholder="Nothing written yet." onchange={(v) => setDefinition({ ...definition, notes: String(v) })} />
        </div>
      {/if}
    {/snippet}
  </Tabs>

  <UndoToast label={toast} onundo={doUndo} onexpire={() => (toast = null)} />
{/if}

<style>
  .centred { max-width: 30rem; margin: 4rem auto; padding: 0 1rem; text-align: center; color: var(--dim); }
  .centred a { color: var(--accent); }
  .title { display: flex; align-items: flex-start; gap: 1rem; padding: 1rem 1rem 0.5rem; }
  .who { min-width: 0; flex: 1; }
  h1 { margin: 0; font-size: 1.5rem; }
  .sub { margin: 0.15rem 0 0; color: var(--dim); font-size: 0.9rem; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: baseline; }
  .lvl { display: inline-flex; gap: 0.3rem; align-items: baseline; }
  .edit {
    background: none; border: 1px solid var(--line); color: var(--text);
    border-radius: 6px; padding: 0.35rem 0.9rem; font: inherit; cursor: pointer; flex: none;
  }
  .edit[aria-pressed='true'] { border-color: var(--accent); color: var(--accent); }
  .row { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem; }
  .undo { background: none; border: 1px solid var(--line); color: var(--dim); border-radius: 6px; padding: 0.4rem 0.8rem; font: inherit; font-size: 0.85rem; cursor: pointer; }
  .trackers { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: 0.6rem; margin-bottom: 1.25rem; }
  .prof-row { display: flex; align-items: baseline; gap: 0.6rem; margin: 1rem 0; }
  .cap { font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  h2 { font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); margin: 1.5rem 0 0.6rem; }
  .feature { border-top: 1px solid var(--line); padding: 0.6rem 0; }
  .feature h3 { margin: 0 0 0.2rem; font-size: 0.95rem; display: flex; gap: 0.3rem; align-items: center; }
  .feature p { margin: 0; font-size: 0.9rem; color: var(--dim); overflow-wrap: anywhere; }
  .empty { color: var(--dim); font-size: 0.9rem; }
  .hint { color: var(--dim); font-size: 0.78rem; margin: 0.5rem 0 0; line-height: 1.5; }
  .hint code { background: var(--surface); border-radius: 3px; padding: 0.05rem 0.25rem; font-size: 0.95em; }
  .hitdice { display: flex; align-items: baseline; gap: 0.6rem; margin: 1.25rem 0 0; }
  .notes :global(textarea), .notes :global(.readout) { width: 100%; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
