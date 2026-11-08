<script lang="ts">
  /**
   * A whole character sheet. Two addresses open it: /s/<id>, the one the app
   * links to itself, and /s?id=<id>, the one the Share button copies. The
   * second is a real page on the host, so a link pasted into Discord or
   * Messenger is answered with a preview card rather than "not found".
   */
  import { signed as sign } from '$lib/actions';
  import { base } from '$app/paths';
  import AbilityBand from '$lib/components/AbilityBand.svelte';
  import ModeToggle from '$lib/components/ModeToggle.svelte';
  import SoundToggle from '$lib/components/SoundToggle.svelte';
  import { setCustomSounds, setSound, soundOn } from '$lib/sound';
  import { get } from 'svelte/store';
  import MusicPlayer from '$lib/components/MusicPlayer.svelte';
  import Banner from '$lib/components/Banner.svelte';
  import CombatActions from '$lib/components/CombatActions.svelte';
  import CombatFeatures from '$lib/components/CombatFeatures.svelte';
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
  import D20Loader from '$lib/components/D20Loader.svelte';
  import PrintButton from '$lib/components/PrintButton.svelte';
  import PrintSheet from '$lib/components/PrintSheet.svelte';
  import { beforeNavigate, goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Flash from '$lib/components/Flash.svelte';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import TrackerGroup from '$lib/components/TrackerGroup.svelte';
  import TrackerPresets from '$lib/components/TrackerPresets.svelte';
  import { resetTray } from '$lib/stores/tray';
  import TextPanel from '$lib/components/TextPanel.svelte';
  import LinksPanel from '$lib/components/LinksPanel.svelte';
  import UndoToast from '$lib/components/UndoToast.svelte';
  import { sheetRepo } from '$lib/data/sheets';
  import { isConfigured, supabase } from '$lib/supabase';
  import {
    ATTACK_COLUMNS, ATTUNE_SLOTS, CLASS_COLUMNS, FEATURE_COLUMNS, FEATURE_KINDS, ITEM_COLUMNS,
    PASSIVES, SPELL_COLUMNS, TABS, TRACKER_COLUMNS, kindOf
  } from '$lib/sheet/columns';
  import {
    blankTracker, newId, trackerRows, withClasses, withTrackerRows, withoutTrackers, type TrackerRow
  } from '$lib/sheet/edits';
  import { slotsByLevel, spellAttack, spellDc } from '$lib/rules/casting';
  import { featureUrl } from '$lib/rules/lookup';
  import { brewLoaded, ensureBrewClasses } from '$lib/rules/brewClasses';
  import {
    characterLevel,
    classLine,
    classList,
    formulaContext,
    modifierOf,
    armorClass,
    initiativeParts,
    passiveScore,
    proficiencyBonus,
    speedParts,
    weightCarried
  } from '$lib/rules/derived';
  import Why from '$lib/components/Why.svelte';
  import EquipDialog from '$lib/components/EquipDialog.svelte';
  import { downloadText } from '$lib/download';
  import { parseRoll, type Pool, type Roll } from '$lib/rules/dice';
  import { requestRoll } from '$lib/stores/dice';
  import { friendlyDate, latest } from '$lib/rules/dates';
  import { exportFileName, exportSheet } from '$lib/exchange';
  import { resolveImageUrl } from '$lib/rules/imageUrl';
  import { ordinal, spellGroup, spellLevel, spellRank } from '$lib/rules/spells';
  import { spellDamage } from '$lib/rules/spellroll';
  import CastPicker from '$lib/components/CastPicker.svelte';
  import CampaignDialog from '$lib/components/CampaignDialog.svelte';
  import { campaignRepo, type Campaign } from '$lib/data/campaigns';
  import { slotLevel } from '$lib/rules/print';
  import { themeStyle } from '$lib/theme';
  import { bump, glow, sparkle } from '$lib/motion';
  import { glide } from '$lib/flip';
  import { isDead } from '$lib/rules/hp';
  import ConditionOverlay from '$lib/components/ConditionOverlay.svelte';
  import DownScreen from '$lib/components/DownScreen.svelte';
  import ShortcutHelp from '$lib/components/ShortcutHelp.svelte';
  import { friendlyError } from '$lib/errors';
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
    Sheet,
    Spell,
    State,
    Tracker
  } from '$lib/types';


  let { id }: { id: string } = $props();

  let loading = $state(true);
  /** The die has landed and been read: only then does the sheet show. */
  let revealed = $state(false);
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

  const carried = $derived(definition ? weightCarried(definition) : 0);
  const classes = $derived(definition ? classList(definition) : []);
  // A homebrew class's features are fetched for its links (rules/brewClasses.ts).
  $effect(() => void ensureBrewClasses(classes));
  /** What tracker formulas read: level, class levels, proficiency, modifiers. */
  const ctx = $derived(definition ? formulaContext(definition) : null);
  /** Optional: with no banner the sheet renders exactly as it did before. */
  const banner = $derived(resolveImageUrl(definition?.identity?.bannerUrl).url);
  const portraitSrc = $derived(resolveImageUrl(definition?.identity?.portraitUrl).url);
  /** The writing lives in its own rows, so its edits count towards "updated" too. */
  const updated = $derived(
    latest(sheet?.updated_at, sheet?.texts?.notes.updatedAt, sheet?.texts?.backstory.updatedAt)
  );
  const totalLevel = $derived(definition ? characterLevel(definition) : 1);
  const dead = $derived(sheetState ? isDead(sheetState) : false);
  /** Counts level-ups seen on this page; each one plays the burst once. */
  let levelUp = $state(0);
  let lastLevel = 0;
  $effect(() => {
    const now = totalLevel;
    if (!definition) return;
    if (lastLevel && now > lastLevel) levelUp += 1;
    lastLevel = now;
  });
  /** The sheet's panels arrive one after another when it first appears. */
  // On from the start, so the sheet's very first frame is already the start
  // of the animation; switched on only once it showed, the panels appeared,
  // vanished and faded in again.
  let entering = $state(true);
  $effect(() => {
    if (!revealed) {
      entering = true;
      return;
    }
    const t = setTimeout(() => (entering = false), 1200);
    return () => clearTimeout(t);
  });
  /** The writing this reader may see: what the printed sheet is given. */
  function readable(key: TextKey): string {
    if (!definition) return '';
    if (!isOwner && definition.privateText?.[key]) return '';
    return sheet?.texts ? sheet.texts[key].body : (definition[key] ?? '');
  }


  function saveClasses(rows: ClassEntry[]) {
    if (definition) setDefinition(withClasses(definition, rows));
  }



  const attunedCount = $derived((definition?.equipment ?? []).filter((i) => i.attuned).length);
  const initiative = $derived(definition ? initiativeParts(definition).total : 0);
  const ac = $derived(definition ? armorClass(definition) : { total: 10, parts: [], computed: false });
  const speed = $derived(definition ? speedParts(definition) : { total: 30, parts: [] });

  $effect(() => {
    if (!id) {
      loading = false;
      loadError = 'notfound';
      return;
    }
    loading = true;
    revealed = false;
    loadError = null;
    resetUndo();
    resetTray();
    sheetRepo
      .loadSheet(id)
      .then((found) => {
        sheetStore.load(found);
        if (!found) loadError = 'notfound';
      })
      .catch((e) => (loadError = friendlyError(e, 'This sheet wouldn’t load! Give it another roll in a moment.')))
      .finally(() => (loading = false));
  });

  // The sheet's own sound effects, while it is on screen.
  $effect(() => {
    setCustomSounds(definition?.sounds);
    return () => setCustomSounds(undefined);
  });

  /*
   * Live: a change to this sheet made elsewhere (its DM giving a condition,
   * its owner on another device) arrives as it happens, for the owner and
   * for anyone reading along.
   */
  $effect(() => {
    if (!id || !isConfigured) return;
    const channel = supabase
      .channel(`sheet-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sheets', filter: `id=eq.${id}` }, (payload) => {
        const row = payload.new as Partial<Sheet>;
        if (row.definition && row.state && row.updated_at) {
          sheetStore.adoptRemote({ definition: row.definition, state: row.state, updated_at: row.updated_at });
        }
      })
      .subscribe();
    return () => void supabase.removeChannel(channel);
  });

  $effect(() => {
    if (typeof location === 'undefined') return;
    const hash = location.hash.slice(1).toLowerCase();
    // The Appearance tab was called Links.
    const wanted = TABS.find((t) => t.toLowerCase() === (hash === 'links' ? 'appearance' : hash));
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

  const spellAtk = $derived(spellAttack(definition));

  /** Shows a roll in the tray, which lives on the Combat tab. */
  function toTray(pool: Pool, label: string, then?: (r: Roll) => void, mode: 'keep' | 'normal' = 'keep') {
    if (activeTab !== 'Combat') {
      activeTab = 'Combat';
      if (typeof location !== 'undefined') history.replaceState(null, '', '#combat');
    }
    requestRoll(pool, label, then, mode);
  }

  /** Spell slots by level, for casting: how many each has and which trackers hold them. */
  const slots = $derived(slotsByLevel(definition, sheetState));

  /** A spell's Roll, pressed: the cast dialog opens (slot, attack, damage). */
  let casting = $state<Spell | null>(null);
  /** The campaign the sheet is in, read by its id; null when in none. */
  let campaign = $state<Campaign | null>(null);
  let campaignOpen = $state(false);
  const campaignId = $derived(sheet?.campaign_id ?? null);
  const campaignIsMine = $derived(Boolean(campaign && $session.user && campaign.created_by === $session.user.id));
  $effect(() => {
    const id = campaignId;
    if (!id) {
      campaign = null;
      return;
    }
    let gone = false;
    campaignRepo.get(id).then((c) => { if (!gone) campaign = c; }).catch(() => {});
    return () => { gone = true; };
  });
  /** Leaving a campaign or retiring: the sheet's own row, with its stamp kept current. */
  async function saveRow(patch: { campaign_id?: null; retired?: boolean }) {
    const current = $sheetStore.sheet;
    if (!current) return;
    const stamp = await sheetRepo.saveRow(current.id, patch, current.updated_at);
    sheetStore.adoptRow({ ...patch, updated_at: stamp });
  }
  /** A colour being dragged to in the theme picker, shown before it is kept. */
  let themePreview = $state<string | null>(null);
  function rollSpell(_key: string, spell: Spell) {
    casting = spell;
  }
  const saveDc = $derived(spellDc(definition));
  function castRoll(spell: Spell, kind: 'attack' | 'damage', at: number | null, spend: boolean) {
    const name = spell.name || 'Spell';
    const level = spellLevel(spell.level);
    if (spend && at !== null) {
      const slot = slots.get(at)?.trackers.find((t) => t.room > 0);
      if (slot && sheetState) setTracker(slot.id, (Number(sheetState.trackers?.[slot.id]) || 0) + 1);
    }
    const upcast = level !== null && at !== null && at > level ? ` at ${ordinal(at)} level` : '';
    if (kind === 'attack') {
      if (spellAtk !== null) toTray({ dice: { 20: 1 }, modifier: spellAtk, mode: 'normal' }, `${name} attack`);
      return;
    }
    const pool = spellDamage(spell.damage, level, at, totalLevel);
    if (pool) toTray(pool, level === 0 && totalLevel >= 5 ? `${name} (level ${totalLevel})` : `${name}${upcast}`);
  }

  /** A tracker with a die, spent, and the player said yes to rolling it. */
  function rollTracker(t: Tracker) {
    const pool = parseRoll(t.die, 'damage');
    if (pool) toTray(pool, t.label);
  }

  /** A feature picked on the Combat tab: the Features tab, at that feature. */
  let spotFeature = $state<number | null>(null);
  function showFeature(index: number) {
    activeTab = 'Features';
    if (typeof location !== 'undefined') history.replaceState(null, '', '#features');
    spotFeature = null;
    requestAnimationFrame(() => (spotFeature = index));
    // Once shown, forgotten: coming back to Features later does not jump again.
    clearTimeout(spotTimer);
    spotTimer = setTimeout(() => (spotFeature = null), 3000);
  }
  let spotTimer: ReturnType<typeof setTimeout> | undefined;

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

  /** A spell slot just spent: that spell level lights up, and the Spells tab. */
  let litLevel = $state<string | null>(null);
  let litTimer: ReturnType<typeof setTimeout> | undefined;
  function setTracker(id: string, value: number) {
    if (!sheetState) return;
    const t = definition?.trackers?.find((x) => x.id === id);
    const level = t ? slotLevel(t) : null;
    const before = Number(sheetState.trackers?.[id]) || 0;
    if (level !== null && t?.direction !== 'accrue' && value > before) {
      litLevel = null;
      requestAnimationFrame(() => (litLevel = spellGroup(String(level))));
      clearTimeout(litTimer);
      litTimer = setTimeout(() => (litLevel = null), 1600);
    }
    snapshot(sheetState, 'Tracker');
    setState({ ...sheetState, trackers: { ...sheetState.trackers, [id]: value } });
  }

  function afterRest(label: string) {
    toast = label;
    refilling = true;
    setTimeout(() => (refilling = false), 700);
  }

  /** Keyboard shortcuts, for a computer; none while typing in a field. */
  let showKeys = $state(false);
  function onkey(e: KeyboardEvent) {
    if (!definition || showKeys || leaving) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.querySelector('.lightbox, [role="dialog"]:not([data-keys]), [role="alertdialog"]')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
      if (isOwner && $canUndo) {
        e.preventDefault();
        doUndo();
      }
      return;
    }
    if (mod || e.altKey) return;
    if (e.key === '?') {
      e.preventDefault();
      showKeys = true;
    } else if (e.key.toLowerCase() === 'e' && isOwner) {
      e.preventDefault();
      void glide(() => (editing = !editing));
    } else if (e.key.toLowerCase() === 'm') {
      // The speaker: sound and music, on or off.
      e.preventDefault();
      setSound(!get(soundOn));
    } else if (e.key.toLowerCase() === 'p') {
      e.preventDefault();
      window.print();
    } else if (/^[1-9]$/.test(e.key)) {
      activeTab = TABS[Number(e.key) - 1];
    }
  }

  /**
   * The Equip tag. Reading, it puts on or takes off an item whose effects are
   * known; the first time, or while editing, it asks what the item does.
   */
  let equipping = $state<number | null>(null);
  function setItem(index: number, patch: Partial<Item>) {
    if (!definition) return;
    setDefinition({ ...definition, equipment: definition.equipment.map((it, i) => (i === index ? { ...it, ...patch } : it)) });
  }
  function equipItem(index: number) {
    const item = definition?.equipment?.[index];
    if (!item) return;
    if (!editable && item.equipped) return setItem(index, { equipped: false });
    if (!editable && item.effects) return setItem(index, { equipped: true });
    equipping = index;
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
  // Worked out again when a homebrew class's features arrive, for its links.
  const trackerRowsShown = $derived($brewLoaded >= 0 ? trackerRows(definition, classes) : []);

  function saveTrackers(rows: TrackerRow[]) {
    if (definition) setDefinition(withTrackerRows(definition, rows));
  }

  let presetsOpen = $state(false);
  // Switching modes either way folds the ready-made list: it is never
  // waiting open on returning to edit mode.
  $effect(() => {
    editing;
    presetsOpen = false;
  });
  function addPreset(added: Tracker[], label: string) {
    if (!definition) return;
    setDefinition({ ...definition, trackers: [...(definition.trackers ?? []), ...added] });
    say(`Added ${label}`);
  }
  function removePreset(ids: string[], label: string) {
    if (!definition || !sheetState) return;
    const next = withoutTrackers(definition, sheetState, ids);
    setDefinition(next.definition);
    setState(next.state);
    say(`Removed ${label}`);
  }

</script>

<svelte:window onkeydown={onkey} />

{#snippet flag()}
  <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
    <path d="M3 14V2.5M3 3h8.5l-1.8 2.8L11.5 8.5H3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" />
  </svg>
{/snippet}

{#snippet writing(key: TextKey, label: string)}
  {#if definition}
    <TextPanel
      {label}
      value={sheet?.texts ? sheet.texts[key].body : (definition[key] ?? '')}
      {editable}
      owner={isOwner}
      isPublic={sheet?.texts ? sheet.texts[key].isPublic : null}
      locked={!isOwner && Boolean(definition.privateText?.[key]) && !(sheet?.texts && sheet.texts[key].isPublic === false)}
      peek={!isOwner && Boolean(sheet?.texts && sheet.texts[key].isPublic === false)}
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

{#if loading || !revealed}
  <!-- The sheet's outline, dimmed, with the die rolling over it. -->
  <div class="loading">
    <SheetSkeleton />
    <div class="screen-center">
      <D20Loader result={loading ? null : loadError ? 1 : 20} label="Loading the sheet"
                 onlanded={() => (revealed = true)} />
    </div>
  </div>
{:else if loadError === 'notfound'}
  <NotFound title="No sheet here!" message="This sheet has vanished like a rogue in the night. It may have been deleted, or the link is off by a letter, so check it with whoever sent it." />
{:else if loadError}
  <NotFound title="That’s a critical fail!" message={loadError} />
{:else if sheet && definition && sheetState}
  <!-- The theme is scoped here, not to :root, so a campaign view can later show
       several characters in their own colours at once. -->
  <div class="sheet themed" class:entering class:bannered={banner} style={themeStyle(themePreview ?? definition.identity.theme)}>
    {#if banner}<Banner url={banner} />{/if}
    <header class="identity">
      <div class="portrait" class:has={Boolean(portraitSrc)} class:fallen={dead}>
        {#if portraitSrc}
          <!-- A link that stops working (a Drive file that was unshared) leaves
               the frame as it is for a sheet with no art, not a broken-image icon. -->
          <img src={portraitSrc} alt="" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
        {/if}
        <span class="lvl" use:glow={totalLevel}>LV {totalLevel}</span>
        {#key levelUp}
          {#if levelUp > 0}
            <!-- Levelled up: rays burst from the portrait and the news floats up. -->
            <span class="burst" aria-hidden="true">{#each Array(12) as _, i (i)}<i style:--r="{i * 30}deg"></i>{/each}</span>
            <span class="levelup" role="status">Level up!</span>
          {/if}
        {/key}
        {#if dead}
          <!-- Three failed death saves, or Dead written in: a skull on the portrait. -->
          <span class="skull" title="Dead" role="img" aria-label="Dead">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.5c-4.7 0-8 3.2-8 7.6 0 2.6 1.2 4.4 3 5.5v2.6c0 .9.7 1.6 1.6 1.6h.9v-2h1.6v2h1.8v-2h1.6v2h.9c.9 0 1.6-.7 1.6-1.6v-2.6c1.8-1.1 3-2.9 3-5.5 0-4.4-3.3-7.6-8-7.6Z"
                    fill="currentColor" />
              <circle cx="8.8" cy="10.6" r="2" fill="#140d0d" />
              <circle cx="15.2" cy="10.6" r="2" fill="#140d0d" />
              <path d="M12 13.2l-1.1 2h2.2Z" fill="#140d0d" />
            </svg>
          </span>
        {/if}
      </div>

      <div class="who">
        <!-- The campaign, small above the name, as a book's series sits above
             its title: a link to its page once the sheet is in one. While
             editing it opens the campaign dialog (join, start, leave, retire). -->
        {#if editable}
          <button class="campaign pick" data-flip="identity:campaign-at" onclick={() => (campaignOpen = true)}
                  title="Join, start or leave a campaign">
            {@render flag()}
            <span>{campaign?.name ?? definition.identity.campaign?.trim() ?? 'Add to a campaign'}</span>
          </button>
        {:else if campaign || definition.identity.campaign?.trim()}
          <div class="campaign" data-flip-ghost="identity:campaign" data-flip="identity:campaign-at">
            {@render flag()}
            {#if campaign}
              <a href="{base}/c/{campaign.id}" title="Open the campaign">{campaign.name}</a>
            {:else}
              <span title="Campaign">{definition.identity.campaign?.trim()}</span>
            {/if}
            {#if sheet.retired}<span class="retired">Retired</span>{/if}
          </div>
        {/if}
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

      {#if definition.identity.playlistUrl?.trim()}
        <!-- Top centre: the sheet's music. -->
        <div class="musicslot" data-flip="identity:music"><MusicPlayer url={definition.identity.playlistUrl} /></div>
      {/if}

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
          <button class="edit" aria-pressed={editing} onclick={() => glide(() => (editing = !editing))}>
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
        <ShareButton id={sheet.id} oncopied={(ok) => say(ok ? 'Link copied' : 'Couldn’t copy the link!')} />
        <PrintButton />
        {#if isOwner}<DownloadButton ondownload={exportNow} />{/if}
        <button class="keys" onclick={() => (showKeys = true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2.5" y="6" width="19" height="12" rx="2" />
              <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9" />
            </g>
          </svg>
        </button>
        <SoundToggle />
        <ModeToggle />
      </div>
    </header>

    <div class="band">
      <section class="panel hp" style:--i=0>
        <HitPoints {definition} state={sheetState} editable={isOwner} editDefinition={editable}
                   onchange={setState} ondefinition={setDefinition}>
          {#snippet children()}
            <RestButtons {definition} state={sheetState} editable={isOwner}
                         onchange={setState} onrest={afterRest}
                         onroll={(pool, label, then) => toTray(pool, label, then, 'normal')} />
          {/snippet}
        </HitPoints>
      </section>

      <section class="panel band-abilities" style:--i=1>
        <AbilityBand {definition} {editable} onchange={setDefinition}
                     onroll={isOwner ? rollSkill : undefined} />
      </section>
    </div>

    <div class="main">
      <section class="panel rail-skills" style:--i=2>
        <SkillRail {definition} {editable} onchange={setDefinition}
                   onroll={isOwner ? rollSkill : undefined} />
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
      </section>

      <section class="panel centre" style:--i=3>
        <Tabs tabs={TABS} bind:active={activeTab} lit={litLevel ? 'Spells' : null}>
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
              <!-- Below the table, so they move when it changes size: they glide too. -->
              {#if isOwner}<div class="flipbox" data-flip="dice"><DiceRoller /></div>{/if}
              <div class="flipbox" data-flip="combat-features">
                <CombatFeatures features={definition.features ?? []} onpick={showFeature} />
              </div>
              <div class="flipbox" data-flip="actions"><CombatActions /></div>
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
                lit={litLevel}
                columns={SPELL_COLUMNS}
                check={{ key: 'prepared', label: 'Prepared', short: 'Prep' }}
                groupBy={{ key: 'level', rank: (spell) => spellRank(spell.level), title: (spell) => spellGroup(spell.level) }}
                {editable}
                category="spells"
                emptyText="No spells or abilities recorded."
                addLabel="Add spell"
                blank={() => ({ name: '' }) as Spell}
                onpress={isOwner ? (key, spell) => rollSpell(key, spell as Spell) : undefined}
                onchange={(spells) => setDefinition({ ...definition, spells: spells as Spell[] })}
              >
                {#snippet info()}
                  Anything you can cast or activate goes here, spell or not — an item&rsquo;s
                  charges belong here as much as a cantrip does. Source is the book it is from, as
                  5e.tools writes it — <code>xphb</code>, <code>phb</code>, <code>tce</code> — and
                  sets where the name links to. <code>homebrew</code> marks an entry as yours and
                  drops the link. <b>Roll</b> is the damage or healing dice: press it to cast, pick the
                  slot, and roll the attack (for a spell with no Save) and the dice. For more dice
                  at higher slots, add what each level adds: <code>8d6 +1d6/level</code>. A
                  cantrip's dice grow with your level by themselves.
                {/snippet}
              </EntryTable>
            {:else if tab === 'Equipment'}
              <EntryTable
                items={definition.equipment ?? []}
                columns={ITEM_COLUMNS}
                check={{ key: 'attuned', label: 'Attuned', inline: true, limit: ATTUNE_SLOTS,
                         full: `All ${ATTUNE_SLOTS} attunement slots are in use!` }}
                groupBy={{ key: 'attuned', rank: (item) => (item.attuned ? 0 : 1),
                           title: (item) => (item.attuned ? `Attuned · ${attunedCount} of ${ATTUNE_SLOTS}` : 'Carried') }}
                {editable}
                category="items"
                emptyText="Nothing carried."
                addLabel="Add item"
                blank={() => ({ name: '', qty: 1 }) as Item}
                equip={{ key: 'equipped', can: isOwner, onpress: equipItem }}
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
                groupBy={{ key: 'kind', rank: (f) => FEATURE_KINDS.indexOf(kindOf(f as Feature)),
                           title: (f) => kindOf(f as Feature) }}
                {editable}
                category="feats"
                spot={spotFeature}
                linkOf={$brewLoaded >= 0 ? (f) => featureUrl(f as Feature, definition.identity, classes) : undefined}
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
                items={trackerRowsShown}
                columns={TRACKER_COLUMNS}
                {editable}
                category="any"
                emptyText="No trackers yet."
                addLabel="Add tracker"
                blank={blankTracker}
                onchange={(rows) => saveTrackers(rows as TrackerRow[])}
              >
                {#snippet extra()}
                  <button class="opener" aria-expanded={presetsOpen} onclick={() => (presetsOpen = !presetsOpen)}>
                    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                      <path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="currentColor" />
                    </svg>
                    Ready-made
                    <i class="chev" class:up={presetsOpen} aria-hidden="true">▾</i>
                  </button>
                {/snippet}
                {#snippet info()}
                  Max accepts a number or a formula over <code>level</code>,
                  <code>classlevel</code>, <code>prof</code> and ability modifiers —
                  <code>prof + 1</code>, <code>classlevel / 2</code>, <code>classlevel * 5</code>.
                  <code>at(1, 2, 3, 3)</code> is 2 from 1st level and 3 from 3rd;
                  <code>full(1)</code>, <code>half(1)</code>, <code>third(1)</code> and
                  <code>pact()</code> are spell slots. <b>From</b> is the class, feat or species
                  it comes from: a class makes <code>classlevel</code> that class's level (so
                  multiclassing doesn't inflate it) and links to the feature on 5e.tools; a feat
                  or species links to that.
                {/snippet}
              </EntryTable>
              {#if editable}
                <TrackerPresets {definition} makeId={newId} open={presetsOpen} onadd={addPreset} onremove={removePreset} />
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
              >
                {#snippet info()}
                  A multiclass character has a row per class. Character level is the sum, and a
                  tracker that uses <code>classlevel</code> follows the class you name on it
                  rather than the total. Source is the book code for the 5e.tools link.
                {/snippet}
              </EntryTable>
              <h3 class="sub-h details-h">Details</h3>
              <DetailsBlock {definition} {editable} onchange={setDefinition} />
            {:else if tab === 'Notes'}
              {@render writing('notes', 'Notes')}
            {:else if tab === 'Appearance'}
              <LinksPanel {definition} {editable} onchange={setDefinition} onthemepreview={(hex) => (themePreview = hex)} />
            {:else}
              {@render writing('backstory', 'Backstory')}
            {/if}
          {/snippet}
        </Tabs>
      </section>

      <section class="panel rail-right" style:--i=4>
        <Conditions state={sheetState} editable={isOwner} onchange={setState}
                    looks={definition.conditionLooks ?? {}}
                    onlooks={(conditionLooks) => setDefinition({ ...definition, conditionLooks })} />

        {#if (definition.trackers ?? []).length > 0}
          <div class="trk">
            <h2 class="cap">Trackers</h2>
            <TrackerGroup
              trackers={definition.trackers}
              spent={sheetState.trackers}
              ctx={ctx ?? formulaContext(definition)}
              editable={isOwner}
              {refilling}
              onchange={setTracker}
              onroll={isOwner ? rollTracker : undefined}
              {classes}
            />
          </div>
        {/if}

        <h2 class="cap defs-h">Defenses</h2>
        <div class="defense">
          <Why title="Armor Class" parts={ac.parts} total={String(ac.total)}
               hint={ac.computed ? 'Worked out from what is equipped.' : 'Nothing worn yet. Equip armour or a shield on the Equipment tab to change it.'}>
          <div class="defbox">
            <!-- Worked out, never typed: armour and shields are equipped on the Equipment tab. -->
            <b use:bump={ac.total}><span class="computed">{ac.total}</span></b>
            <span class="cap">Armor Class</span>
          </div>
          </Why>
          <Why title="Initiative" parts={initiativeParts(definition).parts} total={sign(initiative)}
               hint={!editable && isOwner ? 'Press it to roll initiative.' : ''}>
          <div class="defbox" class:rollable={!editable && isOwner}>
            <b use:bump={initiative}>
              {#if !editable && isOwner}
                <!-- Out of edit mode, initiative is a die to roll: the whole box is the button. -->
                <button class="rollnum" title="Roll initiative: d20 {sign(initiative)}" aria-label="Roll initiative"
                        onclick={() => rollSkill('Initiative', initiative)}>{sign(initiative)}</button>
                <svg class="d20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 20.5 7.4v9.2L12 21.5 3.5 16.6V7.4zM12 7.5l4.3 7.4H7.7zM12 2.5v5M20.5 7.4l-4.2 7.5M3.5 7.4l4.2 7.5M7.7 14.9 3.5 16.6M16.3 14.9l4.2 1.7M7.7 14.9 12 21.5l4.3-6.6" /></svg>
              {:else}
                <EditableField value={definition.combat?.initiative ?? ''}
                               display={definition.combat?.initiative == null ? sign(initiative) : undefined}
                               {editable} type="number" label="Initiative"
                               placeholder={sign(initiative)} hint={String(modifierOf(definition, 'dex'))}
                               onchange={(v) => patchCombat('initiative', v === '' ? undefined : Number(v))} />
              {/if}
            </b>
            <span class="cap">Initiative</span>
          </div>
          </Why>
          <!-- From total level, all classes together; not typed in. -->
          <Why title="Proficiency" parts={[{ label: `Total level ${characterLevel(definition)}`, value: proficiencyBonus(definition) }]}
               total={sign(proficiencyBonus(definition))} hint="+2 at levels 1–4, +1 more every 4 levels after; all classes together.">
          <div class="defbox">
            <b use:bump={proficiencyBonus(definition)}>{sign(proficiencyBonus(definition))}</b>
            <span class="cap">Proficiency</span>
          </div>
          </Why>
          <Why title="Speed" parts={speed.parts} total="{speed.total} ft.">
          <div class="defbox">
            <b use:bump={speed.total}>
              <EditableField value={definition.combat?.speed}
                             display={definition.combat?.speed != null
                               ? `${speed.total} ft.`
                               : undefined}
                             {editable} type="number"
                             label="Speed" onchange={(v) => patchCombat('speed', Number(v))} />
            </b>
            <span class="cap">Speed</span>
          </div>
          </Why>
          <div class="defbox">
            <b use:bump={definition.abilitySaveDc}>
              <EditableField value={definition.abilitySaveDc ?? ''} {editable} type="number"
                             label="Ability save DC" placeholder="13"
                             onchange={(v) => setDefinition({ ...definition, abilitySaveDc: v === '' ? undefined : Number(v) })} />
            </b>
            <span class="cap">Save DC</span>
          </div>
          <div class="defbox themed-num" class:inspired={(sheetState.inspiration ?? 0) > 0}>
            <b use:sparkle={sheetState.inspiration ?? 0}>
              <EditableField value={sheetState.inspiration ?? 0} {editable} type="number"
                             label="Inspiration"
                             onchange={(v) => setState({ ...sheetState, inspiration: Number(v) })} />
            </b>
            <span class="cap">Inspiration</span>
          </div>
        </div>

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

  <!-- Floating pieces sit outside the sheet's box but take its theme, so a
       toast's Undo is in the character's accent too. -->
  <div class="themed floats" style={themeStyle(themePreview ?? definition.identity.theme)}>
    {#if showKeys}<ShortcutHelp owner={isOwner} onclose={() => (showKeys = false)} />{/if}
    <Flash message={flash} />
    {#if leaving}
      <LeaveDialog onstay={() => (leaving = null)}
                   onleave={() => { const t = leaving; leaving = null; letGo = true; if (t) goto(t); }} />
    {/if}
    {#if campaignOpen && isOwner}
      <CampaignDialog sheetId={sheet.id} {campaign} isDm={campaignIsMine} retired={sheet.retired}
                      suggestedName={definition.identity.campaign?.trim() ?? ''}
                      themeCss={themeStyle(themePreview ?? definition.identity.theme)}
                      beforeChange={() => sheetStore.retry()}
                      onjoined={(id, stamp) => sheetStore.adoptRow({ campaign_id: id, ...(stamp ? { updated_at: stamp } : {}) })}
                      onleave={() => saveRow({ campaign_id: null })}
                      onretire={(on) => saveRow({ retired: on })}
                      onclose={() => (campaignOpen = false)} />
    {/if}
    <!-- Outside the tabs: a roll from it brings up the Combat tab, and the
         dialog stays over it until it is done with. -->
    {#if casting}
      <CastPicker spell={casting} slots={slots} themeCss={themeStyle(themePreview ?? definition.identity.theme)}
                  attack={spellAtk} saveDc={saveDc} characterLevel={totalLevel}
                  onroll={(kind, at, spend) => castRoll(casting!, kind, at, spend)}
                  oncancel={() => (casting = null)} />
    {/if}
    {#if equipping !== null && definition?.equipment?.[equipping]}
      <EquipDialog item={definition.equipment[equipping]}
                   onclose={() => (equipping = null)}
                   onsave={(effects, equipped) => { setItem(equipping!, { effects, equipped }); equipping = null; }} />
    {/if}
    <ConditionOverlay conditions={sheetState.conditions ?? []} looks={definition.conditionLooks}
                      current={sheetState.hpCurrent} max={definition.combat?.hpMax ?? 0} />
    <DownScreen state={sheetState} hpMax={definition.combat?.hpMax ?? 0} />
    <HurtEdges current={sheetState.hpCurrent} max={definition.combat?.hpMax ?? 0} />
    <UndoToast label={toast} onundo={doUndo} onexpire={() => (toast = null)} />
    <SaveAlert />
    <!-- Floating, so saying a word costs the header nothing. -->
    <SaveIndicator />
  </div>
  <!-- Only the printer shows this. Private writing a visitor cannot read is
       not passed in, so it is never on their paper either. -->
  <PrintSheet {definition} state={sheetState} notes={readable('notes')} backstory={readable('backstory')} />
{/if}

<style>
  /* The heading rises in with the panels, and only on arrival: as a lasting
     rule, it played a second time the moment the arrival ended. */
  @keyframes rise {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }
  .entering .identity { animation: rise 0.3s cubic-bezier(0.2, 0.7, 0.3, 1) backwards; }

  .loading { position: relative; }
  .loading > :global(.skel) { opacity: 0.45; }
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
  /* On a phone the frost is dropped for a nearly solid module: blurring the
     banner behind every module again on each animated frame (a gauge, a pip,
     a condition's tint) is what made changes stutter there. */
  @media (max-width: 720px), (pointer: coarse) {
    .bannered .panel {
      backdrop-filter: none; -webkit-backdrop-filter: none;
      background: color-mix(in oklch, var(--surface) 93%, transparent);
    }
  }
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
    position: absolute; left: 50%; bottom: 0; transform: translate(-50%, 50%); z-index: 2;
    background: var(--surface); border: 1px solid var(--a-edge);
    color: var(--a); border-radius: var(--r-sm); font-size: 0.6875rem; font-weight: 650;
    padding: 0.0625rem 0.5rem; letter-spacing: 0.02em; white-space: nowrap;
  }
  /* Dead: the portrait drains of colour and a skull sits on its top edge. */
  .portrait img { transition: filter 0.8s ease; }
  .portrait.fallen img { filter: grayscale(1) brightness(0.65); }
  /* Dead: a big skull in front of the greyed portrait, not a badge. */
  .skull {
    position: absolute; inset: 0; z-index: 1; border-radius: var(--r);
    display: grid; place-items: center; pointer-events: none;
    background: radial-gradient(circle, oklch(10% 0.01 25 / 0.55) 0%, oklch(10% 0.01 25 / 0.15) 70%);
    color: oklch(94% 0.01 286);
    animation: skullIn 0.7s cubic-bezier(0.3, 1.4, 0.5, 1);
  }
  .skull svg {
    width: 62%; height: 62%;
    filter: drop-shadow(0 0 10px oklch(60% 0.22 25 / 0.85)) drop-shadow(0 2px 2px rgb(0 0 0 / 0.6));
  }
  @keyframes skullIn { from { transform: scale(1.6); opacity: 0; } }
  .who { flex: 1 1 auto; min-width: 0; }
  .controls { display: flex; align-items: center; gap: 0.5rem; flex: none; }
  /* The player sits in the middle of the header: the name and the buttons
     each take an equal share either side of it. */
  .musicslot { flex: 1 1 14rem; min-width: 11rem; display: flex; justify-content: center; }
  .identity:has(.musicslot) .who { flex: 0 1 auto; }
  /* Without room for all three in a row, the player takes a row of its own
     under the header, full width. */
  @media (max-width: 1100px) {
    .musicslot { order: 5; flex: 1 1 100%; min-width: 0; }
    .musicslot :global(.music) { width: 100%; }
    .identity:has(.musicslot) .who { flex: 1 1 auto; }
  }
  .who h1 { margin: 0; font-size: 1.75rem; font-weight: 600; letter-spacing: -0.015em; }
  .campaign {
    display: flex; align-items: center; gap: 0.375rem; margin-bottom: 0.1875rem; min-width: 0;
    font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--a);
    animation: campaignIn 0.4s cubic-bezier(0.2, 0.8, 0.3, 1);
  }
  .campaign svg { flex: none; }
  .campaign > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .campaign a { color: inherit; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .campaign a:hover { text-decoration: underline; text-underline-offset: 3px; }
  .campaign .retired {
    color: var(--dim); border: 1px solid var(--line); border-radius: 999px; padding: 0 0.4375rem;
    font-size: 0.625rem; letter-spacing: 0.1em;
  }
  /* In edit mode the label is a button that opens the campaign dialog. */
  button.campaign {
    font: inherit; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
    background: none; border: 1px dashed var(--a-edge); border-radius: 999px; padding: 0.125rem 0.625rem 0.125rem 0.5rem;
    color: var(--a); cursor: pointer; transition: background-color 0.15s ease, border-color 0.15s ease;
  }
  button.campaign:hover { background: var(--a-wash); border-style: solid; }
  @keyframes campaignIn { from { opacity: 0; transform: translateY(4px); } }
  /* On a phone the name sits under the portrait, whose level badge hangs below it. */
  @media (max-width: 700px) { .campaign { margin-top: 0.5rem; } }
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
  /* Wide screens: the middle module is exactly as tall as the taller column
     beside it, whatever tab is open; what is longer scrolls inside it, and a
     wheel that has nothing left to scroll there moves the page. */
  @media (min-width: 861px) {
    .centre { height: 0; min-height: 100%; }
  }

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
  /* Initiative, out of edit mode: the number itself is the button that rolls it. */
  .computed { display: inline-block; }
  .rollnum {
    font: inherit; color: inherit; background: none; border: 0; padding: 0.125rem 0.375rem; margin: -0.125rem 0;
    border-radius: var(--r-sm); cursor: pointer; transition: color 0.15s ease, background-color 0.15s ease, transform 0.08s ease;
  }
  /* The whole box is the button (the number's ::after covers it). Not the
     skills' dashed outline: a d20 sits in the corner, and on hover the box
     rises into the accent while the die gives a turn. */
  .defbox.rollable { position: relative; cursor: pointer; transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.2s cubic-bezier(0.3, 1.4, 0.5, 1), box-shadow 0.2s ease; }
  .rollnum::after { content: ''; position: absolute; inset: 0; border-radius: inherit; }
  .rollnum:focus-visible { outline: none; }
  .defbox.rollable:has(.rollnum:focus-visible) { outline: 2px solid var(--a); outline-offset: 2px; }
  .defbox.rollable:hover {
    border-color: var(--a-edge); background: var(--a-wash); transform: translateY(-2px);
    box-shadow: 0 8px 18px -10px color-mix(in oklch, var(--a) 75%, transparent);
  }
  .defbox.rollable:hover b { color: var(--a); }
  .defbox.rollable:active { transform: translateY(0); box-shadow: none; }
  .defbox .d20 {
    position: absolute; top: 0.375rem; right: 0.375rem; width: 0.8125rem; height: 0.8125rem;
    fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linejoin: round; color: var(--faint);
    transition: color 0.2s ease, transform 0.35s cubic-bezier(0.3, 1.5, 0.5, 1); pointer-events: none;
  }
  .defbox.rollable:hover .d20 { color: var(--a); transform: rotate(72deg) scale(1.2); }
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
  /* Conditions and trackers lead the rail: whatever comes first starts flush. */
  .rail-right > :global(:first-child) { padding-top: 0; }
  .defs-h { padding-top: 1.25rem; }
  .trk .cap { margin-bottom: 0.625rem; }
  /* Directly below the trackers. With equal-height rails the slack falls to
     the bottom of the panel, not into a gap above this. */
  .passives { padding-top: 0.25rem; }
  .passives .cap:first-child { margin-bottom: 0.625rem; }
  /* In the narrower skills card "Investigation" only fits a little smaller. */
  .rail-skills .passives .defbox { padding-inline: 0.125rem; }
  .rail-skills .passives .defbox .cap { font-size: 0.5rem; letter-spacing: 0; }
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

  .casting {
    /* Always three across, centred, so the third never sits alone on a row. */
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem; margin-bottom: 1.25rem; text-align: center; align-items: end;
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
  .floats { display: contents; }
  /* Ready-made trackers: beside Add tracker, in the accent. */
  .opener {
    display: inline-flex; align-items: center; gap: 0.375rem; font: inherit; font-size: 0.8125rem;
    background: var(--a-wash); border: 1px solid var(--a-edge); color: var(--a); border-radius: var(--r-sm);
    padding: 0.3125rem 0.625rem; cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease, transform 0.08s ease;
  }
  .opener:hover { border-color: var(--a); color: var(--a-hi); }
  .opener:active { transform: translateY(1px); }
  .chev { font-style: normal; font-size: 0.7rem; transition: transform 0.2s ease; }
  .chev.up { transform: rotate(180deg); }
  /* The narrowest phones: the icon buttons and the dates draw in a little so
     every control still fits on one row. */
  @media (max-width: 400px) {
    .identity .controls :global(:is(.share, .print, .dl, .sound, .mode)) { width: 1.875rem; height: 1.875rem; }
    .identity .stamps { gap: 0.625rem; margin-right: 0.25rem; }
  }
  /* Opening a sheet: the panels arrive one after another. */
  .entering .panel { animation: panelIn 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) backwards; animation-delay: calc(var(--i, 0) * 70ms); }
  @keyframes panelIn { from { opacity: 0; transform: translateY(12px); } }
  /* Inspiration held: a soft glow that breathes until it is spent. */
  /* The glow is a layer whose opacity breathes; animating the shadow itself
     repainted the box on every frame. */
  .defbox.inspired { border-color: var(--a-edge); position: relative; }
  .defbox.inspired::after {
    content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    box-shadow: 0 0 14px 1px color-mix(in oklch, var(--a) 35%, transparent);
    opacity: 0; animation: inspired 2.6s ease-in-out infinite; will-change: opacity;
  }
  @keyframes inspired { 50% { opacity: 1; } }
  /* Level up: twelve rays from the portrait, and the words rising off it. */
  .burst { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
  .burst i {
    position: absolute; left: 50%; top: 50%; width: 3px; height: 34%; margin-left: -1.5px;
    border-radius: 2px; transform-origin: 50% 0;
    background: linear-gradient(to bottom, var(--a-hi), transparent);
    transform: rotate(var(--r)) translateY(30%) scaleY(0.2); opacity: 0;
    animation: ray 0.9s cubic-bezier(0.2, 0.8, 0.3, 1);
  }
  @keyframes ray {
    15% { opacity: 1; }
    to { transform: rotate(var(--r)) translateY(120%) scaleY(1); opacity: 0; }
  }
  .levelup {
    position: absolute; left: 50%; top: -0.5rem; z-index: 3; white-space: nowrap; pointer-events: none;
    transform: translateX(-50%); font-size: 0.75rem; font-weight: 750; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--a-hi); text-shadow: 0 1px 6px rgb(0 0 0 / 0.6);
    animation: levelRise 1.6s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
  }
  @keyframes levelRise {
    0% { opacity: 0; transform: translate(-50%, 6px) scale(0.8); }
    20% { opacity: 1; transform: translate(-50%, -6px) scale(1.08); }
    70% { opacity: 1; transform: translate(-50%, -12px) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -20px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .entering .panel, .entering .identity, .defbox.inspired::after, .burst, .levelup { animation: none; }
    .burst { display: none; }
  }
  /* Shortcuts are for a keyboard: the button only shows where there is a mouse. */
  .keys {
    display: none; place-items: center; width: 2rem; height: 2rem; flex: none; padding: 0;
    background: var(--raised); border: 1px solid var(--line); border-radius: var(--r-sm);
    color: var(--text); cursor: pointer; transition: border-color 0.18s ease, color 0.18s ease, transform 0.08s ease;
  }
  .keys:hover { border-color: var(--a-edge); color: var(--a); }
  .keys:active { transform: translateY(1px); }
  @media (hover: hover) and (pointer: fine) { .keys { display: inline-grid; } }
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
    /* Seven controls in a phone's width: tighter, and allowed to wrap on the
       narrowest screens rather than run off the edge. */
    .controls { gap: 0.25rem; flex-wrap: wrap; width: 100%; justify-content: space-between; }
    .edit { min-width: 3.25rem; padding: 0.375rem 0.5rem; }
    .undo, .back { padding: 0.375rem 0.5rem; }
  }
</style>
