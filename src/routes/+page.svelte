<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import AuthForm from '$lib/components/AuthForm.svelte';
  import ModeToggle from '$lib/components/ModeToggle.svelte';
  import SoundToggle from '$lib/components/SoundToggle.svelte';
  import { sheetName, sheetRepo } from '$lib/data/sheets';
  import { campaignMessage, campaignRepo, type Campaign } from '$lib/data/campaigns';
  import { MAX_BYTES, importSheet } from '$lib/exchange';
  import { pinnedCampaignsOf, pinnedJoinedOf, pinnedOf, profileOf, savePinned, savePinnedCampaigns, savePinnedJoined, signIn, updateProfile } from '$lib/data/session';
  import { fade, slide } from 'svelte/transition';
  import { tick } from 'svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import Logo from '$lib/components/Logo.svelte';
  import { friendlyError } from '$lib/errors';
  import { friendlyDate, numericDate, sessionWhen } from '$lib/rules/dates';
  import { pageTitle } from '$lib/title';
  import { profile } from '$lib/stores/profile';
  import { watchTable, type Here } from '$lib/presence';
  import { paginate, type PageSize } from '$lib/rules/paging';
  /** A group's name above its cards, with the space around it. */
  const GROUP_NAME_H = 40;
  import { faceFamily, fontFace } from '$lib/rules/fonts';
  import D20Loader from '$lib/components/D20Loader.svelte';
  import MenuSkeleton from '$lib/components/MenuSkeleton.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import ClassIcon from '$lib/components/ClassIcon.svelte';
  import { armorClass, characterLevel, classLine, mainClass } from '$lib/rules/derived';
  import { vitalStatus } from '$lib/rules/hp';
  import { lookOf } from '$lib/rules/conditions';
  import { resolveImageUrl } from '$lib/rules/imageUrl';
  import { themeStyle } from '$lib/theme';
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { arrive, prefersReducedMotion, rise } from '$lib/motion';
  import { blankDefinition, blankState } from '$lib/sample';
  import { session } from '$lib/stores/session';
  import { isConfigured } from '$lib/supabase';
  import type { Sheet } from '$lib/types';

  // A player with no name yet is asked for one here; then, once, for a picture.
  let nameDraft = $state('');
  let savingName = $state(false);
  async function saveName() {
    const name = nameDraft.trim();
    if (!name || !$session.user) return;
    savingName = true;
    try {
      await updateProfile({ displayName: name });
    } catch (e) {
      error = friendlyError(e, 'Your name didn’t stick! Try again.');
    } finally {
      savingName = false;
    }
  }

  /** A new page of cards slides in from the side of the button pressed. */
  function pageSlide(_node: Element) {
    const dx = 18 * pageDirection;
    return {
      duration: prefersReducedMotion() ? 0 : 260,
      easing: cubicOut,
      css: (t: number, u: number) => `opacity: ${t}; transform: translate3d(${u * dx}px, 0, 0);`
    };
  }

  /** A deleted sheet folds away: fades, slides aside and closes its gap. */
  function fold(node: Element) {
    const h = (node as HTMLElement).offsetHeight;
    return {
      duration: prefersReducedMotion() ? 0 : 280,
      easing: cubicOut,
      css: (t: number, u: number) =>
        `opacity: ${t}; transform: translateX(${-12 * u}px); height: ${t * h}px; overflow: hidden;`
    };
  }

  /** Which of the three faces of this page is showing; signing in or out
      swaps one for another, and the swap is worth animating. */
  const view = $derived(
    !isConfigured ? 'list' : $session.loading ? 'loading' : $session.user ? 'list' : 'auth'
  );

  let sheets = $state<Sheet[]>([]);
  let loading = $state(false);
  /** The die has landed: the list shows. */
  let listShown = $state(false);
  /** Everything loaded and the die has landed: the lists show, all at once. */
  const ready = $derived(listShown && !loading);
  let error = $state<string | null>(null);
  let creating = $state(false);
  /** id of the sheet awaiting confirmation; deleting is permanent. */
  let confirming = $state<string | null>(null);
  let deleting = $state<string | null>(null);
  let importing = $state(false);
  let picker = $state<HTMLInputElement>();
  /** Campaign names by id, for the sheets' cards; and the campaigns run here. */
  let campaignNames = $state(new Map<string, string>());
  let running = $state<Campaign[]>([]);
  /** The campaigns this player's characters are in, run by someone else. */
  let joined = $state<Campaign[]>([]);
  /** The fonts the DMs chose for their campaigns' names, each loaded once. */
  const campaignFaces = $derived([...new Set([...running, ...joined].map((c) => fontFace(c.details?.nameFont)?.href).filter(Boolean) as string[])]);
  /** Each campaign's name font by id, for the sheets' cards. */
  const campaignFont = $derived(new Map([...running, ...joined].map((c) => [c.id, faceFamily(fontFace(c.details?.nameFont))])));
  /** The fonts the players chose for their characters' names, each loaded once. */
  const sheetFaces = $derived([...new Set(sheets.map((s) => fontFace(s.definition?.identity?.nameFont)?.href).filter(Boolean) as string[])]);
  let naming = $state(false);
  let newCampaign = $state('');
  let starting = $state(false);
  async function startCampaign() {
    if (!newCampaign.trim()) return;
    starting = true;
    error = null;
    try {
      const made = await campaignRepo.create(newCampaign.trim());
      await goto(`${base}/c/${made.id}`);
    } catch (e) {
      error = campaignMessage(e, 'The campaign wouldn’t start! Try again in a moment.');
    } finally {
      starting = false;
    }
  }
  /** What a sheet's card is called: its character's name, or the sheet's. */
  const nameOf = (sheet: Sheet) => sheet.definition?.identity?.name || sheet.name;
  /** The campaign a sheet's card names: its campaign's, or what was typed before campaigns. */
  /** "White Hat Gunslinger 5"; a multiclass already names each level ("Ranger 3 / Rogue 1"). */
  function classWithLevel(sheet: Sheet): string {
    const def = sheet.definition;
    const line = def ? classLine(def) : '';
    if (!def || !line) return 'No class';
    return /\d/.test(line) ? line : `${line} ${characterLevel(def)}`;
  }
  const campaignOf = (sheet: Sheet) =>
    (sheet.campaign_id && campaignNames.get(sheet.campaign_id)) || sheet.definition?.identity?.campaign?.trim() || '';
  /** What the last import had to leave out, shown beside the new sheet. */
  let notice = $state<string | null>(null);

  /**
   * Pinned sheets and campaigns sit on top in the player's own order (pinned
   * sheets cannot be deleted until unpinned). The rest follow: sheets most
   * recently updated first, campaigns oldest first. Retired sheets and ended
   * campaigns go last, in a group of their own, pinned or not.
   */
  type Kind = 'sheets' | 'campaigns' | 'joined';
  let pinned = $state<string[]>([]);
  let pinnedCamps = $state<string[]>([]);
  let pinnedJoinedIds = $state<string[]>([]);
  $effect(() => {
    pinned = pinnedOf($profile);
    pinnedCamps = pinnedCampaignsOf($profile);
    pinnedJoinedIds = pinnedJoinedOf($profile);
  });
  const pinsOf = (kind: Kind) => (kind === 'sheets' ? pinned : kind === 'campaigns' ? pinnedCamps : pinnedJoinedIds);
  function setPins(kind: Kind, ids: string[]) {
    if (kind === 'sheets') pinned = ids;
    else if (kind === 'campaigns') pinnedCamps = ids;
    else pinnedJoinedIds = ids;
  }
  const byId = $derived(new Map(sheets.map((s) => [s.id, s])));
  const pinnedSheets = $derived(pinned.map((id) => byId.get(id)).filter((s): s is Sheet => Boolean(s && !s.retired)));
  const byRecent = (a: Sheet, b: Sheet) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
  const otherSheets = $derived(sheets.filter((s) => !s.retired && !pinned.includes(s.id)).sort(byRecent));
  const retiredSheets = $derived(sheets.filter((s) => s.retired).sort(byRecent));
  const campById = $derived(new Map(running.map((c) => [c.id, c])));
  const pinnedCampaigns = $derived(
    pinnedCamps.map((id) => campById.get(id)).filter((c): c is Campaign => Boolean(c && !c.archived))
  );
  const otherCampaigns = $derived(running.filter((c) => !c.archived && !pinnedCamps.includes(c.id)));
  const endedCampaigns = $derived(running.filter((c) => c.archived));
  const joinedById = $derived(new Map(joined.map((c) => [c.id, c])));
  const pinnedJoined = $derived(
    pinnedJoinedIds.map((id) => joinedById.get(id)).filter((c): c is Campaign => Boolean(c && !c.archived))
  );
  const otherJoined = $derived(joined.filter((c) => !c.archived && !pinnedJoinedIds.includes(c.id)));
  const endedJoined = $derived(joined.filter((c) => c.archived));
  /** This player's characters in a campaign (retired ones too: they were there). */
  const charactersIn = (c: Campaign) => sheets.filter((s) => s.campaign_id === c.id);

  async function setPinned(next: string[], kind: Kind = 'sheets') {
    const previous = pinsOf(kind);
    setPins(kind, next);
    try {
      await (kind === 'sheets' ? savePinned(next) : kind === 'campaigns' ? savePinnedCampaigns(next) : savePinnedJoined(next));
    } catch (e) {
      setPins(kind, previous);
      error = friendlyError(e, 'That pin didn’t stick! Try again in a moment.');
    }
  }
  function togglePin(id: string, kind: Kind = 'sheets') {
    if (confirming === id) confirming = null;
    const list = pinsOf(kind);
    void setPinned(list.includes(id) ? list.filter((p) => p !== id) : [...list, id], kind);
  }

  /**
   * Leaving a campaign from here takes every one of this player's characters
   * out of it, the way each sheet's own Leave does.
   */
  let leavingId = $state<string | null>(null);
  async function leave(c: Campaign) {
    leavingId = c.id;
    error = null;
    try {
      for (const s of charactersIn(c)) {
        const stamp = await sheetRepo.saveRow(s.id, { campaign_id: null }, s.updated_at);
        sheets = sheets.map((x) => (x.id === s.id ? { ...x, campaign_id: null, updated_at: stamp } : x));
      }
      joined = joined.filter((x) => x.id !== c.id);
      confirming = null;
    } catch (e) {
      error = friendlyError(e, 'The campaign held on to you! Try leaving again.');
    } finally {
      leavingId = null;
    }
  }

  // Dragging a pinned card by its grip. The cards may sit in a grid (a wide
  // screen), so a card goes to the place whose middle is nearest its own,
  // and the others slide to their new places, across as well as down.
  let rowEls = $state<Record<string, HTMLElement>>({});
  type Point = { x: number; y: number };
  let drag = $state<{ kind: Kind; id: string; from: number; to: number; dx: number; dy: number; centres: Point[]; start: Point; pointerId: number } | null>(null);
  let landing = $state(false);
  const pinnedIds = (kind: Kind) => (kind === 'sheets' ? pinnedSheets : kind === 'campaigns' ? pinnedCampaigns : pinnedJoined).map((x) => x.id);
  function grab(event: PointerEvent, id: string, kind: Kind = 'sheets') {
    const ids = pinnedIds(kind);
    if (event.button !== 0 || ids.length < 2) return;
    const centres = ids.map((k) => {
      const r = rowEls[k]?.getBoundingClientRect();
      return r ? { x: r.left + window.scrollX + r.width / 2, y: r.top + window.scrollY + r.height / 2 } : null;
    });
    // A pinned card on another page cannot be dragged past.
    if (centres.some((c) => !c)) return;
    event.preventDefault();
    const from = ids.indexOf(id);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    drag = { kind, id, from, to: from, dx: 0, dy: 0, centres: centres as Point[], start: { x: event.clientX + window.scrollX, y: event.clientY + window.scrollY }, pointerId: event.pointerId };
  }
  function moveDrag(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX + window.scrollX - drag.start.x;
    const dy = event.clientY + window.scrollY - drag.start.y;
    const at = { x: drag.centres[drag.from].x + dx, y: drag.centres[drag.from].y + dy };
    let to = drag.from;
    let best = Infinity;
    drag.centres.forEach((c, i) => {
      const d = Math.hypot(c.x - at.x, c.y - at.y);
      if (d < best) { best = d; to = i; }
    });
    drag.dx = dx;
    drag.dy = dy;
    drag.to = to;
  }
  async function dropDrag(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { from, to, kind } = drag;
    landing = true;
    drag = null;
    if (from !== to) {
      const ids = pinnedIds(kind);
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
      await setPinned(ids, kind);
    }
    await tick();
    requestAnimationFrame(() => (landing = false));
  }
  /** Where a pinned card is drawn while another is dragged: at the place it will take. */
  function shift(id: string): string | undefined {
    if (!drag) return undefined;
    if (id === drag.id) return `translate(${drag.dx}px, ${drag.dy}px)`;
    const ids = pinnedIds(drag.kind);
    const i = ids.indexOf(id);
    if (i < 0) return undefined;
    const order = ids.filter((_, k) => k !== drag!.from);
    order.splice(drag.to, 0, drag.id);
    const j = order.indexOf(id);
    const a = drag.centres[i];
    const b = drag.centres[j];
    return `translate(${b.x - a.x}px, ${b.y - a.y}px)`;
  }

  /*
   * The page has three areas, one shown at a time: the player's characters,
   * the campaigns they play in, and the campaigns they run. Each is cut into
   * pages that fit the screen, so nothing is scrolled through.
   */
  const AREA_SHEETS = 'Characters';
  /** The campaigns this player runs and the ones their characters joined, together. */
  const AREA_CAMPAIGNS = 'Campaigns';
  const areaTabs = [AREA_SHEETS, AREA_CAMPAIGNS];
  let area = $state(AREA_SHEETS);
  /* The area in the address (#characters) is opened once the lists are in. */
  let areaRead = false;
  $effect(() => {
    if (!ready || areaRead || typeof location === 'undefined') return;
    areaRead = true;
    const wanted = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    // Old links named the two campaign areas apart.
    if (/campaigns$/.test(wanted)) area = AREA_CAMPAIGNS;
    else if (wanted === AREA_SHEETS.toLowerCase()) area = AREA_SHEETS;
  });

  /** `kind`: whose pins a pinned group's cards are, where it differs from the list's. */
  type Group<T> = { key: string; label: string; items: T[]; pinned?: boolean; faded?: boolean; kind?: Kind };
  /** The room below the list for a page of cards, a row's height, and cards to a row (lib/rules/paging.ts). */
  let pageSize = $state<PageSize>({ room: 600, rowH: 120, nameH: GROUP_NAME_H, cols: 2 });
  /** The height a full page takes, so a short last page does not pull the pager up. */
  let pageHeight = $state(0);
  let pages = $state<Record<string, number>>({});
  /** Which way a new page slides in: from the side of the button pressed. */
  let pageDirection = $state(1);

  function groupsOf<T>(pinnedList: T[], rest: T[], faded: T[], fadedLabel: string): Group<T>[] {
    const labelled = pinnedList.length > 0 || faded.length > 0;
    return [
      { key: 'pinned', label: 'Pinned', items: pinnedList, pinned: true },
      { key: 'rest', label: labelled ? 'Everything else' : '', items: rest },
      { key: 'faded', label: fadedLabel, items: faded, faded: true }
    ];
  }
  /** The groups cut into pages by rows (lib/rules/paging.ts). */
  const pagesOf = <T,>(groups: Group<T>[]) => paginate(groups, pageSize);
  const pageCount = (groups: Group<unknown>[]) => pagesOf(groups).length;
  const pageIn = (key: string, groups: Group<unknown>[]) => Math.min(pages[key] ?? 0, pageCount(groups) - 1);
  function turn(key: string, to: number) {
    pageDirection = to > (pages[key] ?? 0) ? 1 : -1;
    pages = { ...pages, [key]: to };
    confirming = null;
  }

  const sheetGroups = $derived(groupsOf(pinnedSheets, otherSheets, retiredSheets, 'Retired'));
  /*
   * The campaigns area: the ones run here first, then the ones joined, each
   * with its own pins; the ended ones of both last. With only one sort, it
   * reads like the characters (Pinned, Everything else, Archived).
   */
  const campaignGroups = $derived.by((): Group<Campaign>[] => {
    if (!joined.length) return groupsOf(pinnedCampaigns, otherCampaigns, endedCampaigns, 'Archived');
    if (!running.length) return groupsOf(pinnedJoined, otherJoined, endedJoined, 'Archived').map((g) => ({ ...g, kind: 'joined' as Kind }));
    return [
      { key: 'run-pinned', label: 'Owned, pinned', items: pinnedCampaigns, pinned: true },
      { key: 'run', label: 'Owned', items: otherCampaigns },
      { key: 'joined-pinned', label: 'Joined, pinned', items: pinnedJoined, pinned: true, kind: 'joined' },
      { key: 'joined', label: 'Joined', items: otherJoined, kind: 'joined' },
      { key: 'faded', label: 'Archived', items: [...endedCampaigns, ...endedJoined], faded: true }
    ];
  });
  /** Who has each campaign's page open (lib/presence.ts), for the cards' right side. */
  let tables = $state<Record<string, Here>>({});
  const watched = $derived([...running, ...joined].filter((c) => !c.archived).map((c) => c.id).sort().join(','));
  $effect(() => {
    const ids = watched ? watched.split(',') : [];
    const stops = ids.map((id) => watchTable(id, (here) => (tables = { ...tables, [id]: here })));
    return () => stops.forEach((stop) => stop());
  });

  /** Run here (not joined): its DM is this player. */
  const isMine = (c: Campaign) => running.some((r) => r.id === c.id);
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
  const campaignTally = $derived(
    running.length && joined.length ? `${running.length} owned · ${joined.length} joined` : plural(running.length + joined.length, 'campaign')
  );

  /**
   * Measures the room for a page of cards: from the top of the list to the
   * foot of the screen, less the pager; with a row's height and the columns
   * the grid has at this width, the paginator fills it. Again on every resize.
   */
  function fit(node: HTMLElement) {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const list = node.querySelector('ul');
        const cols = list ? getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length || 1 : 1;
        const gap = list ? parseFloat(getComputedStyle(list).rowGap) || 8 : 8;
        // The tallest card on the page, so a page of them never runs past
        // the screen (cards are mostly one height, the portrait square sets it).
        const heights = [...node.querySelectorAll('li')].map((li) => li.getBoundingClientRect().height).filter(Boolean);
        const rowH = (heights.length ? Math.max(...heights) : 66) + gap;
        const top = node.getBoundingClientRect().top + window.scrollY;
        // Under the list: the pager, and the page's own space at its foot.
        const foot = parseFloat(getComputedStyle(node.closest('main') ?? node).paddingBottom) || 0;
        const room = Math.max(window.innerHeight - top - 60 - foot, GROUP_NAME_H + 2 * rowH);
        // (The last row needs no gap under it.)
        pageSize = { room: room + gap, rowH, nameH: GROUP_NAME_H, cols };
        pageHeight = room;
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return {
      destroy() {
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', measure);
      }
    };
  }

  /* By id, not by user: saving a pin or a profile updates the user, and
     that must not reload the whole list. */
  const userId = $derived($session.user?.id ?? null);
  $effect(() => {
    const id = userId;
    if (!id) {
      sheets = [];
      return;
    }
    loading = true;
    listShown = false;
    // Everything the page lists arrives together, so the lists appear at once
    // instead of one after another, each pushing the next down the page.
    Promise.all([sheetRepo.listMySheets(id), campaignRepo.mine(id).catch(() => [])])
      .then(async ([rows, mine]) => {
        const ids = rows.map((r) => r.campaign_id ?? '');
        const [names, theirs] = await Promise.all([
          campaignRepo.names(ids).catch(() => new Map<string, string>()),
          campaignRepo.byIds(ids).catch(() => [])
        ]);
        sheets = rows;
        running = mine;
        campaignNames = names;
        joined = theirs.filter((c) => c.created_by !== id);
      })
      .catch((e) => (error = friendlyError(e, 'Your sheets wouldn’t load! Try again in a moment.')))
      .finally(() => (loading = false));
  });

  async function remove(id: string) {
    deleting = id;
    error = null;
    try {
      await sheetRepo.deleteSheet(id);
      sheets = sheets.filter((s) => s.id !== id);
      confirming = null;
    } catch (e) {
      error = friendlyError(e, 'That sheet refused to leave! Try deleting it again.');
    } finally {
      deleting = null;
    }
  }

  /**
   * A file made by Export. It always becomes a new sheet: bringing a backup in
   * never overwrites a character that is already here.
   */
  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const user = $session.user;
    if (!file || !user) return;
    error = null;
    notice = null;
    if (file.size > MAX_BYTES) {
      error = 'That file is far too heavy to be a character sheet!';
      return;
    }
    importing = true;
    try {
      const result = importSheet(await file.text());
      if (!result.ok) {
        error = result.error;
        return;
      }
      const { definition, state, texts } = result.value;
      // Where the writing goes depends on whether the database can keep it
      // private: in its own rows if so, in the sheet as before if not.
      const separate = await sheetRepo.textsAvailable();
      // Without the table for it, nothing can be private, so nothing is marked so.
      const { privateText: _p, ...open } = definition;
      const stored = separate
        ? definition
        : { ...open, notes: texts.notes.body, backstory: texts.backstory.body };
      const sheet = await sheetRepo.createSheet(user.id, sheetName(stored), stored, state);
      if (separate) {
        for (const key of ['notes', 'backstory'] as const) {
          const t = texts[key];
          if (t.body === '' && t.isPublic) continue;
          try {
            await sheetRepo.saveText(sheet.id, user.id, key, t.body, t.isPublic, null);
          } catch (e) {
            error = `The sheet came in, but its ${key} didn’t make it! Open the sheet and paste it in again.`;
          }
        }
      }
      if (error || result.warnings.length) {
        sheets = [...sheets, sheet];
        notice = `Imported \u201c${sheetName(stored)}\u201d. ${result.warnings.join(' ')}`.trim();
        return;
      }
      await goto(`${base}/s/${sheet.id}`);
    } catch (e) {
      error = friendlyError(e, 'That file wouldn’t come in! Try exporting it again.');
    } finally {
      importing = false;
    }
  }

  async function create() {
    const user = $session.user;
    if (!user) return;
    creating = true;
    try {
      const sheet = await sheetRepo.createSheet(user.id, 'New character', blankDefinition(), blankState());
      await goto(`${base}/s/${sheet.id}`);
    } catch (e) {
      error = friendlyError(e, 'The new sheet fizzled! Try again in a moment.');
    } finally {
      creating = false;
    }
  }
</script>

{#snippet star(id: string, name: string, on: boolean, kind: Kind)}
  <!-- A star on the left: pinned cards go to the top (and sheets cannot be deleted). -->
  <button class="star" class:on aria-pressed={on}
          aria-label="{on ? 'Unpin' : 'Pin'} {name}"
          title={on ? 'Unpin' : 'Pin to the top'} onclick={() => togglePin(id, kind)}>
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3.1-5.4 3.1 1.2-6-4.5-4.2 6.1-.7z"
            stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
    </svg>
  </button>
{/snippet}

{#snippet pin(sheet: Sheet, on: boolean)}
  {@render star(sheet.id, nameOf(sheet), on, 'sheets')}
{/snippet}

{#snippet grip(id: string, name: string, count: number, kind: Kind)}
  <button class="grip" aria-label="Drag to reorder {name}"
          title="Drag to reorder" disabled={count < 2}
          onpointerdown={(e) => grab(e, id, kind)} onpointermove={moveDrag}
          onpointerup={dropDrag} onpointercancel={() => (drag = null)}>
    <svg viewBox="0 0 12 18" width="10" height="15" aria-hidden="true">
      {#each [3, 9, 15] as y (y)}
        <circle cx="3" cy={y} r="1.5" fill="currentColor" /><circle cx="9" cy={y} r="1.5" fill="currentColor" />
      {/each}
    </svg>
  </button>
{/snippet}

{#snippet campcard(c: Campaign)}
  <a href="{base}/c/{c.id}" class="campcard"><span class="camptext"><strong style:font-family={faceFamily(fontFace(c.details?.nameFont))}>{c.name}</strong><span class="meta">started {friendlyDate(c.created_at)}{#if c.archived}{' '}· ended{/if}</span></span>{@render campside(c)}</a>
{/snippet}

{#snippet joinedcard(c: Campaign)}
  {@const mine = charactersIn(c).map(nameOf)}
  <a href="{base}/c/{c.id}" class="campcard"><span class="camptext"><strong style:font-family={faceFamily(fontFace(c.details?.nameFont))}>{c.name}</strong><span class="meta">{#if mine.length}as {mine.length > 1 ? `${mine.slice(0, -1).join(', ')} and ${mine.at(-1)}` : mine[0]}{' · '}{/if}started {friendlyDate(c.created_at)}{#if c.archived}{' '}· ended{/if}</span></span>{@render campside(c)}</a>
{/snippet}

{#snippet campside(c: Campaign)}
  <!-- At the right: who has the campaign open now, and when it next meets. -->
  {@const here = tables[c.id]}
  {@const players = (here?.users ?? []).filter((u) => u !== c.created_by).length}
  {@const next = c.archived ? null : sessionWhen(c.details?.nextSession)}
  {#if (here && (here.dm || players)) || (next && !next.past)}
    <span class="campside">
      {#if here && (here.dm || players)}
        <span class="camphere" transition:fade={{ duration: 200 }}>
          <i class="here-dot"></i>{[here.dm ? 'DM' : '', players ? (players === 1 ? '1 player' : `${players} players`) : ''].filter(Boolean).join(' and ')} here
        </span>
      {/if}
      {#if next && !next.past}
        <span class="campnext"><span class="k">Next session</span>{next.when}<span class:soon={next.until === 'today' || next.until === 'now'}>{next.until === 'now' ? 'happening now' : next.until}</span></span>
      {/if}
    </span>
  {/if}
{/snippet}

{#snippet joinedrow(c: Campaign)}
  <!-- A campaign not pinned: its star (none once ended), its card, and leaving it. -->
  {#if !c.archived}{@render star(c.id, c.name, false, 'joined')}{/if}
  {@render joinedcard(c)}
  {#if confirming === c.id}
    <div class="confirm" role="group" aria-label="Confirm leaving {c.name}">
      <span>Leave with {charactersIn(c).length > 1 ? 'all your characters' : 'your character'}?</span>
      <button class="danger" disabled={leavingId === c.id} onclick={() => leave(c)}>
        {leavingId === c.id ? 'Leaving…' : 'Leave'}
      </button>
      <button class="ghost" onclick={() => (confirming = null)}>Stay</button>
    </div>
  {:else}
    <button class="trash" aria-label="Leave {c.name}" title="Leave the campaign"
            onclick={() => (confirming = c.id)}>×</button>
  {/if}
{/snippet}

{#snippet face(sheet: Sheet)}
  <!-- The character's portrait in its sheet's frame, or its main class drawn. -->
  {@const src = resolveImageUrl(sheet.definition?.identity?.portraitUrl).url}
  <span class="face">
    <ClassIcon cls={sheet.definition ? mainClass(sheet.definition) : undefined} />
    {#if src}<img {src} alt="" loading="lazy" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />{/if}
  </span>
{/snippet}

{#snippet card(sheet: Sheet)}
  <a href="{base}/s/{sheet.id}" class="withface">
    {@render face(sheet)}
    <!-- Short lines: the name; the class with its level; the campaign, if
         any; when it was made and when last changed. -->
    <span class="cardtext">
      <span class="lines">
        <strong style:font-family={faceFamily(fontFace(sheet.definition?.identity?.nameFont))}>{nameOf(sheet)}</strong>
        <span class="meta">{classWithLevel(sheet)}</span>
        {#if campaignOf(sheet)}
          <span class="meta campaign" style:font-family={sheet.campaign_id ? campaignFont.get(sheet.campaign_id) : undefined}>{campaignOf(sheet)}</span>
        {/if}
      </span>
      <!-- Made, then last changed, on one line. Where both don't fit, the
           made part drops out of sight (it wraps under, out of the clipped
           line), leaving the last change: drawn in reverse, so Updated comes
           first in the markup and is the one that stays. -->
      <span class="meta dates"><span class="datesrow">
        <span>Updated {friendlyDate(sheet.updated_at)}</span>
        {#if numericDate(sheet.created_at)}<span class="made">Created {numericDate(sheet.created_at)}</span>{/if}
      </span></span>
    </span>
    {@render facts(sheet)}
  </a>
{/snippet}

{#snippet facts(sheet: Sheet)}
  <!-- How the character stands: hit points with their bar, armour class, and
       the conditions on them (three, then how many more). -->
  {@const def = sheet.definition}
  {@const max = Number(def?.combat?.hpMax) || 0}
  {@const cur = Number(sheet.state?.hpCurrent) || 0}
  {@const temp = Number(sheet.state?.hpTemp) || 0}
  {@const v = vitalStatus(cur, max, sheet.state?.deathSaves)}
  {@const conds = sheet.state?.conditions ?? []}
  {#if def && (max > 0 || conds.length)}
    <span class="cardfacts">
      {#if max > 0}
        <span class="hpline">
          <span class="k">HP</span><b>{cur}</b><span class="of">/ {max}</span>{#if temp}<span class="temp">+{temp}</span>{/if}
          <span class="vitalword {v.vital}">{v.label}</span>
          <span class="ac"><span class="k">AC</span><b>{armorClass(def).total}</b></span>
        </span>
        <span class="hpbar {v.vital}" aria-hidden="true"><i style:width="{Math.max(0, Math.min(100, (cur / max) * 100))}%"></i></span>
      {/if}
      {#if conds.length}
        <span class="condchips">
          {#each conds.slice(0, 3) as c (c)}
            <span class="condchip" style:--cc={lookOf(c, def.conditionLooks ?? {})?.color ?? 'var(--dim)'}>{c}</span>
          {/each}
          {#if conds.length > 3}<span class="condmore">+{conds.length - 3}</span>{/if}
        </span>
      {/if}
    </span>
  {/if}
{/snippet}

{#snippet sheetItem(sheet: Sheet, g: Group<Sheet>)}
  {#if g.pinned}
    {@render pin(sheet, true)}
    {@render card(sheet)}
    {@render grip(sheet.id, nameOf(sheet), pinnedSheets.length, 'sheets')}
  {:else}
    {@render row(sheet)}
  {/if}
{/snippet}

{#snippet joinedItem(c: Campaign, g: Group<Campaign>)}
  {#if g.pinned}
    {@render star(c.id, c.name, true, 'joined')}
    {@render joinedcard(c)}
    {@render grip(c.id, c.name, pinnedJoined.length, 'joined')}
  {:else}
    {@render joinedrow(c)}
  {/if}
{/snippet}

{#snippet campaignItem(c: Campaign, g: Group<Campaign>)}
  {#if isMine(c)}{@render runItem(c, g)}{:else}{@render joinedItem(c, g)}{/if}
{/snippet}

{#snippet runItem(c: Campaign, g: Group<Campaign>)}
  {#if g.pinned}
    {@render star(c.id, c.name, true, 'campaigns')}
    {@render campcard(c)}
    {@render grip(c.id, c.name, pinnedCampaigns.length, 'campaigns')}
  {:else}
    {#if !g.faded}{@render star(c.id, c.name, false, 'campaigns')}{/if}
    {@render campcard(c)}
  {/if}
{/snippet}

<!--
  One area's cards, a page at a time: its groups (Pinned, the rest, Retired
  or Archived) each named where they start, and a pager under them when there
  is more than one page.
-->
{#snippet paged<T extends { id: string }>(key: Kind, groups: Group<T>[], item: import('svelte').Snippet<[T, Group<T>]>, themeOf: (x: T) => string | undefined, bannerOf: (x: T) => string | undefined)}
  {@const count = pageCount(groups)}
  {@const page = pageIn(key, groups)}
  <div class="pagearea" use:fit style:min-height={count > 1 ? `${pageHeight}px` : undefined}>
    {#key `${key}:${page}`}
      <div class="pageset" in:pageSlide>
        {#each pagesOf(groups)[page] ?? [] as g (g.key)}
          {#if g.label}<h3 class="group">{g.label}</h3>{/if}
          <ul class="cascade" class:pinned={g.pinned} class:dragging={g.pinned && drag?.kind === (g.kind ?? key)} class:landing={g.pinned && landing}>
            {#each g.items as x, i (x.id)}
              <li style:--i={i} class:retired={g.faded} class:lifted={drag?.id === x.id}
                  class="themed" style={themeOf(x)}
                  bind:this={rowEls[x.id]}
                  style:transform={g.pinned && drag?.kind === (g.kind ?? key) ? shift(x.id) : undefined}
                  animate:flip={{ duration: drag || landing ? 0 : 260, easing: cubicOut }} out:fold>
                {#if bannerOf(x)}
                  <!-- Its banner, in the bottom right corner, fading into the card. -->
                  <span class="cardbanner" aria-hidden="true" style:background-image="url('{bannerOf(x)?.replace(/'/g, '%27')}')"></span>
                {/if}
                {@render item(x, g)}
              </li>
            {/each}
          </ul>
        {/each}
      </div>
    {/key}
  </div>
  {#if count > 1}
    <nav class="pager" aria-label="Pages">
      <button class="smallbtn" disabled={page === 0} onclick={() => turn(key, page - 1)} aria-label="Previous page">‹ Previous</button>
      <span class="pagenum" aria-live="polite">Page {page + 1} of {count}</span>
      <button class="smallbtn" disabled={page >= count - 1} onclick={() => turn(key, page + 1)} aria-label="Next page">Next ›</button>
    </nav>
  {/if}
{/snippet}

{#snippet row(sheet: Sheet)}
  <!-- A sheet that is not pinned: its star (none once retired), its card, and deleting it. -->
  {#if !sheet.retired}{@render pin(sheet, false)}{/if}
  {@render card(sheet)}
  {#if confirming === sheet.id}
    <div class="confirm" role="group" aria-label="Confirm deleting {nameOf(sheet)}">
      <span>Delete for good?</span>
      <button class="danger" disabled={deleting === sheet.id} onclick={() => remove(sheet.id)}>
        {deleting === sheet.id ? 'Deleting…' : 'Delete'}
      </button>
      <button class="ghost" onclick={() => (confirming = null)}>Keep</button>
    </div>
  {:else}
    <button class="trash" aria-label="Delete {nameOf(sheet)}"
            onclick={() => (confirming = sheet.id)}>×</button>
  {/if}
{/snippet}

<svelte:head>
  <!-- Signed in, the tab names the area open ("Characters | DND Companion"). -->
  <title>{pageTitle(view === 'list' && $session.user ? area : null)}</title>
  {#each [...new Set([...campaignFaces, ...sheetFaces])] as href (href)}<link rel="stylesheet" {href} />{/each}
</svelte:head>

{#key view}
<div class="swap" in:arrive={{ y: 10, duration: 240, delay: 30 }}>
{#if view === 'auth'}
  <AuthForm
    google
    name="Sign in"
    submitLabel="Sign in"
    fields={[
      { id: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
      { id: 'password', label: 'Password', type: 'password', autocomplete: 'current-password' }
    ]}
    onsubmit={async (v) => {
      await signIn(v.email, v.password);
    }}
  >
    <a class="smallbtn" href="{base}/signup">Create an account</a>
    <a class="smallbtn" href="{base}/reset">Forgot password</a>
  </AuthForm>
{:else}
<main>
  <header>
    <h1><Logo size={30} /><span class="brandname">DND Companion</span></h1>
    <div class="tools">
      <SoundToggle />
      <ModeToggle />
      {#if $session.user}
        {@const me = profileOf($session.user, $profile)}
        <a class="me" href="{base}/account" title="Your account">
          <Avatar url={me.avatarUrl} name={me.displayName || $session.user.email || '?'} size={30} />
          <span>{me.displayName || 'Account'}</span>
        </a>
      {/if}
    </div>
  </header>

  {#if !isConfigured}
    <p class="app-alert bad">
      This copy has no Supabase credentials. Set <code>PUBLIC_SUPABASE_URL</code> and
      <code>PUBLIC_SUPABASE_ANON_KEY</code> and rebuild.
    </p>
  {:else if $session.loading}
    <div class="menuloading"><MenuSkeleton greet /><div class="screen-center"><D20Loader size={56} label="Signing in" /></div></div>
  {:else}
    {#if $session.user}
      {@const me = profileOf($session.user, $profile)}
      {#if !me.displayName}
        <!-- No name yet: the table needs something to call them. -->
        <form class="hello" transition:slide={{ duration: 260 }} onsubmit={(e) => { e.preventDefault(); void saveName(); }}>
          <div class="hellotext">
            <b>What should the table call you?</b>
            <span>Your name shows on your campaigns and to your DM. A profile picture helps too; add one on your account page.</span>
          </div>
          <div class="hellorow">
            <input bind:value={nameDraft} placeholder="Your name" aria-label="Your name" maxlength="60" />
            <button disabled={!nameDraft.trim() || savingName}>{savingName ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      {:else if !me.avatarUrl}
        <div class="hello slim" transition:slide={{ duration: 260 }}>
          <span>Add a profile picture, {me.displayName.split(' ')[0]}? It is how the rest of the table spots you.</span>
          <a class="smallbtn accent" href="{base}/account">Add one</a>
        </div>
      {/if}
    {/if}

    {#if error}<p class="app-alert bad top" role="alert">{error}</p>{/if}
    {#if notice}<p class="app-alert top" role="status">{notice}</p>{/if}

    <!-- Visually hidden, not display: none: some phones will not open the
         file picker for an input that is not rendered. -->
    <input
      bind:this={picker}
      class="file"
      type="file"
      accept=".txt,text/plain"
      aria-label="Import a sheet file"
      tabindex="-1"
      onchange={importFile}
    />

    {#if loading || !listShown}
      <!-- The menu's outline, dimmed, with the die rolling over it. -->
      <div class="menuloading">
        <MenuSkeleton greet={Boolean(profileOf($session.user, $profile).displayName.trim())} />
        <div class="screen-center">
          <D20Loader size={56} label="Loading your characters" result={loading ? null : error ? 1 : 20}
                     onlanded={() => { if (!loading) listShown = true; }} />
        </div>
      </div>
    {/if}
    <!-- Not an {:else}: that would wait for the die to finish leaving while
         the areas below it arrived, and the page would jump. -->
    {#if ready}
      <div class="areas">
        <Tabs tabs={areaTabs} bind:active={area}>
          {#snippet children(tab)}
            {#if tab === AREA_SHEETS}
              <div class="bar">
                <span class="tally">{sheets.length} {sheets.length === 1 ? 'character' : 'characters'}</span>
                <div class="actions">
                  <button class="ghost" onclick={() => picker?.click()} disabled={importing}
                          title="Bring back a sheet saved with Export">
                    {importing ? 'Importing…' : 'Import'}
                  </button>
                  <button onclick={create} disabled={creating}>{creating ? 'Creating…' : 'New sheet'}</button>
                </div>
              </div>
              {#if sheets.length === 0}
                <p class="dim">No characters yet. Make one and start filling it in.</p>
              {:else}
                {@render paged('sheets', sheetGroups, sheetItem, (x) => themeStyle(x.definition?.identity?.theme), (x) => resolveImageUrl(x.definition?.identity?.bannerUrl).url || undefined)}
              {/if}
            {:else}
              <!-- The campaigns this player runs as DM and the ones their
                   characters joined (one card each, however many of their
                   characters are in it), and starting a new one. -->
              <div class="bar">
                <span class="tally">{campaignTally}</span>
                <div class="actions">
                  {#if !naming}<button onclick={() => (naming = true)}>New campaign</button>{/if}
                </div>
              </div>
              {#if naming}
                <div class="newcamp" in:rise>
                  <!-- svelte-ignore a11y_autofocus -->
                  <input bind:value={newCampaign} placeholder="Campaign name" aria-label="Campaign name" autofocus
                         onkeydown={(e) => { if (e.key === 'Enter') startCampaign(); if (e.key === 'Escape') naming = false; }} />
                  <button onclick={startCampaign} disabled={starting || !newCampaign.trim()}>{starting ? 'Starting…' : 'Start'}</button>
                  <button class="ghost" onclick={() => (naming = false)}>Cancel</button>
                </div>
              {/if}
              {#if running.length || joined.length}
                {@render paged('campaigns', campaignGroups, campaignItem, () => undefined, (c) => resolveImageUrl(c.details?.bannerUrl).url || undefined)}
              {:else if !naming}
                <p class="dim">None yet. Start one to get an invite link for your players, or join one from your DM's link.</p>
              {/if}
            {/if}
          {/snippet}
        </Tabs>
      </div>
    {/if}
  {/if}
</main>
{/if}
</div>
{/key}

<style>
  .swap { position: relative; }
  .hello {
    display: flex; align-items: center; gap: 0.75rem 1rem; flex-wrap: wrap; margin: 0; padding: 0.875rem 1rem;
    border: 1px solid var(--a-edge); border-radius: var(--r); background: var(--a-wash);
  }
  /* Under the header, everything sits the same distance apart. */
  .hello, .top { margin-top: 1.75rem; }
  .hello.slim { border-color: var(--line-soft); background: var(--surface); font-size: 0.875rem; color: var(--dim); }
  .hello.slim span { flex: 1; min-width: 12rem; }
  .hellotext { flex: 1 1 16rem; display: grid; gap: 0.125rem; }
  .hellotext span { font-size: 0.8125rem; color: var(--dim); line-height: 1.45; }
  .hellorow { display: flex; gap: 0.5rem; flex: 1 1 16rem; }
  .hellorow input {
    flex: 1; min-width: 0; font: inherit; padding: 0.4375rem 0.625rem; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  .hellorow input:focus { outline: none; border-color: var(--a-edge); }
  /* Its foot is short: the menu is paged to fit, so that space is only air. */
  main { max-width: 42rem; margin: 0 auto; padding: 2.5rem 1rem 2rem; }
  /* A wide screen: the page widens and the cards sit in a grid. */
  @media (min-width: 900px) {
    main { max-width: var(--page-width); padding-left: var(--page-pad); padding-right: var(--page-pad); }
    /* Two to a row, each as wide as an area's button above (the same gap). */
    .pageset ul { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.375rem; }
  }
  .areas { margin-top: 1.75rem; }
  /* The lists are paged to fit, so the panel never scrolls: no gutter kept
     for a scrollbar, and the cards line up with the buttons above. */
  .areas :global(.panels) { scrollbar-gutter: auto; }
  .tally { font-size: 0.8125rem; color: var(--dim); }
  .pagearea { position: relative; }
  .pager {
    display: flex; align-items: center; justify-content: center; gap: 0.75rem;
    margin-top: 1rem; font-size: 0.8125rem; color: var(--dim);
  }
  .pagenum { min-width: 7.5rem; text-align: center; font-variant-numeric: tabular-nums; }
  /*
   * The portrait (or the class drawn) at the card's left, in the sheet's
   * frame: a square as tall as the card's lines. Sized outright rather than
   * stretched to the card: Safari would not keep a stretched one square and
   * squeezed it into a strip on a phone. The lines are centred beside it,
   * and how the character stands (hit points, armour class, conditions) at
   * the right, in a card wide enough for it.
   */
  li { container-type: inline-size; }
  /*
   * A banner, when the character or campaign has one: a corner of the card,
   * bottom right, fading out towards the left and the top, under everything
   * in the card (the star, the grip, the ×, the words all stay on top), and
   * fading in once it has loaded.
   */
  li { position: relative; isolation: isolate; overflow: hidden; }
  .cardbanner {
    position: absolute; right: 0; bottom: 0; z-index: -1; pointer-events: none;
    width: min(45%, 24rem); height: 100%;
    background-size: cover; background-position: center;
    opacity: 0.35; animation: bannerIn 0.6s ease-out backwards;
    -webkit-mask-image: linear-gradient(to left, #000 15%, transparent 95%), linear-gradient(to top, #000 20%, transparent 100%);
    -webkit-mask-composite: source-in;
    mask-image: linear-gradient(to left, #000 15%, transparent 95%), linear-gradient(to top, #000 20%, transparent 100%);
    mask-composite: intersect;
    transition: opacity 0.3s ease;
  }
  li:hover .cardbanner { opacity: 0.5; }
  :global([data-mode='light']) .cardbanner { opacity: 0.3; }
  :global([data-mode='light']) li:hover .cardbanner { opacity: 0.42; }
  @keyframes bannerIn { from { opacity: 0; } }
  .withface {
    --face: 4.75rem;
    display: grid; grid-template-columns: var(--face) minmax(0, 1fr);
    grid-template-areas: 'face text'; align-items: center; column-gap: 1rem;
  }
  .withface > .face { grid-area: face; }
  .cardtext { grid-area: text; display: flex; flex-direction: column; justify-content: center; min-width: 0; min-height: var(--face); }
  .cardfacts {
    grid-area: facts; gap: 0.375rem; min-width: 0; align-self: center;
    padding-left: 1rem; border-left: 1px solid var(--line-soft);
  }
  .hpline { display: flex; align-items: baseline; gap: 0.25rem; font-size: 0.8125rem; color: var(--dim); flex-wrap: wrap; }
  .hpline b { color: var(--text); font-size: 1rem; font-variant-numeric: tabular-nums; }
  .hpline .k { font-size: 0.625rem; letter-spacing: 0.08em; font-weight: 650; color: var(--label); }
  .hpline .temp { color: var(--a); font-size: 0.75rem; }
  .vitalword { font-size: 0.6875rem; margin-left: 0.25rem; }
  .vitalword:is(.bloodied, .critical, .down, .dead) { color: oklch(66% 0.2 25); }
  :global([data-mode='light']) .vitalword:is(.bloodied, .critical, .down, .dead) { color: oklch(52% 0.2 25); }
  .hpline .ac { margin-left: auto; display: inline-flex; align-items: baseline; gap: 0.25rem; }
  .hpbar { display: block; height: 4px; border-radius: 2px; background: var(--track); overflow: hidden; }
  .hpbar i { display: block; height: 100%; background: var(--a); border-radius: inherit; }
  .hpbar:is(.bloodied, .critical, .down, .dead) i { background: oklch(62% 0.21 25); }
  .condchips { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .condchip {
    font-size: 0.6875rem; padding: 0.0625rem 0.4375rem; border-radius: 999px; color: var(--text); white-space: nowrap;
    border: 1px solid color-mix(in oklch, var(--cc) 55%, var(--line)); background: color-mix(in oklch, var(--cc) 16%, var(--raised));
  }
  .condmore { font-size: 0.6875rem; color: var(--dim); align-self: center; }
  /* A campaign card: its name and line at the left; who is here and the next
     session at the right (under them, in a narrow card). */
  .campcard { display: flex; align-items: center; gap: 0.5rem 1rem; flex-wrap: wrap; }
  .camptext { flex: 1 1 12rem; min-width: 0; display: block; }
  .campside { display: grid; justify-items: end; gap: 0.25rem; font-size: 0.75rem; color: var(--dim); text-align: right; }
  .camphere { display: inline-flex; align-items: center; gap: 0.375rem; color: var(--text); }
  .here-dot {
    width: 0.4375rem; height: 0.4375rem; border-radius: 50%; background: oklch(74% 0.17 150); flex: none;
    animation: hereGlow 2.4s ease-out infinite;
  }
  @keyframes hereGlow { 0% { box-shadow: 0 0 0 0 oklch(74% 0.17 150 / 0.5); } 70%, 100% { box-shadow: 0 0 0 6px oklch(74% 0.17 150 / 0); } }
  .campnext { display: inline-flex; align-items: baseline; gap: 0.375rem; flex-wrap: wrap; justify-content: flex-end; }
  .campnext .k { font-size: 0.625rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--label); font-weight: 600; }
  .campnext .soon { color: var(--a); font-weight: 600; }
  @container (max-width: 30rem) { .campside { justify-items: start; text-align: left; } .campnext { justify-content: flex-start; } }
  /*
   * A narrow card (a phone, two to a row on a small laptop): the square beside
   * the name, class and campaign, and the dates as the card's foot.
   */
  @container (max-width: 36rem) {
    .withface {
      --face: 4.75rem; grid-template-columns: var(--face) minmax(0, 1fr);
      grid-template-areas: 'face text' 'dates dates'; row-gap: 0.625rem; align-items: center;
    }
    .cardtext { display: contents; }
    .lines { grid-area: text; }
    /* The dates are the card's foot, under a hairline, centred on one line. */
    .meta.dates { grid-area: dates; margin-top: 0; padding-top: 0.5rem; border-top: 1px solid var(--line-soft); }
    .meta.dates .datesrow { justify-content: center; }
  }
  .face {
    position: relative; flex: none; width: var(--face); height: var(--face); overflow: hidden;
    border-radius: var(--r-sm); border: 1px solid var(--a-edge);
    background: linear-gradient(150deg, var(--portrait-from), var(--portrait-to));
  }
  .face img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .tools { display: flex; align-items: center; gap: 0.5rem; flex: none; }
  /* The title takes the room the buttons leave and its name is sized to fit
     it, so a narrow phone shows all of "DND Companion" a little smaller
     rather than cut short ("DND COMPA…"). */
  h1 {
    font-size: 1.5rem; margin: 0; display: flex; align-items: center; gap: 0.625rem;
    flex: 1 1 auto; min-width: 0; container-type: inline-size;
  }
  h1 .brandname { font-size: max(0.875rem, min(1em, calc((100cqi - 2.5rem) / 10.2))); }
  h1 :global(.logo) { flex: none; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin: 0.25rem 0 0.875rem; min-height: 2.125rem; }
  .actions { display: flex; gap: 0.5rem; }
  .file {
    position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0;
    clip-path: inset(50%); pointer-events: none;
  }
  button {
    background: var(--surface); border: 1px solid var(--line); color: var(--text);
    border-radius: 6px; padding: 0.4rem 0.9rem; font: inherit; font-size: 0.875rem; cursor: pointer;
  }
  button {
    transition: border-color 0.15s ease, color 0.15s ease, transform 0.08s ease;
  }
  button:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  button:active:not(:disabled) { transform: translateY(1px); }
  .ghost { color: var(--dim); }
  .ghost:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  @keyframes rise {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
  /* Rows arrive in order; past the sixth they are all but simultaneous. */
  li { animation: rise 0.28s cubic-bezier(0.2, 0.7, 0.3, 1) backwards; }
  li:nth-child(2) { animation-delay: 0.04s; }
  li:nth-child(3) { animation-delay: 0.08s; }
  li:nth-child(4) { animation-delay: 0.12s; }
  li:nth-child(5) { animation-delay: 0.16s; }
  li:nth-child(n + 6) { animation-delay: 0.2s; }
  li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    padding-right: 0.5rem;
    transition: border-color 0.15s ease, transform 0.15s ease;
  }
  li:hover { border-color: var(--a-edge); transform: translateY(-1px); box-shadow: 0 6px 18px -8px rgb(0 0 0 / 0.45); }
  li a {
    display: block; flex: 1; min-width: 0;
    padding: 0.75rem 0.9rem; text-decoration: none; color: inherit;
  }
  .trash {
    background: none; border: 0; color: var(--dim); font-size: 1.1rem; line-height: 1;
    padding: 0.3rem 0.45rem; cursor: pointer; flex: none; border-radius: 5px;
  }
  .trash:hover { color: var(--bad); border-color: transparent; }
  .confirm { display: flex; align-items: center; gap: 0.5rem; flex: none; font-size: 0.82rem; }
  .confirm span { color: var(--dim); }
  .danger { border-color: var(--bad); color: var(--bad); padding: 0.25rem 0.6rem; font-size: 0.82rem; }
  .danger:hover:not(:disabled) { background: var(--bad); color: var(--bg); border-color: var(--bad); }
  .retired a { opacity: 0.6; padding-left: 0.75rem; }
  .meta { display: block; font-size: 0.8rem; color: var(--dim); margin-top: 0.125rem; overflow-wrap: anywhere; }
  .meta.campaign { color: var(--text); }
  /* Made, then last changed, side by side with a rule between them. */
  .meta.dates { font-size: 0.75rem; }
  .datesrow {
    display: flex; flex-direction: row-reverse; flex-wrap: wrap; justify-content: flex-end; column-gap: 0.5rem;
    line-height: 1.5; height: 1.5em; overflow: hidden;
  }
  .datesrow span { white-space: nowrap; }
  .datesrow .made { padding-right: 0.5rem; border-right: 1px solid var(--line); }
  .lines { display: block; }
  .newcamp { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
  .newcamp input {
    flex: 1; min-width: 0; font: inherit; padding: 0.5rem 0.75rem; border: 1px solid var(--line);
    border-radius: var(--r-sm); background: var(--surface); color: var(--text);
  }
  .newcamp input:focus { outline: none; border-color: var(--a-edge); }
  .dates { color: var(--faint); }
  .me {
    display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; color: var(--text);
    font-size: 0.875rem; padding: 0.1875rem 0.75rem 0.1875rem 0.1875rem; border-radius: 999px;
    border: 1px solid var(--line); background: var(--raised);
    transition: border-color 0.15s ease, color 0.15s ease;
  /*
   * How the character stands shows only on a card wide enough to keep its
   * lines whole beside it. One threshold, the card's own width, so it never
   * comes back at a narrower window after leaving at a wider one: a single
   * column's card (under 40rem inside) stays under it, and two to a row
   * pass it from a window about 1390px wide.
   */
  .cardfacts { display: none; }
  @container (min-width: 41rem) {
    .withface { grid-template-columns: var(--face) minmax(0, 1fr) minmax(11rem, 13rem); grid-template-areas: 'face text facts'; }
    .cardfacts { display: grid; }
  }
  }
  .me:hover { border-color: var(--a-edge); color: var(--a); }
  .menuloading > :global(.mskel) { opacity: 0.45; }
  .dim { color: var(--dim); }
  code { font-size: 0.85em; }
  li a { padding-left: 0.25rem; }
  .group {
    font-size: 0.6875rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--faint);
    font-weight: 600; margin: 1rem 0 0.5rem;
  }
  .group:first-of-type { margin-top: 0; }
  ul.pinned { margin-bottom: 0.25rem; }
  .star {
    flex: none; background: none; border: 0; padding: 0.5rem 0 0.5rem 0.75rem; cursor: pointer;
    color: var(--faint); display: grid; place-items: center;
    transition: color 0.15s ease, transform 0.2s cubic-bezier(0.3, 1.5, 0.5, 1);
  }
  .star svg { fill: none; transition: fill 0.2s ease; }
  .star:hover { color: var(--a); transform: scale(1.15); }
  .star.on { color: oklch(84% 0.15 90); }
  .star.on svg { fill: currentColor; animation: starPop 0.4s cubic-bezier(0.3, 1.6, 0.5, 1); }
  @keyframes starPop { from { transform: scale(0.4) rotate(-40deg); } }
  :global([data-mode='light']) .star.on { color: oklch(66% 0.16 80); }
  .grip {
    flex: none; background: none; border: 0; color: var(--faint); cursor: grab; touch-action: none;
    padding: 0.5rem 0.5rem; border-radius: 5px; display: grid; place-items: center;
  }
  .grip:hover:not(:disabled) { color: var(--text); }
  .grip:disabled { opacity: 0.35; cursor: default; }
  /* With a mouse, the star and the delete (or grip) wait until the card is
     pointed at, then slide in from their own sides. On a touch screen there is
     no pointing, so they stay, quietly. */
  @media (hover: hover) and (pointer: fine) {
    .star, .trash, .grip {
      opacity: 0;
      transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.2, 0.8, 0.3, 1), color 0.15s ease;
    }
    .star { transform: translateX(-6px) scale(0.8); }
    .trash, .grip { transform: translateX(6px) scale(0.8); }
    li:hover .star, li:focus-within .star,
    li:hover .trash, li:focus-within .trash,
    li:hover .grip, li:focus-within .grip, .dragging li.lifted .grip {
      opacity: 1; transform: none;
    }
    li:hover .trash, li:hover .grip { transition-delay: 0.04s; }
    li .star:hover { transform: scale(1.15); }
  }
  .dragging li { transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.3, 1); }
  .dragging li.lifted { transition: none; z-index: 2; position: relative; box-shadow: 0 12px 28px -10px rgb(0 0 0 / 0.6); border-color: var(--a-edge); cursor: grabbing; }
  @media (max-width: 420px) {
    h1 { font-size: 1.3125rem; gap: 0.5rem; }
    header { gap: 0.625rem; }
    .tools { gap: 0.375rem; }
    /* Tighter on a phone, the same above and below the nudge. */
    .hello, .top { margin-top: 1rem; }
    .areas { margin-top: 1rem; }
    /* The picture alone says whose account it is: a round button, no pill. */
    .me span { display: none; }
    .me { padding: 0; border: 0; background: none; border-radius: 50%; }
    .me :global(.avatar) { width: 2.25rem; height: 2.25rem; transition: box-shadow 0.15s ease; }
    .me:hover :global(.avatar), .me:focus-visible :global(.avatar) { box-shadow: 0 0 0 2px var(--a-edge); }
  }
</style>
