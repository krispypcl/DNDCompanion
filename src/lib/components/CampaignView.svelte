<script lang="ts">
  import InfoTip from './InfoTip.svelte';
  import { siteRoot } from '$lib/rules/share';
  /**
   * A campaign's page, /c/<id>: a card for each character in it, with what a
   * DM glances at mid-fight (hit points, AC, passive Perception, conditions),
   * kept current while the page is open. Readable by anyone with the link,
   * like a sheet. Its DM also gets the invite link, a rename, removing a
   * character, ending the campaign (it is archived, and can be reopened) and
   * deleting it, a banner like a sheet's, and a jukebox of their own music.
   */
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { campaignMessage, campaignRepo, type Campaign, type CampaignDetails, type CampaignLive, type Playback } from '$lib/data/campaigns';
  import { sheetRepo } from '$lib/data/sheets';
  import { isConfigured, supabase } from '$lib/supabase';
  import { session } from '$lib/stores/session';
  import { classLine } from '$lib/rules/derived';
  import { resolveImageUrl } from '$lib/rules/imageUrl';
  import { faceFamily, nameFont } from '$lib/rules/fonts';
  import { themeStyle } from '$lib/theme';
  import { friendlyError } from '$lib/errors';
  import { prefersReducedMotion } from '$lib/motion';
  import { glide } from '$lib/flip';
  import Banner from './Banner.svelte';
  import CampaignMusic from './CampaignMusic.svelte';
  import CampaignBoard from './CampaignBoard.svelte';
  import CampaignCards from './CampaignCards.svelte';
  import D20Loader from './D20Loader.svelte';
  import EditableField from './EditableField.svelte';
  import ModeToggle from './ModeToggle.svelte';
  import Logo from './Logo.svelte';
  import NotFound from './NotFound.svelte';
  import ShareButton from './ShareButton.svelte';
  import ShortcutHelp from './ShortcutHelp.svelte';
  import ThemePicker from './ThemePicker.svelte';
  import { setSound, soundOn } from '$lib/sound';
  import { get } from 'svelte/store';
  import SoundToggle from './SoundToggle.svelte';
  import type { Sheet } from '$lib/types';

  let { id }: { id: string } = $props();

  let campaign = $state<Campaign | null>(null);
  let sheets = $state<Sheet[]>([]);
  let loading = $state(true);
  /** The die has landed: the page shows (as a sheet does). */
  let landed = $state(false);
  let missing = $state(false);
  let error = $state<string | null>(null);
  let invite = $state<string | null>(null);
  let copied = $state<'invite' | 'page' | null>(null);
  /**
   * Edit mode, the DM's alone, as on a sheet: reading, the page is the table
   * and the music; editing, the name, the songs, the invite, the banner and
   * ending or deleting the campaign come out.
   */
  let editing = $state(false);
  function toggleEditing() {
    void glide(() => {
      editing = !editing;
      if (!editing) confirming = null;
    });
  }
  const unfold = () => ({ duration: prefersReducedMotion() ? 0 : 280, easing: cubicOut });
  /** Which of the campaign's last two buttons is asking to be sure. */
  let confirming = $state<'end' | 'delete' | null>(null);

  const isDm = $derived(Boolean(campaign && $session.user && campaign.created_by === $session.user.id));
  /** In the campaign: its DM, or a player with a character in it. They may see the invite. */
  const isMember = $derived(isDm || Boolean($session.user && sheets.some((s) => s.owner_id === $session.user!.id)));
  const hasMusic = $derived(Boolean(campaign?.details.songs?.length));

  /**
   * What is happening right now (database/0008): the DM's music, and a
   * counter that ticks when the invite changes. `at` is moved onto this
   * device's clock as it arrives, so following does not depend on whose
   * clock is right.
   */
  let live = $state<CampaignLive | null>(null);
  let playback = $state<Playback | null>(null);
  function takeLive(next: CampaignLive | null, updatedAt?: string) {
    live = next;
    const pb = next?.playback ?? null;
    if (!pb) {
      playback = null;
      return;
    }
    // Arriving live: it happened just now. Fetched: when the database says.
    const at = updatedAt ? Math.min(Date.now(), Date.parse(updatedAt) || Date.now()) : Date.now();
    if (!playback || pb.at !== playback.at || pb.index !== playback.index || pb.playing !== playback.playing || pb.t !== playback.t) {
      playback = { ...pb, at };
    }
  }
  /** The DM's music, told to the table (and shown here at once). */
  function sendPlayback(p: Playback) {
    if (!campaign) return;
    playback = p;
    void campaignRepo.savePlayback(campaign.id, p).catch(() => {});
  }
  const ended = $derived(Boolean(campaign?.archived));
  const bannerLink = $derived(resolveImageUrl(campaign?.details.bannerUrl));
  /** The campaign name's own font, if the DM chose one. */
  const font = $derived(nameFont(campaign?.details.nameFont));
  const face = $derived(font && font !== 'bad' ? font : null);
  /** The campaign's colour, as a sheet's: picked while editing, previewed while picking. */
  let themePreview = $state<string | null>(null);
  const themeCss = $derived(themeStyle(themePreview ?? campaign?.details.theme));
  const pageLink = $derived(typeof location !== 'undefined' ? `${siteRoot(location.origin, base)}/c?id=${encodeURIComponent(id)}` : '');

  /** The keys, as on a sheet: E edits, M plays or pauses the music, ? lists them. */
  let showKeys = $state(false);
  function onKey(e: KeyboardEvent) {
    if (!campaign || showKeys || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.key === '?') {
      e.preventDefault();
      showKeys = true;
    } else if (e.key.toLowerCase() === 'e' && isDm) {
      e.preventDefault();
      toggleEditing();
    } else if (e.key.toLowerCase() === 'm' && hasMusic) {
      e.preventDefault();
      setSound(!get(soundOn));
    } else if (e.key === 'Escape' && confirming) {
      confirming = null;
    }
  }
  const active = $derived(sheets.filter((s) => !s.retired));
  /** Back goes to your own character at this table, or home if you have none here. */
  const mine = $derived(active.find((s) => s.owner_id === $session.user?.id) ?? sheets.find((s) => s.owner_id === $session.user?.id));
  const backTo = $derived(mine ? `${base}/s/${mine.id}` : `${base}/`);
  const retired = $derived(sheets.filter((s) => s.retired));
  const inviteLink = $derived(
    invite && typeof location !== 'undefined' ? `${siteRoot(location.origin, base)}/join?code=${invite}` : ''
  );

  async function load(first = false) {
    try {
      const [c, rows, now] = await Promise.all([
        campaignRepo.get(id), sheetRepo.listCampaignSheets(id), first ? campaignRepo.live(id) : Promise.resolve(undefined)
      ]);
      campaign = c;
      if (now !== undefined) takeLive(now, now?.updated_at);
      missing = !c;
      sheets = rows;
      error = null;
    } catch (e) {
      if (first) error = friendlyError(e, 'The campaign wouldn’t load! Try again in a moment.');
    } finally {
      loading = false;
    }
  }

  /*
   * The table keeps playing while this is open. A character's sheet saving is
   * heard at once (the database announces changes to the campaign's sheets,
   * database/0007), and the page also looks again every few seconds in case
   * an announcement was missed; nothing is asked for while the tab is hidden.
   */
  onMount(() => {
    void load(true);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 6000);
    const back = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', back);
    let soon: ReturnType<typeof setTimeout> | undefined;
    const refreshSoon = () => {
      clearTimeout(soon);
      soon = setTimeout(() => void load(), 120);
    };
    const channel = isConfigured
      ? supabase
          .channel(`campaign-${id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'sheets', filter: `campaign_id=eq.${id}` }, refreshSoon)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_live', filter: `campaign_id=eq.${id}` }, (payload) => {
            const row = payload.new as { playback?: Playback | Record<string, never>; invite_rev?: number };
            const pb = row.playback && 'index' in row.playback ? (row.playback as Playback) : null;
            // The DM's own page already shows what it just did.
            if (isDm && pb && playback && pb.at === playback.at) {
              live = { playback: pb, invite_rev: row.invite_rev ?? 0 };
              return;
            }
            takeLive({ playback: pb, invite_rev: row.invite_rev ?? 0 });
          })
          .subscribe()
      : null;
    return () => {
      clearInterval(timer);
      clearTimeout(soon);
      document.removeEventListener('visibilitychange', back);
      if (channel) void supabase.removeChannel(channel);
    };
  });

  // The invite, for everyone in the campaign; fetched again whenever the DM makes a new one.
  const inviteRev = $derived(live?.invite_rev ?? 0);
  $effect(() => {
    void inviteRev;
    if (!isMember || !campaign || ended) return;
    campaignRepo.invite(campaign.id).then((c) => (invite = c)).catch(() => {});
  });

  async function copy(text: string, which: 'invite' | 'page') {
    try {
      await navigator.clipboard.writeText(text);
      copied = which;
      setTimeout(() => (copied = null), 1600);
    } catch {
      error = 'The clipboard said no! Select the link and copy it yourself.';
    }
  }

  async function act(task: () => Promise<void>, fallback: string) {
    error = null;
    try {
      await task();
    } catch (e) {
      error = campaignMessage(e, fallback);
    }
  }

  const rename = (name: string) => act(async () => {
    if (!campaign || !name.trim()) return;
    await campaignRepo.rename(campaign.id, name.trim());
    campaign = { ...campaign, name: name.trim() };
  }, 'The new name wouldn’t stick! Try again.');

  const newInvite = () => act(async () => {
    if (campaign) invite = await campaignRepo.resetInvite(campaign.id);
  }, 'The old link is still the link! Try again.');

  const remove = (sheetId: string) => act(async () => {
    await campaignRepo.remove(sheetId);
    sheets = sheets.filter((s) => s.id !== sheetId);
  }, 'That character held on! Try again.');

  const setEnded = (archived: boolean) => act(async () => {
    if (!campaign) return;
    await campaignRepo.archive(campaign.id, archived);
    campaign = { ...campaign, archived };
    confirming = null;
  }, archived ? 'The story refused to end! Try again.' : 'The campaign stayed shut! Try again.');

  const destroy = () => act(async () => {
    if (!campaign) return;
    await campaignRepo.delete(campaign.id);
    await goto(`${base}/`);
  }, 'The campaign refused to vanish! Try again.');

  /** The banner and songs are saved together; the page shows the change at once. */
  async function saveDetails(patch: Partial<CampaignDetails>) {
    if (!campaign) return;
    const before = campaign.details;
    const details = { ...before, ...patch };
    campaign = { ...campaign, details };
    error = null;
    try {
      await campaignRepo.saveDetails(campaign.id, details);
    } catch (e) {
      if (campaign) campaign = { ...campaign, details: before };
      error = campaignMessage(e, 'That change slipped off the page! Try again.');
    }
  }

  /** The DM gives or takes away a player's conditions: shown at once, undone if refused. */
  async function giveConditions(sheetId: string, conditions: string[]) {
    const before = sheets;
    sheets = sheets.map((s) => (s.id === sheetId ? { ...s, state: { ...s.state, conditions } } : s));
    error = null;
    try {
      await campaignRepo.setConditions(sheetId, conditions);
    } catch (e) {
      sheets = before;
      error = campaignMessage(e, 'The condition slid right off! Try again.');
    }
  }
</script>

<svelte:head>
  <title>{campaign?.name ?? 'Campaign'}</title>
  {#if face}<link rel="stylesheet" href={face.href} />{/if}
</svelte:head>
<svelte:window onkeydown={onKey} />

{#if loading || !landed}
  <div class="loading screen-center">
    <D20Loader size={56} label="Loading the campaign" result={loading ? null : missing || (error && !campaign) ? 1 : 20}
               onlanded={() => (landed = true)} />
  </div>
{:else if missing}
  <NotFound title="No campaign here!" message="This campaign has wandered off the map. It may have ended, or the link is off by a letter, so check it with your DM." />
{:else if error && !campaign}
  <NotFound title="That’s a critical fail!" message={error} />
{:else if campaign}
  <main class="themed" style={themeCss} in:fade={{ duration: prefersReducedMotion() ? 0 : 200 }}>
    {#if bannerLink.url}<Banner url={bannerLink.url} />{/if}
    <header>
      <!-- The die, in the campaign's own colour: home to the list. -->
      <a class="home" href="{base}/" title="Your characters"><Logo size={26} /></a>
      <div class="title">
        <span class="eyebrow">Campaign{#if ended}<span class="sep">·</span>ended{/if}{#if isDm}<span class="sep">·</span>you’re the DM{/if}</span>
        <h1 style:font-family={faceFamily(face)}>
          {#if isDm}
            <EditableField value={campaign.name} editable={editing} label="Campaign name" placeholder="Campaign name"
                           onchange={(v) => rename(String(v))} />
          {:else}
            {campaign.name}
          {/if}
        </h1>
      </div>
      <div class="tools">
        {#if isDm}
          <button class="edit" aria-pressed={editing} onclick={toggleEditing}>
            {#key editing}<span class="edlabel">{editing ? 'Done' : 'Edit'}</span>{/key}
          </button>
        {/if}
        <a class="back" href={backTo} title={mine ? `Back to ${mine.definition?.identity?.name || mine.name || 'your character'}` : 'Back to your characters'}>Back</a>
        {#if isMember && !ended}
          <ShareButton link={inviteLink} icon="invite" disabled={!inviteLink}
                       label="Copy the invite link (it lets a character join)"
                       oncopied={(ok) => { if (!ok) error = 'The clipboard said no! Ask your DM to send you the invite.'; }} />
        {/if}
        <ShareButton link={pageLink} label="Copy link to this page (to watch, not join)"
                     oncopied={(ok) => { if (!ok) error = 'The clipboard said no! Copy the address from the bar above instead.'; }} />
        <button class="keys" onclick={() => (showKeys = true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2.5" y="6" width="19" height="12" rx="2" />
              <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9" />
            </g>
          </svg>
        </button>
        {#if hasMusic}<SoundToggle />{/if}
        <ModeToggle />
      </div>
    </header>

    {#if ended}
      <p class="ended">This campaign has ended. Its characters stay here as the story left them{#if isDm}, and nobody new can join{/if}.</p>
    {/if}

    <!-- The table's music: the DM plays it, everyone hears it. Empty, only while the DM edits. -->
    {#if hasMusic || (isDm && editing)}
      <div transition:slide={unfold()}>
        <CampaignMusic campaignId={campaign.id} songs={campaign.details.songs ?? []} editing={isDm && editing}
                       lead={isDm} {playback} onplayback={sendPlayback}
                       onchange={(songs) => saveDetails({ songs })} />
      </div>
    {/if}

    {#if error}<p class="err" role="alert">{error}</p>{/if}

    {#if active.length === 0}
      <p class="empty">No characters yet.{#if isDm}{' '}Send your players the invite link.{/if}</p>
    {:else}
      <CampaignCards sheets={active} order={campaign.details.order ?? []} {isDm} {editing} {ended}
                     onorder={(order) => saveDetails({ order })} onremove={remove} onconditions={giveConditions} />
    {/if}

    {#if retired.length}
      <details class="retired">
        <summary>Retired ({retired.length})</summary>
        <ul>
          {#each retired as s (s.id)}
            <li><a href="{base}/s/{s.id}?from={id}">{s.definition?.identity?.name || s.name}</a>
              <span class="sub">{classLine(s.definition)}</span></li>
          {/each}
        </ul>
      </details>
    {/if}

    <CampaignBoard campaignId={campaign.id} userId={$session.user?.id ?? null} canEdit={isMember && !ended} />

    <!-- Editing: the invite, the banner, and ending or deleting the campaign. -->
    {#if isDm && editing}
      <div class="manage" transition:slide={unfold()}>
      {#if !ended}
        <section class="dm">
          <div class="invite">
            <span class="label">Invite link
              <InfoTip label="About the invite link">Players open it, sign in and pick which character joins. Anyone with this page’s own link can watch, but only the invite lets a character in. A new link stops the old one working.</InfoTip>
            </span>
            <input readonly value={inviteLink || 'Fetching…'} aria-label="Invite link" onfocus={(e) => e.currentTarget.select()} />
            <button onclick={() => copy(inviteLink, 'invite')} disabled={!inviteLink}>{copied === 'invite' ? 'Copied!' : 'Copy'}</button>
            <button class="ghost" onclick={newInvite} title="Make a new link; the old one stops working">New link</button>
          </div>
        </section>
      {/if}
      <section class="dm look">
        <label class="invite">
          <span class="label">Banner link</span>
          <input value={campaign.details.bannerUrl ?? ''} placeholder="Optional: a wide picture shown behind the page"
                 onchange={(e) => saveDetails({ bannerUrl: e.currentTarget.value.trim() })} />
        </label>
        {#if bannerLink.note}<p class="hint" class:bad={bannerLink.source === 'invalid'}>{bannerLink.note}</p>{/if}
        <label class="invite fontrow">
          <span class="label">Name font
            <InfoTip label="About the name font">
              The font of the campaign's name, on this page and in your list of campaigns. On
              <a href="https://fonts.google.com" target="_blank" rel="noopener noreferrer">fonts.google.com</a>, open a font
              and copy the address of its page (or the link from "Get font" → "Get embed code"). Paste either here, or
              just the font's name. Leave it blank for the site's own font.
            </InfoTip>
          </span>
          <input value={campaign.details.nameFont ?? ''} placeholder="Optional: a Google Fonts link"
                 onchange={(e) => saveDetails({ nameFont: e.currentTarget.value.trim() })} />
        </label>
        {#if font === 'bad'}
          <p class="hint bad" role="status">That’s not a font we can find! Paste a link from fonts.google.com, or the font’s name.</p>
        {:else if face}
          <p class="hint" role="status">Using <span style:font-family={faceFamily(face)}>{face.family}</span></p>
        {/if}
        <div class="themerow">
          <span class="label">Campaign theme</span>
          <ThemePicker value={campaign.details.theme} label="Campaign theme"
                       onpreview={(hex) => (themePreview = hex)}
                       onchange={(name) => { themePreview = null; void saveDetails({ theme: name }); }} />
        </div>
      </section>
      <div class="end">
        {#if confirming === 'end'}
          <span>End this campaign? It moves to your archived campaigns, its characters stay in it, and you can reopen it later.</span>
          <button class="danger" onclick={() => setEnded(true)}>End it</button>
          <button class="ghost" onclick={() => (confirming = null)}>Keep playing</button>
        {:else if confirming === 'delete'}
          <span>Delete this campaign for good? Its characters stay, out of any campaign.</span>
          <button class="danger" onclick={destroy}>Delete it</button>
          <button class="ghost" onclick={() => (confirming = null)}>Keep</button>
        {:else}
          {#if ended}
            <button class="ghost" onclick={() => setEnded(false)}>Reopen campaign</button>
          {:else}
            <button class="ghost" onclick={() => (confirming = 'end')}>End campaign</button>
          {/if}
          <button class="ghost dangerish" onclick={() => (confirming = 'delete')}>Delete campaign</button>
        {/if}
      </div>
      </div>
    {/if}
    {#if showKeys}<ShortcutHelp owner={isDm} place="campaign" onclose={() => (showKeys = false)} />{/if}
  </main>
{/if}

<style>
  main { max-width: 72rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
  /* Above the banner, which lies behind the top of the page. */
  main > :global(*) { position: relative; z-index: 1; }
  .loading { min-height: 60vh; }
  header { display: flex; align-items: center; gap: 0.875rem; }
  .home { display: grid; place-items: center; flex: none; color: var(--a); transition: color 0.3s ease; }
  .home:hover { color: var(--a-hi, var(--a)); }
  .title { flex: 1; min-width: 0; }
  .sep { margin: 0 0.375rem; }
  .eyebrow { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--a); }
  h1 { margin: 0.125rem 0 0; font-size: 1.75rem; font-weight: 600; letter-spacing: -0.015em; }
  .tools { display: flex; align-items: center; gap: 0.5rem; flex: none; }
  button {
    font: inherit; font-size: 0.875rem; cursor: pointer; border-radius: var(--r-sm); padding: 0.4375rem 0.875rem;
    border: 1px solid var(--a-edge); background: var(--a-wash); color: var(--a);
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }
  button:hover:not(:disabled) { border-color: var(--a); }
  button:disabled { opacity: 0.5; cursor: default; }
  .ghost { border-color: var(--line); background: var(--surface); color: var(--text); }
  /* The header's buttons, as on a sheet: Edit, Back, then square icons. */
  .back {
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); padding: 0.375rem 0.875rem; font-size: 0.8125rem;
    text-decoration: none; flex: none; line-height: 1.5;
    transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.08s ease;
  }
  .back:hover { border-color: var(--a-edge); color: var(--a); }
  .back:active { transform: translateY(1px); }
  /* Shortcuts are for a keyboard: the button only shows where there is a mouse. */
  .keys {
    display: none; place-items: center; width: 2rem; height: 2rem; flex: none; padding: 0;
    background: var(--raised); border: 1px solid var(--line); border-radius: var(--r-sm);
    color: var(--text); cursor: pointer; transition: border-color 0.18s ease, color 0.18s ease, transform 0.08s ease;
  }
  .keys:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  .keys:active { transform: translateY(1px); }
  @media (hover: hover) and (pointer: fine) { .keys { display: inline-grid; } }
  .danger { border-color: var(--bad); background: none; color: var(--bad); }
  .dangerish:hover { color: var(--bad); border-color: var(--bad); }

  .dm {
    margin-top: 1.5rem; padding: 0.875rem 1rem; border: 1px solid var(--line-soft); border-radius: var(--r);
    background: var(--surface);
  }
  .invite { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .label { font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--label); font-weight: 600; }
  .invite input {
    flex: 1; min-width: 12rem; font: inherit; font-size: 0.8125rem; padding: 0.4375rem 0.625rem; color: var(--dim);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  .hint { margin: 0.5rem 0 0; font-size: 0.8125rem; color: var(--dim); line-height: 1.45; }
  .hint.bad { color: var(--bad); }
  /* Room above for the cards' shadows; a little below so it ends in air. */
  .manage { padding-top: 1.5rem; }
  .manage > .dm:first-child { margin-top: 0; }
  .look { margin-top: 1rem; }
  .fontrow { margin-top: 0.875rem; }
  .label { display: inline-flex; align-items: center; gap: 0.25rem; }
  .themerow { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.875rem; }
  .look + .end { margin-top: 1.25rem; }
  .edit {
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    padding: 0.375rem 0.875rem; font-size: 0.8125rem; line-height: 1.5; flex: none;
    min-width: 4.5rem; transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.08s ease;
  }
  .edit:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  .edit:active { transform: translateY(1px); }
  /* Edit and Done cross over rather than swap. */
  .edlabel { display: inline-block; animation: edIn 0.25s cubic-bezier(0.2, 0.8, 0.3, 1); }
  @keyframes edIn { from { opacity: 0; transform: translateY(4px); } }
  .edit[aria-pressed='true'] { border-color: var(--a-edge); color: var(--a); background: var(--a-wash); }
  .edit[aria-pressed='true']:hover { border-color: var(--a); background: var(--a-edge); color: var(--text); }
  .err { color: var(--bad); font-size: 0.875rem; }
  .ended {
    margin: 1.5rem 0 0; padding: 0.75rem 1rem; border: 1px solid var(--line-soft); border-radius: var(--r);
    background: var(--surface); color: var(--dim); font-size: 0.875rem; line-height: 1.45;
  }
  .empty { color: var(--dim); margin-top: 2rem; }

  .retired { margin-top: 2rem; }
  .retired summary { cursor: pointer; color: var(--dim); font-size: 0.875rem; }
  .retired ul { list-style: none; padding: 0; margin: 0.625rem 0 0; display: grid; gap: 0.375rem; }
  .retired a { color: var(--text); margin-right: 0.5rem; }
  .end { margin-top: 3rem; display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap; font-size: 0.875rem; color: var(--dim); }
  @media (max-width: 600px) {
    main { padding-top: 1.25rem; }
    h1 { font-size: 1.375rem; }
    header { flex-wrap: wrap; }
    .tools { order: -1; width: 100%; justify-content: flex-end; gap: 0.375rem; }
    .edit { min-width: 3.25rem; padding: 0.375rem 0.5rem; }
    .back { padding: 0.375rem 0.5rem; }
  }
</style>
