<script lang="ts">
  /**
   * A campaign's page, /c/<id>: a card for each character in it, with what a
   * DM glances at mid-fight (hit points, AC, passive Perception, conditions),
   * kept current while the page is open. Readable by anyone with the link,
   * like a sheet. Its DM also gets the invite link, a rename, removing a
   * character, ending the campaign (it is archived, and can be reopened) and
   * deleting it, a banner like a sheet's, and a jukebox of their own music.
   */
  import { onMount } from 'svelte';
  import { fade, scale, slide } from 'svelte/transition';
  import { backOut, cubicOut } from 'svelte/easing';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { campaignMessage, campaignRepo, type Campaign, type CampaignDetails } from '$lib/data/campaigns';
  import { sheetRepo } from '$lib/data/sheets';
  import { isConfigured, supabase } from '$lib/supabase';
  import { session } from '$lib/stores/session';
  import { characterLevel, classLine, passiveScore } from '$lib/rules/derived';
  import { vitalStatus } from '$lib/rules/hp';
  import { resolveImageUrl } from '$lib/rules/imageUrl';
  import { themeStyle } from '$lib/theme';
  import { friendlyError } from '$lib/errors';
  import { followHeight, glideTo, prefersReducedMotion } from '$lib/motion';
  import { glide } from '$lib/flip';
  import Banner from './Banner.svelte';
  import CampaignMusic from './CampaignMusic.svelte';
  import CardHp from './CardHp.svelte';
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
  let removing = $state<string | null>(null);
  /**
   * Edit mode, the DM's alone, as on a sheet: reading, the page is the table
   * and the music; editing, the name, the songs, the invite, the banner and
   * ending or deleting the campaign come out.
   */
  let editing = $state(false);
  function toggleEditing() {
    void glide(() => {
      editing = !editing;
      if (!editing) {
        confirming = null;
        removing = null;
      }
    });
  }
  const unfold = () => ({ duration: prefersReducedMotion() ? 0 : 280, easing: cubicOut });
  /** Which of the campaign's last two buttons is asking to be sure. */
  let confirming = $state<'end' | 'delete' | null>(null);

  const isDm = $derived(Boolean(campaign && $session.user && campaign.created_by === $session.user.id));
  const ended = $derived(Boolean(campaign?.archived));
  const bannerLink = $derived(resolveImageUrl(campaign?.details.bannerUrl));
  /** The campaign's colour, as a sheet's: picked while editing, previewed while picking. */
  let themePreview = $state<string | null>(null);
  const themeCss = $derived(themeStyle(themePreview ?? campaign?.details.theme));
  const pageLink = $derived(typeof location !== 'undefined' ? `${location.origin}${base}/c?id=${encodeURIComponent(id)}` : '');

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
    } else if (e.key.toLowerCase() === 'm' && isDm && campaign.details.songs?.length) {
      e.preventDefault();
      setSound(!get(soundOn));
    } else if (e.key === 'Escape' && (confirming || removing)) {
      confirming = null;
      removing = null;
    }
  }
  const active = $derived(
    sheets.filter((s) => !s.retired).sort((a, b) => (a.definition?.identity?.name ?? '').localeCompare(b.definition?.identity?.name ?? ''))
  );
  const retired = $derived(sheets.filter((s) => s.retired));
  const inviteLink = $derived(
    invite && typeof location !== 'undefined' ? `${location.origin}${base}/join?code=${invite}` : ''
  );

  async function load(first = false) {
    try {
      const [c, rows] = await Promise.all([campaignRepo.get(id), sheetRepo.listCampaignSheets(id)]);
      campaign = c;
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
          .subscribe()
      : null;
    return () => {
      clearInterval(timer);
      clearTimeout(soon);
      document.removeEventListener('visibilitychange', back);
      if (channel) void supabase.removeChannel(channel);
    };
  });

  $effect(() => {
    if (!isDm || !campaign || ended) return;
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
    removing = null;
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

  const hpOf = (s: Sheet) => {
    const max = Number(s.definition?.combat?.hpMax) || 0;
    const cur = Number(s.state?.hpCurrent) || 0;
    return { max, cur, temp: Number(s.state?.hpTemp) || 0, pct: max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0 };
  };
</script>

<svelte:head><title>{campaign?.name ?? 'Campaign'}</title></svelte:head>
<svelte:window onkeydown={onKey} />

{#if loading || !landed}
  <div class="loading">
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
        <h1>
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
        <a class="back" href="{base}/">Back</a>
        <ShareButton link={pageLink} label="Copy link to this campaign"
                     oncopied={(ok) => { if (!ok) error = 'The clipboard said no! Copy the address from the bar above instead.'; }} />
        <button class="keys" onclick={() => (showKeys = true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2.5" y="6" width="19" height="12" rx="2" />
              <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9" />
            </g>
          </svg>
        </button>
        {#if isDm && campaign.details.songs?.length}<SoundToggle />{/if}
        <ModeToggle />
      </div>
    </header>

    {#if ended}
      <p class="ended">This campaign has ended. Its characters stay here as the story left them{#if isDm}, and nobody new can join{/if}.</p>
    {/if}

    <!-- The DM's music: always there to play; empty, only while editing. -->
    {#if isDm && (editing || campaign.details.songs?.length)}
      <div transition:slide={unfold()}>
        <CampaignMusic campaignId={campaign.id} songs={campaign.details.songs ?? []} {editing}
                       onchange={(songs) => saveDetails({ songs })} />
      </div>
    {/if}

    {#if error}<p class="err" role="alert">{error}</p>{/if}

    {#if active.length === 0}
      <p class="empty">No characters yet.{#if isDm}{' '}Send your players the invite link.{/if}</p>
    {:else}
      <ul class="cards">
        {#each active as s (s.id)}
          {@const def = s.definition}
          {@const hp = hpOf(s)}
          {@const v = vitalStatus(hp.cur, hp.max, s.state?.deathSaves)}
          {@const portrait = resolveImageUrl(def?.identity?.portraitUrl).url}
          <li class="card themed {v.vital}" style={themeStyle(def?.identity?.theme)}
              animate:glideTo in:fade={{ duration: 200 }}>
            <a class="open" href="{base}/s/{s.id}">
              <span class="portrait">
                {#if portrait}<img src={portrait} alt="" />{/if}
                <span class="lvl">LV {characterLevel(def)}</span>
              </span>
              <span class="who">
                <strong>{def?.identity?.name || s.name}</strong>
                <span class="sub">{classLine(def) || 'No class yet'}</span>
              </span>
            </a>
            <CardHp cur={hp.cur} max={hp.max} temp={hp.temp} vital={v.vital} label={v.label} />
            <dl class="stats">
              <div><dt>AC</dt><dd>{def?.combat?.ac ?? '—'}</dd></div>
              <!-- In full where the box has room, shortened where it does not. -->
              <div class="perc"><dt><span class="long">Passive Perception</span><span class="short">Passive Perc.</span></dt><dd>{passiveScore(def, 'perception')}</dd></div>
              <div class="ins"><dt><span class="long">Passive Insight</span><span class="short">Passive Ins.</span></dt><dd>{passiveScore(def, 'insight')}</dd></div>
            </dl>
            <!-- Conditions: the card eases to its new height as they come and go. -->
            <div class="condbox" use:followHeight>
              <ul class="conds" aria-label="Conditions">
                {#each s.state?.conditions ?? [] as c (c)}<li transition:scale={{ start: 0.6, duration: 220, easing: backOut }}>{c}</li>{/each}
              </ul>
            </div>
            {#if isDm && !ended && editing}
              {#if removing === s.id}
                <div class="confirm" role="group" aria-label="Remove {def?.identity?.name}" transition:slide={unfold()}>
                  <span>Take out of the campaign?</span>
                  <button class="danger" onclick={() => remove(s.id)}>Remove</button>
                  <button class="ghost" onclick={() => (removing = null)}>Keep</button>
                </div>
              {:else}
                <button class="x" aria-label="Remove {def?.identity?.name || s.name} from the campaign"
                        title="Remove from the campaign" onclick={() => (removing = s.id)}
                        transition:fade={{ duration: 180 }}>×</button>
              {/if}
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    {#if retired.length}
      <details class="retired">
        <summary>Retired ({retired.length})</summary>
        <ul>
          {#each retired as s (s.id)}
            <li><a href="{base}/s/{s.id}">{s.definition?.identity?.name || s.name}</a>
              <span class="sub">{classLine(s.definition)}</span></li>
          {/each}
        </ul>
      </details>
    {/if}

    <!-- Editing: the invite, the banner, and ending or deleting the campaign. -->
    {#if isDm && editing}
      <div class="manage" transition:slide={unfold()}>
      {#if !ended}
        <section class="dm">
          <div class="invite">
            <span class="label">Invite link</span>
            <input readonly value={inviteLink || 'Fetching…'} aria-label="Invite link" onfocus={(e) => e.currentTarget.select()} />
            <button onclick={() => copy(inviteLink, 'invite')} disabled={!inviteLink}>{copied === 'invite' ? 'Copied!' : 'Copy'}</button>
            <button class="ghost" onclick={newInvite} title="Make a new link; the old one stops working">New link</button>
          </div>
          <p class="hint">Players open it, sign in and pick which character joins. Anyone with this page’s own link can watch, but only the invite lets a character in.</p>
        </section>
      {/if}
      <section class="dm look">
        <label class="invite">
          <span class="label">Banner link</span>
          <input value={campaign.details.bannerUrl ?? ''} placeholder="Optional: a wide picture shown behind the page"
                 onchange={(e) => saveDetails({ bannerUrl: e.currentTarget.value.trim() })} />
        </label>
        {#if bannerLink.note}<p class="hint" class:bad={bannerLink.source === 'invalid'}>{bannerLink.note}</p>{/if}
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
  .loading { display: grid; place-items: center; min-height: 60vh; }
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

  .cards {
    list-style: none; padding: 0; margin: 1.5rem 0 0;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: 0.875rem;
  }
  /* A fixed red for hurt, as on the sheet's hit points: the theme's own
     danger colour follows its hue, and a blue "Critical" reads as nothing. */
  .card { --hurt-red: oklch(66% 0.22 25); }
  :global([data-mode='light']) .card { --hurt-red: oklch(56% 0.21 25); }
  .card {
    position: relative; border: 1px solid var(--line-soft); border-radius: var(--r); background: var(--surface);
    padding: 0.875rem; display: flex; flex-direction: column;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .card:hover { border-color: var(--a-edge); }
  .card.dead { opacity: 0.7; }
  .open { display: flex; gap: 0.75rem; align-items: center; color: inherit; text-decoration: none; min-width: 0; padding-right: 1.5rem; }
  .portrait {
    position: relative; flex: none; width: 3.25rem; height: 3.25rem; border-radius: var(--r-sm);
    border: 1px solid var(--a-edge); background: linear-gradient(150deg, var(--portrait-from), var(--portrait-to));
  }
  .portrait img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
  .lvl {
    position: absolute; left: 50%; bottom: -0.4375rem; transform: translateX(-50%); white-space: nowrap;
    font-size: 0.5625rem; font-weight: 700; letter-spacing: 0.06em; padding: 0.0625rem 0.3125rem;
    border-radius: 999px; background: var(--surface); border: 1px solid var(--a-edge); color: var(--a);
  }
  .who { display: grid; min-width: 0; }
  .who strong { font-size: 1.0625rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { font-size: 0.8125rem; color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.375rem; margin: 0; }
  .stats div { background: var(--raised); border: 1px solid var(--line-soft); border-radius: var(--r-sm); padding: 0.375rem 0.25rem; text-align: center; }
  .stats dt { font-size: 0.5625rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--label); }
  .stats dd { margin: 0.125rem 0 0; font-size: 1.0625rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  /* Spaced by margins rather than a gap, so the conditions' space can be
     their own: an empty list takes none, and it eases in with the first. */
  .card > :global(*) + :global(*) { margin-top: 0.75rem; }
  .card > .condbox, .card > .x { margin-top: 0; }
  .conds { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.3125rem; }
  .conds:has(li) { padding-top: 0.75rem; }
  .stats div { container-type: inline-size; }
  .stats dt { white-space: nowrap; }
  .stats .long { display: none; }
  /* Each in full once its box (less its padding) holds the whole label. */
  @container (min-width: 5.5rem) {
    .ins .long { display: inline; }
    .ins .short { display: none; }
  }
  @container (min-width: 7rem) {
    .perc .long { display: inline; }
    .perc .short { display: none; }
  }
  .conds li {
    font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 999px;
    border: 1px solid var(--a-edge); background: var(--a-wash); color: var(--a);
  }
  .x {
    position: absolute; top: 0.5rem; right: 0.5rem; width: 1.625rem; height: 1.625rem; padding: 0;
    display: grid; place-items: center; border: 0; background: none; color: var(--dim); font-size: 1.1rem;
    opacity: 0; transition: opacity 0.15s ease, color 0.15s ease;
  }
  .card:hover .x, .x:focus-visible { opacity: 1; }
  .x:hover { color: var(--bad); }
  @media (hover: none) { .x { opacity: 1; } }
  .confirm { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: 0.8125rem; color: var(--dim); }
  .confirm button { padding: 0.25rem 0.625rem; font-size: 0.8125rem; }
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
