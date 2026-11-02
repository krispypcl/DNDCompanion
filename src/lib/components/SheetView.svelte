<script lang="ts">
  /**
   * A whole character sheet. Two addresses open it: /s/<id>, the one the app
   * links to itself, and /s?id=<id>, the one the Share button copies. The
   * second is a real page on the host, so a link pasted into Discord or
   * Messenger is answered with a preview card rather than "not found".
   */
  import { base } from '$app/paths';
  import AbilityBand from '$lib/components/AbilityBand.svelte';
  import ModeToggle from '$lib/components/ModeToggle.svelte';
  import Banner from '$lib/components/Banner.svelte';
  import CombatActions from '$lib/components/CombatActions.svelte';
  import Conditions from '$lib/components/Conditions.svelte';
  import Currency from '$lib/components/Currency.svelte';
  import DetailsBlock from '$lib/components/DetailsBlock.svelte';
  import DiceRoller from '$lib/components/DiceRoller.svelte';
  import EditableField from '$lib/components/EditableField.svelte';
  import EntryLink from '$lib/components/EntryLink.svelte';
  import HitPoints from '$lib/components/HitPoints.svelte';
  import HurtEdges from '$lib/components/HurtEdges.svelte';
  import RestButtons from '$lib/components/RestButtons.svelte';
  import SaveIndicator from '$lib/components/SaveIndicator.svelte';
  import SaveAlert from '$lib/components/SaveAlert.svelte';
  import SkillRail from '$lib/components/SkillRail.svelte';
  import EntryTable from '$lib/components/EntryTable.svelte';
  import DownloadButton from '$lib/components/DownloadButton.svelte';
  import LeaveDialog from '$lib/components/LeaveDialog.svelte';
  import NotFound from '$lib/components/NotFound.svelte';
  import SheetSkeleton from '$lib/components/SheetSkeleton.svelte';
  import { beforeNavigate, goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Flash from '$lib/components/Flash.svelte';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import TrackerGroup from '$lib/components/TrackerGroup.svelte';
  import TextPanel from '$lib/components/TextPanel.svelte';
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
  import { downloadText } from '$lib/download';
  import { parseRoll } from '$lib/rules/dice';
  import { requestRoll } from '$lib/stores/dice';
  import { friendlyDate, latest } from '$lib/rules/dates';
  import { exportFileName, exportSheet } from '$lib/exchange';
  import { resolveImageUrl } from '$lib/rules/imageUrl';
  import { spellGroup, spellRank } from '$lib/rules/spells';
  import { themeStyle } from '$lib/theme';
  import { bump, glow, sparkle } from '$lib/motion';
  import { session } from '$lib/stores/session';
  import { sheetStore } from '$lib/stores/sheet';
  import { canUndo, lastLabel, resetUndo, snapshot, undo } from '$lib/stores/undo';
  import { ABILITIES } from '$lib/types';
  import type { TextKey } from '$lib/types';
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

  let { id }: { id: string } = $props();

  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let activeTab = $state(TABS[0]);
  let editing = $state(false);
  let refilling = $state(false);
  let toast = $state<string | null>(null);
  /** A passing word at the foot of the screen, e.g. that the link was copied. */
  let flash = $state<string | null>(null);
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  function say(message: string) {
    flash = message;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (flash = null), 1800);
  }

  const sheet = $derived($sheetStore.sheet as Sheet | null);
  const definition = $derived(sheet?.definition as Definition | undefined);
  const sheetState = $derived(sheet?.state as State | undefined);
  const isOwner = $derived(Boolean($session.user && sheet && $session.user.id === sheet.owner_id));
  const editable = $derived(isOwner && editing);
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  const carried = $derived(definition ? weightCarried(definition) : 0);
  const classes = $derived(definition ? classList(definition) : []);
  /** Optional: with no banner the sheet renders exactly as it did before. */
  const banner = $derived(resolveImageUrl(definition?.identity?.bannerUrl).url);
  const portraitSrc = $derived(resolveImageUrl(definition?.identity?.portraitUrl).url);
  /** The writing lives in its own rows, so its edits count towards "updated" too. */
  const updated = $derived(
    latest(sheet?.updated_at, sheet?.texts?.notes.updatedAt, sheet?.texts?.backstory.updatedAt)
  );
  const totalLevel = $derived(definition ? characterLevel(definition) : 1);

  const CLASS_COLUMNS = [
    { key: 'name', label: 'Class', width: '38%', placeholder: 'Class' },
    { key: 'subclass', label: 'Subclass', width: '30%', placeholder: 'Subclass' },
    { key: 'level', label: 'Level', width: '14%', type: 'number' as const, numeric: true, placeholder: '1' },
    { key: 'source', label: 'Source', width: '18%', muted: true, placeholder: 'xphb' }
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
      level: Number(r.level) || 0,
      ...(r.source ? { source: String(r.source) } : {})
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
    { key: 'name', label: 'Name', width: '24%', placeholder: 'Longsword' },
    { key: 'bonus', label: 'Hit', width: '9%', numeric: true, placeholder: '+5',
      canPress: (v: unknown) => parseRoll(v, 'hit') !== null, pressVerb: 'Roll' },
    { key: 'damage', label: 'Damage', width: '14%', numeric: true, placeholder: '1d8 + 3',
      canPress: (v: unknown) => parseRoll(v, 'damage') !== null, pressVerb: 'Roll' },
    { key: 'damageType', label: 'Type', width: '12%', placeholder: 'slashing' },
    { key: 'notes', label: 'Notes', width: '41%', muted: true, wide: true, placeholder: 'Versatile (1d10)' }
  ];
  /** Blank first: a new row has no level yet, and defaulting it to Cantrip
      would put a level on a spell nobody has written one for. */
  const SPELL_LEVELS = ['', 'Cantrip', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
  const SPELL_COLUMNS = [
    { key: 'name', label: 'Name', width: '15%', placeholder: 'Shield' },
    { key: 'level', label: 'Level', width: '11%', options: SPELL_LEVELS },
    { key: 'time', label: 'Cast time', width: '10%', placeholder: '1 reaction' },
    { key: 'range', label: 'Range', width: '8%', placeholder: 'Self' },
    { key: 'components', label: 'Components', short: 'Comp', width: '8%', placeholder: 'V, S, M' },
    { key: 'duration', label: 'Duration', width: '11%', placeholder: '1 round' },
    { key: 'save', label: 'Save', width: '8%', placeholder: 'DEX 13' },
    { key: 'notes', label: 'Notes', width: '20%', muted: true, wide: true, placeholder: '+5 AC' },
    { key: 'source', label: 'Source', width: '9%', muted: true, placeholder: 'xphb' }
  ];


  const ITEM_COLUMNS = [
    { key: 'name', label: 'Item', width: '38%', placeholder: 'Longsword' },
    { key: 'qty', label: 'Amount', width: '12%', type: 'number' as const, numeric: true, placeholder: '1' },
    { key: 'weight', label: 'Weight', width: '12%', type: 'number' as const, numeric: true, placeholder: '3' },
    { key: 'value', label: 'Value', width: '22%', numeric: true, placeholder: '15 gp' },
    { key: 'source', label: 'Source', width: '16%', muted: true, placeholder: 'xphb' }
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
    { key: 'body', label: 'Description', width: '58%', wide: true, placeholder: 'Regain 1d10 + level hit points' },
    { key: 'source', label: 'Source', width: '16%', muted: true, placeholder: 'phb' }
  ];
  const initiative = $derived(
    definition ? (definition.combat?.initiative ?? modifierOf(definition, 'dex')) : 0
  );

  $effect(() => {
    if (!id) {
      loading = false;
      loadError = 'notfound';
      return;
    }
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

  // ── Leaving with changes not yet saved ────────────────────────────────────
  // Closing the tab: the browser's own "leave site?" prompt, and a last try to
  // save. Moving within the app: wait for the save, and only if it cannot be
  // made, ask.
  let leaving: string | null = $state(null);
  let letGo = false;

  onMount(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!sheetStore.hasUnsaved()) return;
      sheetStore.retry();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  });

  beforeNavigate((nav) => {
    if (letGo || nav.type === 'leave' || !nav.to || !sheetStore.hasUnsaved()) return;
    // A tab switch only changes the hash; that is not leaving.
    if (nav.to.url.pathname === location.pathname && nav.to.url.search === location.search) return;
    nav.cancel();
    const target = nav.to.url.href;
    say('Saving your changes…');
    sheetStore.retry().then(() => {
      if (!sheetStore.hasUnsaved()) {
        letGo = true;
        goto(target);
      } else {
        leaving = target;
      }
    });
  });

  /** An attack's hit or damage, tapped: rolled in the dice tray. */
  function rollAttack(key: string, attack: Attack) {
    const kind = key === 'bonus' ? 'hit' : 'damage';
    const pool = parseRoll(key === 'bonus' ? attack.bonus : attack.damage, kind);
    if (pool) requestRoll(pool, `${attack.name || 'Attack'} ${kind === 'hit' ? 'to hit' : 'damage'}`);
  }

  /** A skill, pressed: the Combat tab comes up, and the roll is made there. */
  function rollSkill(label: string, bonus: number) {
    if (activeTab !== 'Combat') {
      activeTab = 'Combat';
      if (typeof location !== 'undefined') history.replaceState(null, '', '#combat');
    }
    requestRoll({ dice: { 20: 1 }, modifier: bonus, mode: 'normal' }, label);
  }

  /** Keeps the public note of which writings are private in step. */
  function markPrivate(key: TextKey, on: boolean) {
    if (!definition) return;
    const flags = { ...(definition.privateText ?? {}) };
    if (on) flags[key] = true;
    else delete flags[key];
    const next: Definition = { ...definition, privateText: flags };
    if (Object.keys(flags).length === 0) delete next.privateText;
    setDefinition(next);
  }

  // A writing made private before visitors could be told so has no note on
  // the public row yet. The owner's own visit writes it.
  $effect(() => {
    if (!isOwner || !sheet?.texts || !definition) return;
    for (const key of ['notes', 'backstory'] as TextKey[]) {
      const wanted = !sheet.texts[key].isPublic;
      if (Boolean(definition.privateText?.[key]) !== wanted) {
        markPrivate(key, wanted);
        return;
      }
    }
  });
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

  /** A copy of the character as it is on screen right now, as a text file. */
  function exportNow() {
    if (!definition || !sheetState) return;
    downloadText(
      exportFileName(definition),
      exportSheet({ definition, state: sheetState, texts: sheet?.texts ?? null })
    );
    say('Downloaded');
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

{#snippet writing(key: TextKey, label: string)}
  {#if definition}
    <TextPanel
      {label}
      value={sheet?.texts ? sheet.texts[key].body : (definition[key] ?? '')}
      {editable}
      owner={isOwner}
      isPublic={sheet?.texts ? sheet.texts[key].isPublic : null}
      locked={!isOwner && Boolean(definition.privateText?.[key])}
      onbody={(body) => sheetStore.setText(key, { body })}
      onpublic={(isPublic) => {
        sheetStore.setText(key, { isPublic });
        markPrivate(key, !isPublic);
      }}
    />
  {/if}
{/snippet}

<svelte:head>
  <!-- The definition is the character's name as typed; the row's name is a
       projection of it, so prefer the definition and fall back. -->
  <title>{definition?.identity?.name?.trim() || sheet?.name || 'Character sheet'}</title>
</svelte:head>

{#if loading}
  <SheetSkeleton />
{:else if loadError === 'notfound'}
  <NotFound title="No sheet here" message="This sheet does not exist, or it has been deleted. Check the link with whoever sent it." />
{:else if loadError}
  <div class="centred"><h1>Could not load</h1><p>{loadError}</p></div>
{:else if sheet && definition && sheetState}
  <!-- The theme is scoped here, not to :root, so a campaign view can later show
       several characters in their own colours at once. -->
  <div class="sheet themed" class:bannered={banner} style={themeStyle(definition.identity.theme)}>
    {#if banner}<Banner url={banner} />{/if}
    <header class="identity">
      <div class="portrait" class:has={Boolean(portraitSrc)}>
        {#if portraitSrc}
          <!-- A link that stops working (a Drive file that was unshared) leaves
               the frame as it is for a sheet with no art, not a broken-image icon. -->
          <img src={portraitSrc} alt="" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
        {/if}
        <span class="lvl" use:glow={totalLevel}>LV {totalLevel}</span>
      </div>

      <div class="who">
        <h1>
          <EditableField value={definition.identity.name} {editable} label="Name"
                         placeholder="Character Name"
                         onchange={(v) => patchIdentity('name', v)} />
        </h1>
        <p class="sub">
          <!-- Class, species and background are all written on the Character
               tab; here they are only read, each with its 5e.tools link. -->
          <!-- Each part of the line has its own 5e.tools link beside it. The
               class link opens the subclass when one is written, which on
               5e.tools is the class page with that subclass chosen. -->
          {#if classLine(definition)}
            <span class="ident">
              <span class="classline">{classLine(definition)}</span>
              {#if classes[0]?.subclass?.trim()}
                <EntryLink name={classes[0].subclass} source={classes[0].source}
                           parent={{ name: classes[0].name, source: classes[0].source }}
                           category="subclasses" override={definition.identity.lookupUrl} />
              {:else}
                <EntryLink name={classes[0]?.name ?? definition.identity.class ?? ''}
                           source={classes[0]?.source}
                           category="classes" override={definition.identity.lookupUrl} />
              {/if}
            </span>
          {/if}
          <span class="ident">
            {#if definition.identity.ancestry?.trim()}<span class="detail">{definition.identity.ancestry}</span>{/if}
            <EntryLink name={definition.identity.ancestry ?? ''} source={definition.identity.ancestrySource} category="races" />
          </span>
          <span class="ident">
            {#if definition.identity.background?.trim()}<span class="detail">{definition.identity.background}</span>{/if}
            <EntryLink name={definition.identity.background ?? ''} source={definition.identity.backgroundSource} category="backgrounds" />
          </span>
        </p>
      </div>

      <!-- One group, so they wrap together: loose in the header the status
           dot was left stranded at the end of the name's line on a phone. -->
      <div class="controls">
        <!-- Only the owner has anything to undo, so a visitor is not shown a
             control that can never do anything. For the owner it is always
             here, so the row is laid out once: muted and inert until there
             is something to undo, and lit when there is. -->
        {#if isOwner}
          <button
            class="undo"
            disabled={!$canUndo}
            title={$canUndo ? `Undo ${$lastLabel}` : 'Nothing to undo'}
            onclick={doUndo}>Undo</button
          >
        {/if}
        {#if isOwner}
          <button class="edit" aria-pressed={editing} onclick={() => (editing = !editing)}>
            {#key editing}<span class="edlabel">{editing ? 'Done' : 'Edit'}</span>{/key}
          </button>
        {/if}
        <!-- For a visitor, when the sheet was made and last touched. The owner
             sees the same on the sheet list instead. -->
        {#if !isOwner}
          <dl class="stamps">
            <div><dt>Created</dt><dd>{friendlyDate(sheet.created_at)}</dd></div>
            <div><dt>Last updated</dt><dd>{friendlyDate(updated)}</dd></div>
          </dl>
        {/if}
        <a class="back" href="{base}/">Back</a>
        <ShareButton id={sheet.id} oncopied={(ok) => say(ok ? 'Link copied' : 'Could not copy the link')} />
        {#if isOwner}<DownloadButton ondownload={exportNow} />{/if}
        <ModeToggle />
      </div>
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
        <SkillRail {definition} {editable} onchange={setDefinition}
                   onroll={isOwner ? rollSkill : undefined} />
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
                links={false}
                onpress={isOwner ? rollAttack : undefined}
                emptyText="No attacks yet."
                addLabel="Add attack"
                blank={() => ({ name: '' }) as Attack}
                onchange={(attacks) => setDefinition({ ...definition, attacks: attacks as Attack[] })}
              />
              {#if isOwner}<DiceRoller />{/if}
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
                check={{ key: 'prepared', label: 'Prepared', short: 'Prep' }}
                groupBy={{ key: 'level', rank: (spell) => spellRank(spell.level), title: (spell) => spellGroup(spell.level) }}
                {editable}
                category="spells"
                emptyText="No spells or abilities recorded."
                addLabel="Add spell"
                blank={() => ({ name: '' }) as Spell}
                onchange={(spells) => setDefinition({ ...definition, spells: spells as Spell[] })}
              >
                {#snippet info()}
                  Anything you can cast or activate goes here, spell or not — an item&rsquo;s
                  charges belong here as much as a cantrip does. Source is the book it is from, as
                  5e.tools writes it — <code>xphb</code>, <code>phb</code>, <code>tce</code> — and
                  sets where the name links to. <code>homebrew</code> marks an entry as yours and
                  drops the link.
                {/snippet}
              </EntryTable>
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
              >
                {#snippet info()}
                  Weight is per item, so an amount of two counts twice in the total. Leave it blank
                  for anything whose weight does not matter. Value is written as you like — a price,
                  a range, &ldquo;priceless&rdquo; — and is never added up. Source is the book code
                  (<code>xphb</code>, <code>dmg</code>) for the 5e.tools link; <code>homebrew</code>
                  marks an item as yours.
                {/snippet}
              </EntryTable>
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
              >
                {#snippet info()}
                  Class features, feats and anything an item grants. Source <code>homebrew</code>
                  marks an entry as yours and drops the 5e.tools link.
                {/snippet}
              </EntryTable>
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
              >
                {#snippet info()}
                  Max accepts a number or a formula over <code>level</code>,
                  <code>classlevel</code>, <code>prof</code> and ability modifiers —
                  <code>prof + 1</code>, <code>classlevel / 2</code>. Name the class on a
                  feature that scales with it, or multiclassing will inflate it.
                {/snippet}
              </EntryTable>
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
              >
                {#snippet info()}
                  A multiclass character has a row per class. Character level is the sum, and a
                  tracker that uses <code>classlevel</code> follows the class you name on it
                  rather than the total. Source is the book code for the 5e.tools link.
                {/snippet}
              </EntryTable>
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
              {@render writing('notes', 'Notes')}
            {:else}
              {@render writing('backstory', 'Backstory')}
            {/if}
          {/snippet}
        </Tabs>
      </section>

      <section class="panel rail-right">
        <h2 class="cap">Defenses</h2>
        <div class="defense">
          <div class="defbox">
            <b use:bump={definition.combat?.ac}>
              <EditableField value={definition.combat?.ac} {editable} type="number"
                             label="AC" onchange={(v) => patchCombat('ac', Number(v))} />
            </b>
            <span class="cap">Armor Class</span>
          </div>
          <div class="defbox">
            <b use:bump={initiative}>
              <EditableField value={definition.combat?.initiative ?? ''}
                             display={definition.combat?.initiative == null ? sign(initiative) : undefined}
                             {editable} type="number" label="Initiative"
                             placeholder={sign(initiative)} hint={String(modifierOf(definition, 'dex'))}
                             onchange={(v) => patchCombat('initiative', v === '' ? undefined : Number(v))} />
            </b>
            <span class="cap">Initiative</span>
          </div>
          <div class="defbox">
            <b use:bump={definition.proficiency}>
              <EditableField value={definition.proficiency} display={sign(definition.proficiency)}
                             {editable} type="number" label="Proficiency bonus"
                             onchange={(v) => setDefinition({ ...definition, proficiency: Number(v) })} />
            </b>
            <span class="cap">Proficiency</span>
          </div>
          <div class="defbox">
            <b use:bump={definition.combat?.speed}>
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
            <b use:bump={definition.abilitySaveDc}>
              <EditableField value={definition.abilitySaveDc ?? ''} {editable} type="number"
                             label="Ability save DC" placeholder="13"
                             onchange={(v) => setDefinition({ ...definition, abilitySaveDc: v === '' ? undefined : Number(v) })} />
            </b>
            <span class="cap">Save DC</span>
          </div>
          <div class="defbox themed-num">
            <b use:sparkle={sheetState.inspiration ?? 0}>
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
                <b use:bump={passiveScore(definition, skill)}>{passiveScore(definition, skill)}</b>
                <span class="cap">{skill[0].toUpperCase() + skill.slice(1)}</span>
              </div>
            {/each}
          </div>
        </div>

        <Conditions state={sheetState} editable={isOwner} onchange={setState} />

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

        <div class="profs" style:--rows={4}>
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

        <div class="profs" style:--rows={2}>
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

        <div class="profs" style:--rows={3}>
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

  <Flash message={flash} />
  {#if leaving}
    <LeaveDialog onstay={() => (leaving = null)}
                 onleave={() => { const t = leaving; leaving = null; letGo = true; if (t) goto(t); }} />
  {/if}
  <HurtEdges current={sheetState.hpCurrent} max={definition.combat?.hpMax ?? 0} />
  <UndoToast label={toast} onundo={doUndo} onexpire={() => (toast = null)} />
  <SaveAlert />
  <!-- Floating, so saying a word costs the header nothing. -->
  <SaveIndicator />
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
  /* Not positioned: the banner inside it is meant to escape this column and
     run the width of the page. */
  .sheet { padding: 1.5rem; max-width: 110rem; margin: 0 auto; }
  .panel {
    background: var(--surface); border: 1px solid var(--line-soft);
    border-radius: var(--r); padding: 1rem; min-width: 0;
  }
  /* With a banner behind it, a module stops being opaque and starts being
     frosted: the band's colour carries through, the detail does not, and the
     text keeps the surface it needs. Only with a banner — an ordinary sheet
     pays none of this. */
  .bannered .panel {
    position: relative;
    z-index: 1;
    background: color-mix(in oklch, var(--surface) 76%, transparent);
    backdrop-filter: blur(16px) saturate(1.1);
    -webkit-backdrop-filter: blur(16px) saturate(1.1);
    border-color: color-mix(in oklch, var(--line) 70%, transparent);
  }
  /* Every section sits above the hurt edges (z-index 0), so the red only
     ever colours the background between and around them. */
  .identity, .band, .main { position: relative; z-index: 1; }
  /**
   * The class line is secondary text, and secondary text is a mid grey. Over
   * a photograph that is unreadable at any tint which still shows the
   * photograph: dim grey needs a backdrop darker than the banner can be and
   * still be seen. So on a sheet with a banner it is not secondary any more.
   * Measured over a deliberately bright test image rather than guessed.
   */
  .bannered .sub { color: var(--text); }
  .bannered .sub :global(.field.readout.empty) { color: var(--label); }
  /* No backdrop-filter, no frost: the module stays readable by being solid. */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .bannered .panel { background: var(--surface); }
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
  .controls { display: flex; align-items: center; gap: 0.5rem; flex: none; }
  .who h1 { margin: 0; font-size: 1.75rem; font-weight: 600; letter-spacing: -0.015em; }
  .sub :global(input.field) { min-width: 5.5rem; }
  .sub {
    /* The name sits inside an editable field, whose padding and border push
       its first letter in. This puts the class line under that letter rather
       than under the field's edge. */
    padding-left: calc(0.3rem + 1px);
    margin: 0.3125rem 0 0; color: var(--dim); font-size: 0.875rem;
    display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: baseline;
  }
  .classline, .detail { color: var(--text); }
  /* A detail and its link travel together, and the link shows on hovering
     that detail rather than the whole line. */
  .ident { display: inline-flex; align-items: center; gap: 0.125rem; }
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
  .edit:hover { border-color: var(--a-edge); color: var(--a); }
  /* Edit and Done cross over rather than swap. */
  .edlabel { display: inline-block; animation: edIn 0.25s cubic-bezier(0.2, 0.8, 0.3, 1); }
  @keyframes edIn { from { opacity: 0; transform: translateY(4px); } }
  .edit[aria-pressed='true'] { border-color: var(--a-edge); color: var(--a); background: var(--a-wash); }
  .edit[aria-pressed='true']:hover { border-color: var(--a); background: var(--a-edge); color: var(--text); }
  .edit, .undo, .back { transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.08s ease; }
  .edit:active, .undo:active, .back:active { transform: translateY(1px); }
  /* A surface of its own: it sits over the banner, where an outline with
     nothing behind it was hard to pick out. Muted while there is nothing to
     undo — which is the state it spends most of its life in. */
  .undo {
    background: var(--a-wash); border: 1px solid var(--a-edge); color: var(--a);
    border-radius: var(--r-sm); padding: 0.375rem 0.75rem; font: inherit;
    font-size: 0.8125rem; cursor: pointer; flex: none;
    transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
  }
  .undo:hover:not(:disabled) { border-color: var(--a); background: var(--a-edge); color: var(--text); }
  .undo:disabled {
    background: none; border-color: var(--line-soft); color: var(--faint);
    cursor: default;
  }
  .back {
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); padding: 0.375rem 0.875rem; font-size: 0.8125rem;
    text-decoration: none; flex: none; line-height: 1.5;
  }
  .back:hover { border-color: var(--a-edge); color: var(--a); }
  .stamps { display: flex; gap: 1rem; margin: 0 0.5rem 0 0; }
  .stamps div { text-align: right; }
  .stamps dt {
    font-size: 0.5875rem; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--label); font-weight: 600;
  }
  .stamps dd { margin: 0.0625rem 0 0; font-size: 0.8125rem; color: var(--text); white-space: nowrap; }

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
  /* Read-only, an empty block is one line; editing, it is the box's rows. Give
     the readout the same floor, so opening the editor does not push the rest
     of the rail down. */
  .profs :global(.readout) {
    min-height: calc(var(--rows) * 1.5em + var(--fld-pad-y, 0.15rem) * 2 + 2px);
  }
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
