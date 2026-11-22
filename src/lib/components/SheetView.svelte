<script lang="ts">
  /**
   * A whole character sheet. Two addresses open it: /s/<id>, the one the app
   * links to itself, and /s?id=<id>, the one the Share button copies. The
   * second is a real page on the host, so a link pasted into Discord or
   * Messenger is answered with a preview card rather than "not found".
   */
  import { signed as sign } from '#lib/actions.ts';
  import { base } from '#lib/base.ts';
  import AbilityBand from '#lib/components/AbilityBand.svelte';
  import ModeToggle from '#lib/components/ModeToggle.svelte';
  import CogIcon from '#lib/components/CogIcon.svelte';
  import DimModal from '#lib/components/DimModal.svelte';
  import { setCustomSounds, warmSounds } from '#lib/sound.ts';
  import { musicOn, setMusicOn } from '#lib/music.ts';
  import { get } from 'svelte/store';
  import MusicPlayer from '#lib/components/MusicPlayer.svelte';
  import Banner from '#lib/components/Banner.svelte';
  import CombatActions from '#lib/components/CombatActions.svelte';
  import CombatFeatures from '#lib/components/CombatFeatures.svelte';
  import Conditions from '#lib/components/Conditions.svelte';
  import Currency from '#lib/components/Currency.svelte';
  import DetailsBlock from '#lib/components/DetailsBlock.svelte';
  import DiceRoller from '#lib/components/DiceRoller.svelte';
  import EditableField from '#lib/components/EditableField.svelte';
  import EntryLink from '#lib/components/EntryLink.svelte';
  import ClassIcon from '#lib/components/ClassIcon.svelte';
  import HitPoints from '#lib/components/HitPoints.svelte';
  import HurtEdges from '#lib/components/HurtEdges.svelte';
  import RestButtons from '#lib/components/RestButtons.svelte';
  import SaveIndicator from '#lib/components/SaveIndicator.svelte';
  import SaveAlert from '#lib/components/SaveAlert.svelte';
  import SkillRail from '#lib/components/SkillRail.svelte';
  import EntryTable from '#lib/components/EntryTable.svelte';
  import LeaveDialog from '#lib/components/LeaveDialog.svelte';
  import NotFound from '#lib/components/NotFound.svelte';
  import { pageTitle } from '#lib/title.ts';
  import SheetSkeleton from '#lib/components/SheetSkeleton.svelte';
  import { assetsReady, imagesSettled } from '#lib/assets.ts';
  import D20Loader from '#lib/components/D20Loader.svelte';
  import SaveButton from '#lib/components/SaveButton.svelte';
  import { beforeNavigate, goto } from '$app/navigation';
  import { onMount, tick, untrack } from 'svelte';
  import { phone } from '#lib/stores/phone.svelte.ts';
  import PhoneBar, { type PhonePlace } from '#lib/components/PhoneBar.svelte';
  import BackLink from '#lib/components/BackLink.svelte';
  import PhoneTop from '#lib/components/PhoneTop.svelte';
  import Flash from '#lib/components/Flash.svelte';
  import ShareButton from '#lib/components/ShareButton.svelte';
  import Tabs from '#lib/components/Tabs.svelte';
  import TrackerGroup from '#lib/components/TrackerGroup.svelte';
  import TrackerPresets from '#lib/components/TrackerPresets.svelte';
  import { resetTray } from '#lib/stores/tray.ts';
  import TextPanel from '#lib/components/TextPanel.svelte';
  import { page } from '$app/state';
  import ClassCards from '#lib/components/ClassCards.svelte';
  import DieMark from '#lib/components/DieMark.svelte';
  import LinksPanel from '#lib/components/LinksPanel.svelte';
  import UndoToast from '#lib/components/UndoToast.svelte';
  import { sheetRepo } from '#lib/data/sheets.ts';
  import { isConfigured, supabase } from '#lib/supabase.ts';
  import { shareSheet, sheetLibraryRows } from '#lib/library.ts';
  import {
    ATTACK_COLUMNS, ATTUNE_SLOTS, CLASS_COLUMNS, FEATURE_COLUMNS, FEATURE_KINDS, ITEM_COLUMNS,
    PASSIVES, SPELL_COLUMNS, TABS, TRACKER_COLUMNS, kindOf
  } from '#lib/sheet/columns.ts';
  import {
    blankTracker, newId, trackerRows, withClasses, withTrackerRows, withoutTrackers, type TrackerRow
  } from '#lib/sheet/edits.ts';
  import { slotsByLevel, spellAttack, spellDc } from '#lib/rules/casting.ts';
  import { featureUrl } from '#lib/rules/classLinks.ts';
  import { brewLoaded, ensureBrewClasses, ensureEntryIndex } from '#lib/rules/brewClasses.ts';
  import {
    characterLevel,
    classLine,
    classList,
    formulaContext,
    modifierOf,
    armorClass,
    initiativeParts,
    passiveParts,
    passiveScore,
    proficiencyBonus,
    speedParts,
    spellAttackBonus,
    spellSaveDC,
    weightCarried,
    mainClass
  } from '#lib/rules/derived.ts';
  import Why from '#lib/components/Why.svelte';
  import EquipDialog from '#lib/components/EquipDialog.svelte';
  import { advantageFrom } from '#lib/rules/equipment.ts';
  import { faceFamily, fontFace, nameFont } from '#lib/rules/fonts.ts';
  import { shareRoll } from '#lib/owlbear/channel.ts';
  import { downloadBlob } from '#lib/download.ts';
  import { parseRoll, type Pool, type Roll } from '#lib/rules/dice.ts';
  import { d20Penalty, requestRoll } from '#lib/stores/dice.ts';
  import { conditionsFor, d20Penalty as d20PenaltyOf, exhaustionLevel, exhaustionTracker } from '#lib/rules/exhaustion.ts';
  import { friendlyDate, latest } from '#lib/rules/dates.ts';
  import { exportFileName, exportSheet } from '#lib/exchange.ts';
  import { resolveImageUrl } from '#lib/rules/imageUrl.ts';
  import { needsConcentration, ordinal, spellGroup, spellLevel, spellRank } from '#lib/rules/spells.ts';
  import { spellDamage } from '#lib/rules/spellroll.ts';
  import CastPicker from '#lib/components/CastPicker.svelte';
  import CampaignDialog from '#lib/components/CampaignDialog.svelte';
  import { campaignRepo, type Campaign } from '#lib/data/campaigns.ts';
  import { slotLevel } from '#lib/rules/print.ts';
  import { themeStyle } from '#lib/theme.ts';
  import { rememberedTheme, rememberThemes } from '#lib/themeMemory.ts';
  import { bump, fadeOver, glow, parallax, popIn, sparkle } from '#lib/motion.ts';
  import { glide } from '#lib/flip.ts';
  import { isDead } from '#lib/rules/hp.ts';
  import ConditionOverlay from '#lib/components/ConditionOverlay.svelte';
  import DownScreen from '#lib/components/DownScreen.svelte';
  import ShortcutHelp from '#lib/components/ShortcutHelp.svelte';
  import SheetInitiative from '#lib/components/SheetInitiative.svelte';
  import { LiveInitiative } from '#lib/initiative.svelte.ts';
  import Spotlight from '#lib/components/Spotlight.svelte';
  import { friendlyError } from '#lib/errors.ts';
  import { session } from '#lib/stores/session.ts';
  import { sheetStore } from '#lib/stores/sheet.ts';
  import { resetUndo, snapshot, undo } from '#lib/stores/undo.ts';
  import { ABILITIES } from '#lib/types.ts';
  import type { SheetTexts, TextKey } from '#lib/types.ts';
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
  } from '#lib/types.ts';


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

  /*
   * The owner's rows go to the shared library (lib/library.ts) when the sheet
   * is open to read: on opening it, and again on finishing an edit. Never
   * while editing, so half-typed rows are not shared.
   */
  $effect(() => {
    if (!isOwner || editing || !revealed || !sheet || !definition) return;
    const sheetId = sheet.id;
    const rows = sheetLibraryRows(definition, classes);
    const t = setTimeout(() => void shareSheet(sheetId, rows), 1500);
    return () => clearTimeout(t);
  });

  const carried = $derived(definition ? weightCarried(definition) : 0);
  const classes = $derived(definition ? classList(definition) : []);
  // A homebrew class's features are fetched for its links (rules/brewClasses.ts).
  $effect(() => void ensureBrewClasses(classes));
  $effect(() => void ensureEntryIndex());
  /** What tracker formulas read: level, class levels, proficiency, modifiers. */
  const ctx = $derived(definition ? formulaContext(definition) : null);
  /** Optional: with no banner the sheet renders exactly as it did before. */
  const banner = $derived(resolveImageUrl(definition?.identity?.bannerUrl).url);
  const portraitSrc = $derived(resolveImageUrl(definition?.identity?.portraitUrl).url);
  /** The writing lives in its own rows, so its edits count toward "updated" too. */
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
  // vanished, and faded in again.
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
  /** The campaign this sheet was opened from, if any (a valid id only). */
  const cameFrom = $derived.by(() => {
    const from = page.url.searchParams.get('from') ?? '';
    return /^[0-9a-f-]{36}$/i.test(from) ? from : '';
  });
  /** The character name's font (rules/fonts.ts), when one is set and found. */
  const nameFace = $derived.by(() => {
    const f = nameFont(definition?.identity?.nameFont);
    return f && f !== 'bad' ? f : null;
  });
  /** The colors it was last seen in (lib/themeMemory), worn while it loads: its bars and outline come in once, in its own colors. */
  const loadingTheme = $derived(themeStyle(rememberedTheme(id)));
  $effect(() => {
    const theme = definition?.identity?.theme;
    if (theme) rememberThemes([[id, theme]]);
  });
  /** Its pictures and name fonts are here (lib/assets): until then the die keeps rolling over the outline. */
  let assetsDone = $state(false);
  /** The sheet itself, drawn but hidden under its outline until its pictures have settled. */
  let holdEl = $state<HTMLElement>();
  $effect(() => {
    if (loading || loadError || !definition || assetsDone || !holdEl) return;
    const el = holdEl;
    let live = true;
    void Promise.all([assetsReady([portraitSrc, banner], [nameFace]), imagesSettled(el)]).then(() => { if (live) assetsDone = true; });
    return () => (live = false);
  });
  const initAdv = $derived(definition ? advantageFrom(definition, 'init') : []);
  /** The spellcasting ability, and what the spell DC and attack are made of. */
  const castAb = $derived(definition?.spellcastingAbility);

  /*
   * A phone: the sheet in places, chosen on a bar at the bottom, in place of
   * one long column. Play is the fight (hit points, defenses, conditions,
   * the Combat tab); Abilities the six and the skills; Spells, Gear, and
   * Features their tabs; More the rest of the tabs. Search on the bar opens
   * the search. A top bar, held at the top while the page scrolls, has Edit,
   * the cog, and light or dark (left) and share, PDF, and Back (right). The
   * same parts as the desktop's, shown a place at a time.
   */
  type Place = 'play' | 'abilities' | 'spells' | 'gear' | 'features' | 'more';
  const MORE_TABS = ['Trackers', 'Character', 'Notes', 'Lore'];
  /** The sheet's look and sound (LinksPanel): a window from the cog, not a tab. */
  let appearanceOpen = $state(false);
  const phoneOn = $derived(phone.current);
  let place = $state<Place>('play');
  /** Moved between places at least once: from then on a place's parts fade in (app.css). */
  let moved = $state(false);
  const placeOfTab = (tab: string): Place =>
    tab === 'Combat' ? 'play' : tab === 'Spells' ? 'spells' : tab === 'Equipment' ? 'gear' : tab === 'Features' ? 'features' : 'more';
  /** Coming from Abilities, the tab panel fades in with its place: its own slide stays still. */
  let quietTab = $state(false);
  function goPlace(next: string) {
    // Search is on the bar, but it is a window, not a place.
    if (next === 'search') return void (searching = true);
    const p = next as Place;
    quietTab = place === 'abilities';
    void tick().then(() => (quietTab = false));
    if (p === 'play') activeTab = 'Combat';
    else if (p === 'spells') activeTab = 'Spells';
    else if (p === 'gear') activeTab = 'Equipment';
    else if (p === 'features') activeTab = 'Features';
    else if (p === 'more' && !MORE_TABS.includes(activeTab)) activeTab = 'Trackers';
    if (p !== place) moved = true;
    place = p;
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }
  // A tab chosen some other way (a key, a link to #spells) takes its place along.
  $effect(() => {
    const tab = activeTab;
    untrack(() => {
      if (place !== 'abilities' && place !== placeOfTab(tab)) place = placeOfTab(tab);
    });
  });
  const phonePlaces = $derived<PhonePlace[]>([
    { key: 'play', label: 'Play', icon: 'play' },
    { key: 'abilities', label: 'Abilities', icon: 'abilities' },
    { key: 'spells', label: 'Spells', icon: 'spells' },
    { key: 'search', label: 'Search', icon: 'search' },
    { key: 'gear', label: 'Gear', icon: 'gear' },
    { key: 'features', label: 'Features', icon: 'features' },
    { key: 'more', label: 'More', icon: 'more' }
  ]);
  const castParts = $derived(definition && castAb
    ? [{ label: `${castAb.toUpperCase()} modifier`, value: modifierOf(definition, castAb) }, { label: 'Proficiency', value: proficiencyBonus(definition) }]
    : []);
  const ac = $derived(definition ? armorClass(definition) : { total: 10, parts: [], computed: false });
  /** Exhaustion's level, from its tracker or its chip (rules/exhaustion.ts). */
  const exhaustion = $derived(exhaustionLevel(definition, sheetState));
  const speed = $derived(definition ? speedParts(definition, exhaustion) : { total: 30, parts: [] });
  // Every d20 test this sheet rolls loses 2 a level while it lasts.
  $effect(() => {
    d20Penalty.set(exhaustion > 0 ? { amount: d20PenaltyOf(exhaustion), why: `Exhaustion ${exhaustion}` } : null);
    return () => d20Penalty.set(null);
  });
  // The Exhaustion tracker keeps its chip in step ("Exhaustion 3"), and its
  // sixth level marks the character Dead. The owner's sheet does this.
  $effect(() => {
    if (!isOwner || !sheetState || !exhaustionTracker(definition)) return;
    const now = sheetState.conditions ?? [];
    const next = conditionsFor(now, exhaustion);
    if (next.join('\u0000') !== now.join('\u0000')) setState({ ...sheetState, conditions: next });
  });

  $effect(() => {
    if (!id) {
      loading = false;
      loadError = 'notfound';
      return;
    }
    loading = true;
    revealed = false;
    assetsDone = false;
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

  // The sheet's own sound effects, while it is on screen; the sound bank, loaded once.
  $effect(() => void warmSounds());
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'characters', filter: `id=eq.${id}` }, (payload) => {
        const row = payload.new as Partial<Sheet>;
        if (row.definition && row.state && row.updated_at) {
          sheetStore.adoptRemote({ definition: row.definition, state: row.state, updated_at: row.updated_at });
        } else {
          // A big column left unchanged (the definition, when only hit points
          // moved) is not sent along: read the row instead.
          void sheetStore.check();
        }
      })
      .subscribe((status) => {
        // Back after a dropped connection: anything missed meanwhile.
        if (status === 'SUBSCRIBED') void sheetStore.check();
      });
    // A sleeping tablet loses the live connection without saying so: a look
    // whenever the page is shown again, and now and then while it is.
    const look = () => document.visibilityState === 'visible' && void sheetStore.check();
    document.addEventListener('visibilitychange', look);
    const every = setInterval(look, 45000);
    return () => {
      document.removeEventListener('visibilitychange', look);
      clearInterval(every);
      void supabase.removeChannel(channel);
    };
  });

  $effect(() => {
    if (typeof location === 'undefined') return;
    const hash = location.hash.slice(1).toLowerCase();
    // Appearance (once a tab, and before that Links) opens its window.
    if (hash === 'appearance' || hash === 'links') return void (appearanceOpen = true);
    // The Lore tab was once Backstory: an old link still finds it.
    const wanted = TABS.find((t) => t.toLowerCase() === (hash === 'backstory' ? 'lore' : hash));
    if (wanted) activeTab = wanted;
  });

  function setState(next: State) { sheetStore.setState(next); }
  /** A spell held by concentration: "Concentration" in its duration (or a C tag). */
  const isConcentration = (sp: Spell) => needsConcentration(sp.duration, sp.notes);
  /** Concentrating on a spell: one at a time, so starting one ends the last. Press again to stop. */
  function toggleConcentration(sp: Spell | undefined) {
    if (!sp?.name || !sheetState) return;
    setState({ ...sheetState, concentrating: sheetState.concentrating === sp.name ? undefined : sp.name });
  }

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
    say('Saving your changes');
    sheetStore.retry().then(() => {
      if (!sheetStore.hasUnsaved()) {
        letGo = true;
        // goto refuses a path that is no route (a file under static/); load it plainly.
        goto(target).catch(() => location.assign(target));
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

  /**
   * A phone shows the tray only in Play: a roll asked for from another place
   * (Abilities, Spells, a tracker in More) goes there first, or it would be
   * made in a tray out of sight.
   */
  function toPlay() {
    if (phoneOn && place !== 'play') goPlace('play');
  }

  /** Shows a roll in the tray, which lives on the Combat tab. */
  function toTray(pool: Pool, label: string, then?: (r: Roll) => void, mode: 'keep' | 'normal' = 'keep') {
    toPlay();
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
  /** The campaign name's own font, as on its page and the main menu. */
  const campaignFace = $derived(fontFace(campaign?.details?.nameFont));
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
  /** A color being dragged to in the theme picker, shown before it is kept. */
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
  function rollSkill(label: string, bonus: number, mode: 'normal' | 'advantage' = 'normal', then?: (r: Roll) => void) {
    toPlay();
    if (activeTab !== 'Combat') {
      activeTab = 'Combat';
      if (typeof location !== 'undefined') history.replaceState(null, '', '#combat');
    }
    // With advantage from a feature or item, the roll takes it; otherwise whatever the tray is set to.
    requestRoll({ dice: { 20: 1 }, modifier: bonus, mode }, label, then, mode === 'advantage' ? 'pool' : 'keep');
  }

  /*
   * The fight (lib/initiative, database/0019): on a player's own sheet in a
   * campaign, a pointer to the campaign page when the DM calls for
   * initiative (it is rolled there, in one place), then the round and their
   * turn while the fight runs.
   */
  const initFor = $derived(isOwner && campaignId && !sheet?.retired ? campaignId : null);
  const liveInit = $derived(initFor ? new LiveInitiative(initFor) : null);
  $effect(() => liveInit?.start());

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
  /** The search (/ or its button): 5e.tools entries in pop-ups. */
  let searching = $state(false);
  function onkey(e: KeyboardEvent) {
    if (!definition || showKeys || leaving) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.querySelector('.lightbox, [role="dialog"]:not([data-keys]), [role="alertdialog"]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '?') {
      e.preventDefault();
      showKeys = true;
    } else if (e.key.toLowerCase() === 'e' && isOwner) {
      e.preventDefault();
      void glide(() => (editing = !editing));
    } else if (e.key.toLowerCase() === 'm') {
      // The music's speaker, on or off.
      e.preventDefault();
      setMusicOn(!get(musicOn));
    } else if (/^[1-8]$/.test(e.key)) {
      activeTab = TABS[Number(e.key) - 1];
    }
  }

  /**
   * The Equip tag. Reading, it puts on or takes off an item whose effects are
   * known; the first time, or while editing, it asks what the item does.
   */
  let equipping = $state<number | null>(null);
  /** The feature whose effects are being set, if any. */
  let effecting = $state<number | null>(null);
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

  /**
   * The sheet as a fillable PDF (lib/pdf), made in the browser and saved.
   * Writing this reader may not see is left out, as everywhere else.
   */
  let makingPdf = $state(false);
  /** Just saved: the button shows a check for a moment. */
  let pdfSaved = $state(false);
  let pdfTimer: ReturnType<typeof setTimeout> | undefined;
  /** The sheet as a PDF, with the sheet inside it: its owner's alone, as Export is. */
  async function makePdf() {
    if (!definition || !sheetState || makingPdf || !isOwner) return;
    makingPdf = true;
    try {
      const { sheetPdf } = await import('#lib/pdf/sheetPdf.ts');
      // The sheet rides inside the PDF, so Import can bring it back: only
      // the writing this reader may see, as on the printed pages.
      const texts = Object.fromEntries((['notes', 'backstory'] as const).map((k) => [k, {
        body: readable(k), isPublic: !definition!.privateText?.[k], updatedAt: sheet?.texts?.[k].updatedAt ?? null
      }])) as SheetTexts;
      const backup = { name: exportFileName(definition), text: exportSheet({ definition, state: sheetState, texts }) };
      const bytes = await sheetPdf(definition, sheetState, { base, notes: readable('notes'), backup });
      const name = (definition.identity?.name || 'Character').replace(/[\\/:*?"<>|]+/g, '').trim() || 'Character';
      downloadBlob(`${name}.pdf`, new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      say('PDF saved');
      pdfSaved = true;
      clearTimeout(pdfTimer);
      pdfTimer = setTimeout(() => (pdfSaved = false), 1600);
    } catch {
      say('The printer jammed! Try again.');
    } finally {
      makingPdf = false;
    }
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

<!-- Edit (a pencil, a check while editing), the owner's. -->
{#snippet editButton()}
  <button class="edit iconbtn" aria-pressed={editing} aria-label={editing ? 'Done editing' : 'Edit the sheet'} title={editing ? 'Done (E)' : 'Edit (E)'}
          onclick={() => glide(() => (editing = !editing))}>
    {#key editing}
      <svg in:popIn viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        {#if editing}<path d="m5 12.5 4.5 4.5L19 7.5" />{:else}<path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10zM14 7l3 3" />{/if}
      </g></svg>
    {/key}
  </button>
{/snippet}

<!-- The cog: the sheet's appearance (portrait, banner, theme, music, links, sounds, name font). -->
{#snippet appearanceButton()}
  <button class="keys gear iconbtn" class:open={appearanceOpen} onclick={() => (appearanceOpen = true)} aria-label="Appearance" title="Appearance"
          aria-haspopup="dialog" aria-expanded={appearanceOpen}>
    <CogIcon />
  </button>
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
  {#if !loadError}<title>{pageTitle(definition?.identity?.name?.trim() || sheet?.name || 'Character sheet')}</title>{/if}
  <!-- The name's own font, if the player chose one (Appearance tab). -->
  {#if nameFace}<link rel="stylesheet" href={nameFace.href} />{/if}
  {#if campaignFace && campaignFace.href !== nameFace?.href}<link rel="stylesheet" href={campaignFace.href} />{/if}
</svelte:head>

{#if loading || !revealed}
  <!-- The sheet's outline, dimmed, with the die rolling over it. On a phone its two bars are
       already there, so moving here from another page they hold still instead of blinking out. -->
  {#if phoneOn}
    <PhoneTop page="sheet:{id}" themeCss={loadingTheme}>
        {#snippet left()}<ModeToggle />{/snippet}
        {#snippet right()}<BackLink href={cameFrom ? `${base}/c/${cameFrom}` : `${base}/`} title={cameFrom ? 'Back to the campaign' : 'Back to your characters'} />{/snippet}
    </PhoneTop>
    <PhoneBar page="sheet:{id}" places={phonePlaces} active={place} onchoose={goPlace} themeCss={loadingTheme} />
  {/if}
  <div class="loading themed" style={loadingTheme} out:fadeOver>
    <SheetSkeleton />
    <div class="screen-center">
      <D20Loader result={loading || (!loadError && !assetsDone) ? null : loadError ? 1 : 20} label="Loading the sheet"
                 onlanded={() => (revealed = true)} />
    </div>
  </div>
{/if}
{#if loading}
  <!-- Nothing yet: the outline above is all there is. -->
{:else if loadError === 'notfound'}
  {#if revealed}<NotFound tab="Sheet not found" title="No sheet here!" message="This sheet has vanished like a rogue in the night. It may have been deleted, kept private by its player, or the link is off by a letter, so check it with whoever sent it." />{/if}
{:else if loadError}
  {#if revealed}<NotFound tab="Sheet didn’t load" title="That’s a critical fail!" message={loadError} />{/if}
{:else if sheet && definition && sheetState}
  <!-- Drawn as soon as it has loaded, but hidden under the outline (and out of reach) until its
       pictures have settled, so it appears whole, nothing popping in after. -->
  <div class="holder" class:holding={!revealed} inert={!revealed} bind:this={holdEl}>
  <!-- The theme is scoped here, not to :root, so a campaign view can later show
       several characters in their own colors at once. -->
  <div class="sheet themed" class:entering={entering && revealed} class:bannered={banner} style={themeStyle(themePreview ?? definition.identity.theme)}
       data-place={phoneOn ? place : undefined} data-moved={phoneOn && moved ? '' : undefined}>
    {#if phoneOn}
      <!-- The top bar, held at the top of the screen: Edit, the cog, and the mode at the left, the
           app's mark in the middle, and the link, the PDF, and Back at the right. -->
      <PhoneTop page="sheet:{id}" themeCss={themeStyle(themePreview ?? definition.identity.theme)}>
        {#snippet left()}{#if isOwner}{@render editButton()}{/if}{@render appearanceButton()}<ModeToggle />{/snippet}
        {#snippet right()}
          <ShareButton id={sheet.id} oncopied={(ok) => say(ok ? 'Link copied' : 'Couldn’t copy the link!')} />
          {#if isOwner}<SaveButton onsave={makePdf} busy={makingPdf} saved={pdfSaved} />{/if}
          <BackLink href={cameFrom ? `${base}/c/${cameFrom}` : `${base}/`} title={cameFrom ? 'Back to the campaign' : 'Back to your characters'} />
        {/snippet}
      </PhoneTop>
    {/if}
    {#if banner}<Banner url={banner} />{/if}
    <!-- Away from Play on a phone the header steps aside, still there, so its music plays on. -->
    <header class="identity" class:offstage={phoneOn && place !== 'play'}>
      <!-- The portrait and the words beside it: one side of the header, so the music sits in its very middle. -->
      <div class="idleft">
      <div class="portrait" class:has={Boolean(portraitSrc)} class:fallen={dead} use:parallax>
        <!-- The picture turns toward the pointer, inside its still frame. -->
        <span class="frame">
          <!-- No portrait yet: the main class, drawn (a bow for a ranger…); a
               picture covers it, and a picture that fails to load shows it again. -->
          <ClassIcon cls={mainClass(definition)} />
          {#if portraitSrc}
            <!-- A link that stops working (a Drive file that was unshared) leaves
                 the frame as it is for a sheet with no art, not a broken-image icon. -->
            <img src={portraitSrc} alt="" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
          {/if}
        </span>
        <span class="lvl" use:glow={totalLevel}>LV {totalLevel}</span>
        {#key levelUp}
          {#if levelUp > 0}
            <!-- Leveled up: rays burst from the portrait and the news floats up. -->
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
                  title="Join, start, or leave a campaign">
            {@render flag()}
            <span style:font-family={campaign ? faceFamily(campaignFace) : undefined}>{campaign?.name ?? definition.identity.campaign?.trim() ?? 'Add to a Campaign'}</span>
          </button>
        {:else if campaign || definition.identity.campaign?.trim()}
          <div class="campaign" data-flip-ghost="identity:campaign" data-flip="identity:campaign-at">
            {@render flag()}
            {#if campaign}
              <a href="{base}/c/{campaign.id}" title="Open the campaign" style:font-family={faceFamily(campaignFace)}>{campaign.name}</a>
            {:else}
              <span title="Campaign">{definition.identity.campaign?.trim()}</span>
            {/if}
            {#if sheet.retired}<span class="retired">Retired</span>{/if}
          </div>
        {/if}
        <h1 style:font-family={nameFace ? `'${nameFace.family}', system-ui, sans-serif` : undefined}>
          <EditableField value={definition.identity.name} {editable} label="Name"
                         placeholder="Character Name"
                         onchange={(v) => patchIdentity('name', v)} />
        </h1>
        <p class="sub">
          <!-- Class, species, and background are all written on the Character
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
      </div>

      {#if definition.identity.playlistUrl?.trim()}
        <!-- Top center: the sheet's music, the same player as the table's. -->
        <div class="musicslot" data-flip="identity:music"><MusicPlayer url={definition.identity.playlistUrl} /></div>
      {/if}

      <!-- One group, so they wrap together: loose in the header the status
           dot was left stranded at the end of the name's line on a phone. -->
      {#if !phoneOn}
      <div class="controls">
        <!-- For a visitor, when the sheet was made and last touched. The owner
             sees the same on the sheet list instead. -->
        {#if !isOwner}
          <dl class="stamps">
            <div><dt>Created</dt><dd>{friendlyDate(sheet.created_at)}</dd></div>
            <div><dt>Last updated</dt><dd>{friendlyDate(updated)}</dd></div>
          </dl>
        {/if}
        <!-- One row, as the campaign's: Back, Edit, and the cog, then the sheet's tools. -->
        <div class="ctlrow">
        <!-- Opened from a campaign (?from=<campaign>): back goes to that campaign. -->
        <BackLink href={cameFrom ? `${base}/c/${cameFrom}` : `${base}/`} title={cameFrom ? 'Back to the campaign' : 'Back to your characters'} />
        {#if isOwner}{@render editButton()}{/if}
        {@render appearanceButton()}
        <ShareButton id={sheet.id} oncopied={(ok) => say(ok ? 'Link copied' : 'Couldn’t copy the link!')} />
        {#if isOwner}
          <SaveButton onsave={makePdf} busy={makingPdf} saved={pdfSaved} />
        {/if}
        <button class="keys searchbtn" onclick={() => (searching = true)} aria-label="Search 5e.tools" title="Search 5e.tools (/)">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7" /><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
        </button>
        <button class="keys kbd" onclick={() => (showKeys = true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2.5" y="6" width="19" height="12" rx="2" />
              <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9" />
            </g>
          </svg>
        </button>
        <ModeToggle />
        </div>
      </div>
      {/if}
    </header>

    {#if phoneOn && !isOwner}
      <!-- For a visitor, when the sheet was made and last touched, which sit in the header on a computer. -->
      <div class="phonetools" data-places="more">
        <dl class="stamps">
          <div><dt>Created</dt><dd>{friendlyDate(sheet.created_at)}</dd></div>
          <div><dt>Last updated</dt><dd>{friendlyDate(updated)}</dd></div>
        </dl>
      </div>
    {/if}

    {#if liveInit && sheet}<SheetInitiative live={liveInit} sheetId={sheet.id} />{/if}

    <div class="band">
      <section class="panel hp" style:--i=0 data-places="play">
        <HitPoints {definition} state={sheetState} editable={isOwner} editDefinition={editable}
                   onchange={setState} ondefinition={setDefinition}>
          {#snippet children()}
            <RestButtons {definition} state={sheetState} editable={isOwner}
                         onchange={setState} onrest={afterRest}
                         onroll={(pool, label, then) => toTray(pool, label, then, 'normal')} />
          {/snippet}
        </HitPoints>
      </section>

      <section class="panel band-abilities" style:--i=1 data-places="abilities">
        <AbilityBand {definition} {editable} onchange={setDefinition}
                     onroll={isOwner ? rollSkill : undefined} />
      </section>
    </div>

    <div class="main">
      <section class="panel rail-skills" style:--i=2 data-places="abilities">
        <SkillRail {definition} {editable} onchange={setDefinition}
                   onroll={isOwner ? rollSkill : undefined} />
        <div class="passives">
          <h2 class="cap">Passives</h2>
          <div class="defense">
            {#each PASSIVES as skill (skill)}
              {@const name = skill[0].toUpperCase() + skill.slice(1)}
              <Why title="Passive {name}" parts={passiveParts(definition, skill)} total={String(passiveScore(definition, skill))}
                   hint="What you notice without rolling: 10 plus your {name} bonus.">
                <div class="defbox">
                  <b use:bump={passiveScore(definition, skill)}>{passiveScore(definition, skill)}</b>
                  <span class="cap">{name}</span>
                </div>
              </Why>
            {/each}
          </div>
        </div>
        <!-- Senses under the passives: what the character notices, together. -->
        <div class="profs senses" style:--rows={3}>
          <h2 class="cap">Senses</h2>
          <EditableField
            value={definition.senses ?? ''}
            {editable}
            type="textarea"
            rows={3}
            label="Senses"
            placeholder="—"
            hint="Special senses and their range, such as darkvision."
            onchange={(v) => setDefinition({ ...definition, senses: String(v) })}
          />
        </div>
      </section>

      <section class="panel center" style:--i=3 data-places="play spells gear features more">
        <Tabs tabs={phoneOn && place === 'more' ? MORE_TABS : TABS} bare={phoneOn && place !== 'more'} quiet={quietTab} bind:active={activeTab} lit={litLevel ? 'Spells' : null}>
          {#snippet children(tab)}
            {#if tab === 'Combat'}
              <EntryTable
                items={definition.attacks ?? []}
                columns={ATTACK_COLUMNS}
                {editable}
                library="attacks"
                category="items"
                links={false}
                onpress={isOwner ? rollAttack : undefined}
                emptyText="No attacks yet."
                addLabel="Add attack"
                blank={() => ({ name: '' }) as Attack}
                onchange={(attacks) => setDefinition({ ...definition, attacks: attacks as Attack[] })}
              />
              <!-- Below the table, so they move when it changes size: they glide too. -->
              {#if isOwner}<div class="flipbox" data-flip="dice"><DiceRoller onrolled={(r) => sheet && shareRoll(sheet.id, definition?.identity?.name || sheet.name || '', r)} /></div>{/if}
              <div class="flipbox" data-flip="combat-features">
                <CombatFeatures features={definition.features ?? []} onpick={showFeature} />
              </div>
              <div class="flipbox" data-flip="actions"><CombatActions /></div>
            {:else if tab === 'Spells'}
              <div class="casting">
                <div>
                  <h3>Spellcasting Ability</h3>
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
                <!-- Both worked out from the spellcasting ability, never typed. -->
                <Why title="Spell save DC" parts={castAb ? [{ label: 'Base', value: 8 }, ...castParts] : []}
                     total={castAb ? String(spellSaveDC(definition, castAb)) : '—'}
                     hint={castAb ? '8 + proficiency + spellcasting modifier.' : 'Choose a spellcasting ability to work it out.'}>
                  <div>
                    <h3>Spell Save DC</h3>
                    <p class="castval" use:bump={castAb ? spellSaveDC(definition, castAb) : 0}>{castAb ? spellSaveDC(definition, castAb) : '—'}</p>
                  </div>
                </Why>
                <Why title="Spell attack bonus" parts={castParts}
                     total={castAb ? sign(spellAttackBonus(definition, castAb)) : '—'}
                     hint={castAb ? `Spellcasting modifier + proficiency.${!editable && isOwner ? ' Press it to roll a spell attack.' : ''}` : 'Choose a spellcasting ability to work it out.'}>
                  <div class:rolls-hover={castAb && !editable && isOwner}>
                    <h3>Spell Attack Bonus{#if castAb && !editable && isOwner}<DieMark label="Rolls a spell attack" />{/if}</h3>
                    {#if castAb && !editable && isOwner}
                      <button class="castval castroll" title="Roll a spell attack: d20 {sign(spellAttackBonus(definition, castAb))}"
                              use:bump={spellAttackBonus(definition, castAb)}
                              onclick={() => rollSkill('Spell attack', spellAttackBonus(definition, castAb))}>{sign(spellAttackBonus(definition, castAb))}</button>
                    {:else}
                      <p class="castval">{castAb ? sign(spellAttackBonus(definition, castAb)) : '—'}</p>
                    {/if}
                  </div>
                </Why>
              </div>

              <EntryTable
                items={definition.spells ?? []}
                lit={litLevel}
                columns={SPELL_COLUMNS}
                library="spells"
                check={{ key: 'prepared', label: 'Prepared', short: 'Prep' }}
                groupBy={{ key: 'level', rank: (spell) => spellRank(spell.level), title: (spell) => spellGroup(spell.level) }}
                {editable}
                category="spells"
                emptyText="No spells or abilities recorded."
                addLabel="Add spell"
                blank={() => ({ name: '' }) as Spell}
                onpress={isOwner ? (key, spell) => rollSpell(key, spell as Spell) : undefined}
                equip={{ key: 'name', can: !editable && isOwner,
                         shows: (sp) => isConcentration(sp as Spell),
                         isOn: (sp) => Boolean((sp as Spell).name) && sheetState?.concentrating === (sp as Spell).name,
                         labels: { off: 'C', on: 'C', hint: 'Concentration: press to mark it as held now (one spell at a time)' },
                         onpress: (i) => toggleConcentration(definition.spells[i]) }}
                marked={(sp) => Boolean((sp as Spell).name) && sheetState?.concentrating === (sp as Spell).name}
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
                library="items"
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
                library="features"
                groupBy={{ key: 'kind', rank: (f) => FEATURE_KINDS.indexOf(kindOf(f as Feature)),
                           title: (f) => kindOf(f as Feature) }}
                {editable}
                category="feats"
                spot={spotFeature}
                linkOf={$brewLoaded >= 0 ? (f) => featureUrl(f as Feature, definition.identity, classes) : undefined}
                emptyText="No features yet."
                addLabel="Add feature"
                blank={() => ({ title: '', body: '' }) as Feature}
                equip={{ key: 'effects', can: editable && isOwner, onpress: (i) => (effecting = i),
                         isOn: (f) => Boolean((f as Feature).effects?.length),
                         labels: { off: '+ Effect', on: 'Effects', hint: 'What it changes on the sheet' } }}
                onchange={(features) => setDefinition({ ...definition, features: features as Feature[] })}
              >
                {#snippet info()}
                  Class features, feats, and anything an item grants. Source <code>homebrew</code>
                  marks an entry as yours and drops the 5e.tools link.
                {/snippet}
              </EntryTable>
            {:else if tab === 'Trackers'}
              <EntryTable
                items={trackerRowsShown}
                columns={TRACKER_COLUMNS}
                library="trackers"
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
                  <code>pact()</code> are spell slots. <b>From</b> is the class, feat, or species
                  it comes from: a class makes <code>classlevel</code> that class's level (so
                  multiclassing doesn't inflate it) and links to the feature on 5e.tools; a feat
                  or species links to that.
                {/snippet}
              </EntryTable>
              {#if editable}
                <TrackerPresets {definition} makeId={newId} open={presetsOpen} onadd={addPreset} onremove={removePreset} />
              {/if}
            {:else if tab === 'Character'}
              {#if editable}
              <div data-flip-ghost="class:table">
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
              </div>
              {:else}
                <ClassCards {classes} />
              {/if}
              <h3 class="sub-h details-h">Details</h3>
              <DetailsBlock {definition} {editable} onchange={setDefinition} />
            {:else if tab === 'Notes'}
              {@render writing('notes', 'Notes')}
            {:else}
              {@render writing('backstory', 'Lore')}
            {/if}
          {/snippet}
        </Tabs>
      </section>

      <section class="panel rail-right" style:--i=4 data-places="play">
        <!-- On a phone, Play keeps the whole rail: the conditions, trackers,
             defenses, purse, proficiencies, and languages. -->
        <div class="railfight" data-places="play">
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
              books={[definition.identity.ancestrySource, definition.identity.backgroundSource]}
            />
          </div>
        {/if}

        <h2 class="cap defs-h">Defenses</h2>
        <div class="defense">
          <Why title="Armor Class" parts={ac.parts} total={String(ac.total)}
               hint={ac.computed ? 'Worked out from what is equipped.' : 'Nothing worn yet. Equip armor or a shield on the Equipment tab to change it.'}>
          <div class="defbox">
            <!-- Worked out, never typed: armor and shields are equipped on the Equipment tab. -->
            <b use:bump={ac.total}><span class="computed">{ac.total}</span></b>
            <span class="cap">Armor Class</span>
          </div>
          </Why>
          <!-- Worked out, never typed: Dexterity plus what items and features add. -->
          <Why title="Initiative" parts={initiativeParts(definition).parts} total={sign(initiative)}
               hint={[initAdv.length ? `Advantage from ${initAdv.join(', ')}.` : '', !editable && isOwner ? 'Press it to roll initiative (hold it to see this).' : ''].filter(Boolean).join(' ')}>
          <div class="defbox" class:rollable={!editable && isOwner}>
            <b use:bump={initiative}>
              {#if !editable && isOwner}
                <!-- Out of edit mode, initiative is a die to roll: the whole box is the button. -->
                <button class="rollnum" title="Roll initiative: d20 {sign(initiative)}{initAdv.length ? ' with advantage' : ''}" aria-label="Roll initiative"
                        onclick={() => rollSkill('Initiative', initiative, initAdv.length ? 'advantage' : 'normal')}>{sign(initiative)}</button>
              {:else}
                <span class="computed">{sign(initiative)}</span>
              {/if}
            </b>
            <span class="cap">Initiative</span>
            {#if !editable && isOwner}
              <!-- It rolls: the d20 in the corner. -->
              <svg class="d20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 20.5 7.4v9.2L12 21.5 3.5 16.6V7.4zM12 7.5l4.3 7.4H7.7zM12 2.5v5M20.5 7.4l-4.2 7.5M3.5 7.4l4.2 7.5M7.7 14.9 3.5 16.6M16.3 14.9l4.2 1.7M7.7 14.9 12 21.5l4.3-6.6" /></svg>
            {/if}
            {#if initAdv.length}<span class="adv" title="Advantage">ADV</span>{/if}
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
          <!-- Worked out: the species' walking speed (Character tab) plus what items and features add. -->
          <Why title="Speed" parts={speed.parts} total="{speed.total} ft."
               hint="The walking speed is set beside the species on the Character tab.">
          <div class="defbox">
            <b use:bump={speed.total}><span class="computed">{speed.total} ft.</span></b>
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

        </div>

        <div class="money">
          <h2 class="cap">Currency</h2>
          <Currency {definition} editable={editable} onchange={setDefinition} />
          <div class="carried">
            <span>Weight carried</span>
            <b>{carried > 0 ? carried : '—'}</b>
          </div>
        </div>

        <div class="profs" style:--rows={4} data-places="play">
          <h2 class="cap">Proficiencies</h2>
          <EditableField
            value={definition.traits?.proficiencies ?? ''}
            {editable}
            type="textarea"
            rows={4}
            label="Proficiencies"
            placeholder="—"
            hint="The armor, weapons, tools, and saves you are trained in."
            onchange={(v) =>
              setDefinition({
                ...definition,
                traits: { ...(definition.traits ?? {}), proficiencies: String(v) }
              })}
          />
        </div>

        <div class="profs" style:--rows={2} data-places="play">
          <h2 class="cap">Languages</h2>
          <EditableField
            value={definition.traits?.languages ?? ''}
            {editable}
            type="textarea"
            rows={2}
            label="Languages"
            placeholder="—"
            hint="Every language you speak, read, or sign."
            onchange={(v) =>
              setDefinition({
                ...definition,
                traits: { ...(definition.traits ?? {}), languages: String(v) }
              })}
          />
        </div>

      </section>
    </div>
  </div>

  <!-- Floating pieces sit outside the sheet's box but take its theme, so a
       toast's Undo is in the character's accent too. -->
  <div class="themed floats" style={themeStyle(themePreview ?? definition.identity.theme)}>
    {#if showKeys}<ShortcutHelp owner={isOwner} onclose={() => (showKeys = false)} />{/if}
    {#if appearanceOpen}
      <DimModal id="appearance-title" title="Appearance" wide closer onclose={() => { appearanceOpen = false; themePreview = null; }}>
        <LinksPanel {definition} editable={isOwner} onchange={setDefinition} onthemepreview={(hex) => (themePreview = hex)} />
      </DimModal>
    {/if}
    <Spotlight bind:open={searching} />
    <Flash message={flash} />
    {#if leaving}
      <LeaveDialog onstay={() => (leaving = null)}
                   onleave={() => { const t = leaving; leaving = null; letGo = true; if (t) goto(t).catch(() => location.assign(t)); }} />
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
    {#if effecting !== null && definition?.features?.[effecting]}
      {@const f = definition.features[effecting]}
      <EquipDialog item={{ name: f.title, effects: f.effects }} feature
                   onclose={() => (effecting = null)}
                   onsave={(effects) => {
                     setDefinition({ ...definition!, features: definition!.features.map((x, i) => (i === effecting ? { ...x, effects: effects.length ? effects : undefined } : x)) });
                     effecting = null;
                   }} />
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
    {#if phoneOn}<PhoneBar page="sheet:{id}" places={phonePlaces} active={place} onchoose={goPlace} themeCss={themeStyle(themePreview ?? definition.identity.theme)} />{/if}
  </div>
  </div>
  <!-- Only the printer shows this. Private writing a visitor cannot read is
       not passed in, so it is never on their paper either. -->
{/if}

<style>
  /* The heading fades in with the panels, and only on arrival: as a lasting
     rule, it played a second time the moment the arrival ended. In place,
     over the outline that held its spot: the page itself already rose in,
     and a second rise read as the sheet arriving twice. */
  @keyframes sheetFill { from { opacity: 0; } }
  .entering .identity { animation: sheetFill 0.3s ease-out backwards; }

  .loading { position: relative; }
  /* The sheet while its pictures settle: laid out and loading, under the outline, unseen. */
  .holder.holding { position: absolute; top: 0; left: 0; right: 0; visibility: hidden; pointer-events: none; }
  .loading > :global(.skel) { opacity: 0.45; }
    /* Not positioned: the banner inside it is meant to escape this column and
     run the width of the page. */
  .sheet { padding: var(--page-pad); max-width: var(--page-width); margin: 0 auto; }
  .panel {
    background: var(--surface); border: 1px solid var(--line-soft);
    border-radius: var(--r); padding: 1rem; min-width: 0;
  }
  /* With a banner behind it, a module stops being opaque and starts being
     frosted: the band's color carries through, the detail does not, and the
     text keeps the surface it needs. Only with a banner — an ordinary sheet
     pays none of this. */
  /* The frost is a layer under the module's content rather than the module
     itself: an element with a backdrop filter hides what is behind it from
     anything frosted inside it, so the notes' page bar (frosted, to blur the
     writing under it) came out a darker patch. */
  .bannered .panel {
    position: relative;
    z-index: 1;
    background: transparent;
    border-color: color-mix(in oklch, var(--line) 70%, transparent);
  }
  .bannered .panel::before {
    content: ''; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none;
    background: color-mix(in oklch, var(--surface) 76%, transparent);
    backdrop-filter: blur(16px) saturate(1.1);
    -webkit-backdrop-filter: blur(16px) saturate(1.1);
  }
  /* Every section sits above the hurt edges (z-index 0), so the red only
     ever colors the background between and around them. */
  .identity, .band, .main { position: relative; z-index: 1; }
  /**
   * The class line is secondary text, and secondary text is a mid gray. Over
   * a photograph that is unreadable at any tint which still shows the
   * photograph: dim gray needs a backdrop darker than the banner can be and
   * still be seen. So on a sheet with a banner it is not secondary any more.
   * Measured over a deliberately bright test image rather than guessed.
   */
  .bannered .sub { color: var(--text); }
  .bannered .sub :global(.field.readout.empty) { color: var(--label); }
  /* On a phone the frost is dropped for a nearly solid module: blurring the
     banner behind every module again on each animated frame (a gauge, a pip,
     a condition's tint) is what made changes stutter there. */
  @media (max-width: 720px), (pointer: coarse) {
    .bannered .panel::before {
      backdrop-filter: none; -webkit-backdrop-filter: none;
      background: color-mix(in oklch, var(--surface) 93%, transparent);
    }
  }
  /* A light page: white frost let a bright picture wash the words out; more solid there. */
  :global([data-mode='light']) .bannered .panel::before { background: color-mix(in oklab, var(--surface) 90%, transparent); }
  /* No backdrop-filter, no frost: the module stays readable by being solid. */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .bannered .panel::before { background: var(--surface); }
  }
  .cap {
    display: block; font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--label); font-weight: 600; margin: 0;
  }

  .identity { display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .portrait {
    width: 6rem; aspect-ratio: 1; border-radius: var(--r);
    flex: none; display: flex; align-items: flex-end; justify-content: center;
    position: relative; overflow: visible;
  }
  .portrait img {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover;
  }
  /*
   * The frame and its wash stay still; the picture inside (or the class
   * drawn) turns toward the pointer like a coin (motion.ts parallax sets
   * --px/--py from -1 to 1 and --pz while pointed at), a little larger so no
   * edge shows, with a soft shine where the light catches it, and eases flat
   * again on leaving. The level badge stays put below it.
   */
  .frame {
    position: absolute; inset: 0; overflow: hidden; border-radius: inherit;
    border: 1px solid var(--a-edge);
    background: linear-gradient(150deg, var(--portrait-from), var(--portrait-to));
    perspective: 420px;
  }
  .frame > :global(img), .frame > :global(.class-icon) {
    transform:
      rotateY(calc(var(--px, 0) * 14deg))
      rotateX(calc(var(--py, 0) * -14deg))
      scale(calc(1 + var(--pz, 0) * 0.12));
    transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), filter 0.8s ease;
  }
  .frame::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(
      circle at calc(50% + var(--px, 0) * 45%) calc(50% + var(--py, 0) * 45%),
      rgb(255 255 255 / 0.28), transparent 60%
    );
    opacity: var(--pz, 0);
    transition: opacity 0.45s ease;
    mix-blend-mode: soft-light;
  }
  /* Quick to follow the pointer; slow to settle back once it leaves. */
  .portrait:hover .frame > :global(img), .portrait:hover .frame > :global(.class-icon) { transition-duration: 0.18s, 0.8s; }
  /* Sits on the bottom edge, half in and half out. */
  .lvl {
    position: absolute; left: 50%; bottom: 0; transform: translate(-50%, 50%); z-index: 2;
    background: var(--surface); border: 1px solid var(--a-edge);
    color: var(--a); border-radius: var(--r-sm); font-size: 0.6875rem; font-weight: 650;
    padding: 0.0625rem 0.5rem; letter-spacing: 0.02em; white-space: nowrap;
  }
  /* Dead: the portrait drains of color. */
  .portrait.fallen img { filter: grayscale(1) brightness(0.65); }
  /* Dead: a big skull in front of the grayed portrait, not a badge. */
  .skull {
    position: absolute; inset: 0; z-index: 1; border-radius: var(--r);
    display: grid; place-items: center; pointer-events: none;
    background: radial-gradient(circle, oklch(10% 0.01 25 / 0.55) 0%, oklch(10% 0.01 25 / 0.15) 70%);
    color: oklch(94% 0.01 286);
    animation: skullIn 0.7s cubic-bezier(0.33, 1, 0.68, 1);
  }
  .skull svg {
    width: 62%; height: 62%;
    filter: drop-shadow(0 0 10px oklch(60% 0.22 25 / 0.85)) drop-shadow(0 2px 2px rgb(0 0 0 / 0.6));
  }
  @keyframes skullIn { from { transform: scale(1.6); opacity: 0; } }
  .idleft { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 1rem; }
  .who { flex: 1 1 auto; min-width: 0; }
  .controls { display: flex; align-items: center; gap: 0.75rem; flex: none; }
  .ctlrow { display: flex; align-items: center; justify-content: flex-end; gap: 0.375rem; }
  /* Edit and the cog as icons, as tall as the rest. */
  .iconbtn { box-sizing: border-box; width: 2rem; height: 2rem; min-width: 0; padding: 0; display: inline-grid; place-items: center; }
  .iconbtn svg { display: block; }
  .keys.gear { display: inline-grid; }
  /* The cog turns a little on hover, and a quarter turn while its window is open (as the campaign's). */
  .gear :global(svg) { transition: transform 0.45s cubic-bezier(0.33, 1, 0.68, 1); }
  .gear:hover :global(svg) { transform: rotate(45deg); }
  .gear.open :global(svg) { transform: rotate(90deg); }
  @media (prefers-reduced-motion: reduce) { .gear :global(svg) { transition: none; } }
  /* The player sits in the very middle of the header: the name and the
     buttons each take an equal share either side of it (the buttons never
     less than they need). */
  .musicslot { display: flex; justify-content: center; min-width: 0; }
  @media (min-width: 1101px) {
    /* The middle is the player's own width (19rem, MusicPlayer): sized by its content, a long song's name would widen it. */
    .identity:has(.musicslot) { display: grid; grid-template-columns: minmax(0, 1fr) 19rem minmax(max-content, 1fr); }
    .identity:has(.musicslot) .controls { justify-self: end; }
  }
  /* Without room for all three in a row, the player takes a row of its own
     under the header, full width. */
  @media (max-width: 1100px) {
    .musicslot { order: 5; flex: 1 1 100%; }
    .musicslot :global(.music) { width: 100%; }
  }
  .who h1 { margin: 0; font-size: 1.75rem; font-weight: 600; letter-spacing: -0.015em; }
  .campaign {
    display: flex; align-items: center; gap: 0.375rem; margin-bottom: 0.1875rem; min-width: 0;
    font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--a);
  }
  .campaign svg { flex: none; }
  .campaign > span { overflow-wrap: anywhere; }
  /* The campaign it is in opens with a press: a small pill, not bare text. */
  .campaign a {
    color: inherit; text-decoration: none; overflow-wrap: anywhere; border: 1px solid var(--a-edge); border-radius: 999px;
    padding: 0.0625rem 0.5rem; background: color-mix(in oklab, var(--a) 9%, transparent);
    transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
  }
  .campaign a:hover { background: color-mix(in oklab, var(--a) 17%, transparent); border-color: var(--a); }
  /* A light page over a banner: the pill is solid, so its name reads on any picture. */
  :global([data-mode='light']) .bannered .campaign :is(a, .retired) { background: color-mix(in oklab, var(--a) 8%, var(--surface)); }
  :global([data-mode='light']) .bannered .campaign a:hover { background: color-mix(in oklab, var(--a) 16%, var(--surface)); }
  .campaign a:active { transform: translateY(1px); }
  .campaign a:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
  .campaign .retired {
    color: var(--dim); border: 1px solid var(--line); border-radius: 999px; padding: 0 0.4375rem;
    font-size: 0.625rem; letter-spacing: 0.1em;
  }
  /* In edit mode the label is a button that opens the campaign dialog. */
  button.campaign {
    font: inherit; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
    background: color-mix(in oklab, var(--a) 6%, transparent); border: 1px dashed var(--a-edge); border-radius: 999px; padding: 0.125rem 0.625rem 0.125rem 0.5rem;
    color: var(--a); cursor: pointer; transition: background-color 0.15s ease, border-color 0.15s ease;
  }
  button.campaign:hover { background: var(--a-wash); border-style: solid; }
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
    border-radius: var(--r-sm); font: inherit; cursor: pointer; flex: none;
  }
  .edit:hover { border-color: var(--a-edge); color: var(--a); }
  /* Editing: lit in the accent, its check showing. */
  .edit[aria-pressed='true'] { border-color: var(--a-edge); color: var(--a); background: var(--a-wash); }
  .edit[aria-pressed='true']:hover { border-color: var(--a); background: var(--a-edge); color: var(--text); }
  .edit { transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.08s ease; }
  .edit:active { transform: translateY(1px); }
  .edit:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
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
  .center { display: flex; flex-direction: column; }
  /* Wide screens: the middle module is exactly as tall as the taller column
     beside it, whatever tab is open; what is longer scrolls inside it, and a
     wheel that has nothing left to scroll there moves the page. */
  @media (min-width: 1280px) {
    .center { height: 0; min-height: 100%; }
  }
  /* Between a phone's one column and the three of a wide screen (a tablet, a narrow window): two.
     The tabs and the right rail side by side, the skills under the tabs, and the hit points above
     the abilities until both fit in one row; three columns squeezed the middle until its table
     and the hit point buttons ran out of room. */
  @media (min-width: 861px) and (max-width: 1279px) {
    .main {
      grid-template-columns: minmax(0, 1fr) 18.75rem; grid-template-areas: 'center right' 'skills right';
      align-items: start;
    }
    .center { grid-area: center; }
    .rail-skills { grid-area: skills; }
    .rail-right { grid-area: right; }
  }
  @media (min-width: 861px) and (max-width: 1179px) {
    .band { grid-template-columns: 1fr; }
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
     The field sets its own color, so the rule has to reach inside it. */
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
  .defbox.rollable { position: relative; cursor: pointer; transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.2s cubic-bezier(0.33, 1, 0.68, 1), box-shadow 0.2s ease; }
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
    transition: color 0.2s ease, transform 0.35s cubic-bezier(0.33, 1, 0.68, 1); pointer-events: none;
  }
  .defbox.rollable:hover .d20 { color: var(--a); transform: rotate(72deg) scale(1.2); }
  .defbox .adv {
    position: absolute; left: 0.375rem; top: 0.375rem; font-size: 0.4375rem; font-weight: 700; letter-spacing: 0.05em;
    padding: 0 0.1875rem; border-radius: 2px; line-height: 1.5; color: var(--good, var(--a)); background: color-mix(in oklch, var(--good, var(--a)) 16%, transparent);
  }
  .defbox:has(.adv) { position: relative; }
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
  .rail-right > :global(:first-child), .rail-right > .railfight > :global(:first-child) { padding-top: 0; }
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
    /* Always three across, centered, so the third never sits alone on a row. */
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
  .casting h3 { display: flex; align-items: center; justify-content: center; }
  /* The spell attack rolls: the same pill as initiative's number. */
  .castroll {
    font: inherit; font-size: 1.0625rem; font-weight: 600; color: var(--text); cursor: pointer; background: none;
    border-radius: var(--r-sm); padding: 0.15rem 0.625rem; border: 1px solid transparent;
    transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, transform 0.08s ease;
  }
  .castroll:hover { color: var(--a); background: var(--a-wash); border-color: var(--a-edge); }
  .castroll:active { transform: translateY(1px); }
  .castroll:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
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
  /* Opening a sheet: the panels fill in one after another, where the outline had them. */
  .entering .panel { animation: sheetFill 0.4s ease-out backwards; animation-delay: calc(var(--i, 0) * 60ms); }
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
  /* The search is for everyone: its button shows on every screen. */
  .keys.searchbtn { display: inline-grid; }
  /* Shortcuts are for a keyboard: the button only shows where there is a mouse. */
  .keys {
    display: none; place-items: center; width: 2rem; height: 2rem; flex: none; padding: 0;
    background: var(--raised); border: 1px solid var(--line); border-radius: var(--r-sm);
    color: var(--text); cursor: pointer; transition: border-color 0.18s ease, color 0.18s ease, transform 0.08s ease;
  }
  .keys:hover { border-color: var(--a-edge); color: var(--a); }
  .keys:active { transform: translateY(1px); }
  /* The magnifier leans in to look, the keyboard's keys lift, as the cog turns. */
  .searchbtn svg, .kbd svg { transition: transform 0.4s cubic-bezier(0.33, 1, 0.68, 1); }
  .searchbtn:hover svg { transform: rotate(-14deg) scale(1.1); }
  .kbd:hover svg { transform: translateY(-1.5px) scale(1.06); }
  @media (prefers-reduced-motion: reduce) { .searchbtn svg, .kbd svg { transition: none; } }
  @media (hover: hover) and (pointer: fine) { .keys { display: inline-grid; } }
  @media (max-width: 860px) {
    .sheet { padding: 0.875rem; }
    .band, .main { grid-template-columns: 1fr; }
    /* Proficiencies, languages, and senses are long free text; at 13px they
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
  /*
   * A phone: the campaign across the top, so a long name has the room; then
   * the portrait at the left edge and the name with the class, species, and
   * background at the right edge (their words still left-aligned), together
   * in the middle of its height; then the music, the width of the screen. The controls are in the top bar. (Wrapped
   * as a row, the portrait sat alone above the name.)
   */
  @media (max-width: 700px) {
    /* The portrait at the left edge and the words at the right, with room between; the campaign
       and the music span both columns and the room between them, edge to edge. */
    .identity { display: grid; grid-template-columns: 5.5rem minmax(0, max-content); justify-content: space-between; column-gap: 1.25rem; row-gap: 0.25rem; align-items: center; }
    .identity .portrait { width: 5.5rem; grid-column: 1; grid-row: 2 / 4; align-self: center; }
    .identity .idleft, .identity .who { display: contents; }
    .identity .who > h1 { grid-column: 2; grid-row: 2; align-self: end; min-width: 0; }
    .identity .who > .sub { grid-column: 2; grid-row: 3; align-self: start; margin-top: 0.125rem; }
    .identity .who > .campaign { grid-column: 1 / -1; grid-row: 1; align-self: start; justify-self: center; margin: 0 0 0.875rem; max-width: 100%; }
    /* A long campaign name wraps inside its pill: a rounded box, not a
       stretched capsule, with a little less spacing between the letters. */
    .identity .campaign { letter-spacing: 0.08em; line-height: 1.35; }
    .identity .campaign a, .identity button.campaign { border-radius: var(--r-sm); padding: 0.1875rem 0.5rem; }
    /* Below the portrait's level badge, as wide as the screen. */
    .identity .musicslot { grid-column: 1 / -1; grid-row: 4; justify-self: stretch; margin-top: 1rem; }
  }

  /* ── A phone's places (the rules for showing one are in app.css) ── */
  .railfight { display: contents; }
  /* With no tab row above it (a place with one tab), the tab starts at the panel's top. */
  .sheet[data-place]:not([data-place='more']) .center :global(section[role='tabpanel']) { padding-top: 0; }
  /* A place's modules run from the shortest to the longest: in Play the
     numbers and conditions before the attacks. */
  .sheet[data-place='play'] .rail-right { order: -1; }
  .sheet[data-place]:not([data-place='play']) :global(.sheetinit) { margin-top: 0.25rem; }

  /* More's top, for a visitor: when the sheet was made and last touched. */
  .phonetools { display: flex; justify-content: center; margin-bottom: 0.75rem; }
  .phonetools .stamps { margin: 0; }
</style>
