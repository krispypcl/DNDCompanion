<script lang="ts">
  /**
   * A campaign's page, /c/<id>: a card for each character in it, with what a
   * DM glances at mid-fight (hit points, AC, passive Perception, conditions),
   * kept current while the page is open. Readable by anyone with the link,
   * like a sheet. Its DM also gets the invite link, a rename, removing a
   * character, and deleting the campaign.
   */
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { campaignMessage, campaignRepo, type Campaign } from '$lib/data/campaigns';
  import { sheetRepo } from '$lib/data/sheets';
  import { session } from '$lib/stores/session';
  import { characterLevel, classLine, passiveScore } from '$lib/rules/derived';
  import { vitalStatus } from '$lib/rules/hp';
  import { resolveImageUrl } from '$lib/rules/imageUrl';
  import { themeStyle } from '$lib/theme';
  import { friendlyError } from '$lib/errors';
  import { prefersReducedMotion } from '$lib/motion';
  import D20Loader from './D20Loader.svelte';
  import EditableField from './EditableField.svelte';
  import Logo from './Logo.svelte';
  import ModeToggle from './ModeToggle.svelte';
  import NotFound from './NotFound.svelte';
  import type { Sheet } from '$lib/types';

  let { id }: { id: string } = $props();

  let campaign = $state<Campaign | null>(null);
  let sheets = $state<Sheet[]>([]);
  let loading = $state(true);
  let missing = $state(false);
  let error = $state<string | null>(null);
  let invite = $state<string | null>(null);
  let copied = $state<'invite' | 'page' | null>(null);
  let removing = $state<string | null>(null);
  let confirmDelete = $state(false);

  const isDm = $derived(Boolean(campaign && $session.user && campaign.created_by === $session.user.id));
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

  // The table keeps playing while this is open: what changed shows up within
  // a few seconds, and nothing is asked for while the tab is hidden.
  onMount(() => {
    void load(true);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 8000);
    const back = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', back);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', back);
    };
  });

  $effect(() => {
    if (!isDm || !campaign) return;
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

  const destroy = () => act(async () => {
    if (!campaign) return;
    await campaignRepo.delete(campaign.id);
    await goto(`${base}/`);
  }, 'The campaign refused to end! Try again.');

  const hpOf = (s: Sheet) => {
    const max = Number(s.definition?.combat?.hpMax) || 0;
    const cur = Number(s.state?.hpCurrent) || 0;
    return { max, cur, temp: Number(s.state?.hpTemp) || 0, pct: max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0 };
  };
</script>

<svelte:head><title>{campaign?.name ?? 'Campaign'}</title></svelte:head>

{#if loading}
  <div class="loading"><D20Loader size={56} label="Loading the campaign" /></div>
{:else if missing}
  <NotFound title="No campaign here!" message="This campaign has wandered off the map. It may have ended, or the link is off by a letter, so check it with your DM." />
{:else if error && !campaign}
  <NotFound title="That’s a critical fail!" message={error} />
{:else if campaign}
  <main in:fade={{ duration: prefersReducedMotion() ? 0 : 200 }}>
    <header>
      <a class="home" href="{base}/" title="Your characters"><Logo size={26} /></a>
      <div class="title">
        <span class="eyebrow">Campaign{#if isDm}<span class="sep">·</span>you’re the DM{/if}</span>
        <h1>
          {#if isDm}
            <EditableField value={campaign.name} editable={true} label="Campaign name" placeholder="Campaign name"
                           onchange={(v) => rename(String(v))} />
          {:else}
            {campaign.name}
          {/if}
        </h1>
      </div>
      <div class="tools">
        <button class="ghost" onclick={() => copy(location.href, 'page')}>{copied === 'page' ? 'Copied!' : 'Share page'}</button>
        <ModeToggle />
      </div>
    </header>

    {#if isDm}
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

    {#if error}<p class="err" role="alert">{error}</p>{/if}

    {#if active.length === 0}
      <p class="empty">No characters yet.{#if isDm} Send your players the invite link.{/if}</p>
    {:else}
      <ul class="cards">
        {#each active as s (s.id)}
          {@const def = s.definition}
          {@const hp = hpOf(s)}
          {@const v = vitalStatus(hp.cur, hp.max, s.state?.deathSaves)}
          {@const portrait = resolveImageUrl(def?.identity?.portraitUrl).url}
          <li class="card themed {v.vital}" style={themeStyle(def?.identity?.theme)}
              animate:flip={{ duration: 260, easing: cubicOut }} in:fade={{ duration: 200 }}>
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
            <div class="hp" title="{hp.cur} of {hp.max} hit points{hp.temp ? `, ${hp.temp} temporary` : ''}">
              <div class="hpline">
                <span class="cap">HP</span>
                <b>{hp.cur}</b><span class="of">/ {hp.max}</span>
                {#if hp.temp}<span class="temp">+{hp.temp}</span>{/if}
                <span class="vital">{v.label}</span>
              </div>
              <div class="bar"><i style:transform="scaleX({hp.pct})"></i></div>
            </div>
            <dl class="stats">
              <div><dt>AC</dt><dd>{def?.combat?.ac ?? '—'}</dd></div>
              <div><dt>Passive Perc.</dt><dd>{passiveScore(def, 'perception')}</dd></div>
              <div><dt>Insight</dt><dd>{passiveScore(def, 'insight')}</dd></div>
            </dl>
            {#if s.state?.conditions?.length}
              <ul class="conds" aria-label="Conditions">
                {#each s.state.conditions as c (c)}<li>{c}</li>{/each}
              </ul>
            {/if}
            {#if isDm}
              {#if removing === s.id}
                <div class="confirm" role="group" aria-label="Remove {def?.identity?.name}">
                  <span>Take out of the campaign?</span>
                  <button class="danger" onclick={() => remove(s.id)}>Remove</button>
                  <button class="ghost" onclick={() => (removing = null)}>Keep</button>
                </div>
              {:else}
                <button class="x" aria-label="Remove {def?.identity?.name || s.name} from the campaign"
                        title="Remove from the campaign" onclick={() => (removing = s.id)}>×</button>
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

    {#if isDm}
      <div class="end">
        {#if confirmDelete}
          <span>End this campaign for good? Its characters stay, out of any campaign.</span>
          <button class="danger" onclick={destroy}>End it</button>
          <button class="ghost" onclick={() => (confirmDelete = false)}>Keep</button>
        {:else}
          <button class="ghost dangerish" onclick={() => (confirmDelete = true)}>End campaign</button>
        {/if}
      </div>
    {/if}
  </main>
{/if}

<style>
  main { max-width: 72rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
  .loading { display: grid; place-items: center; min-height: 60vh; }
  header { display: flex; align-items: center; gap: 0.875rem; }
  .home { display: grid; place-items: center; flex: none; }
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
  .err { color: var(--bad); font-size: 0.875rem; }
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
    padding: 0.875rem; display: grid; gap: 0.75rem; align-content: start;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .card:hover { border-color: var(--a-edge); }
  .card.bloodied { border-color: color-mix(in oklch, var(--hurt-red) 35%, var(--line-soft)); }
  .card.critical, .card.down { border-color: color-mix(in oklch, var(--hurt-red) 70%, transparent); }
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
  .hpline { display: flex; align-items: baseline; gap: 0.3125rem; }
  .cap { font-size: 0.625rem; letter-spacing: 0.12em; color: var(--label); font-weight: 600; margin-right: 0.125rem; }
  .hpline b { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
  .of { color: var(--dim); font-size: 0.8125rem; }
  .temp { color: var(--a); font-size: 0.8125rem; font-weight: 600; }
  .vital { margin-left: auto; font-size: 0.75rem; color: var(--dim); }
  .bloodied .vital, .critical .vital, .down .vital, .dead .vital { color: var(--hurt-red); font-weight: 600; }
  .bar { height: 6px; border-radius: 3px; background: var(--bg); overflow: hidden; margin-top: 0.3125rem; }
  .bar i { display: block; height: 100%; background: var(--accent, var(--a)); transform-origin: left; transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.3, 1); }
  .bloodied .bar i, .critical .bar i { background: var(--hurt-red); }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.375rem; margin: 0; }
  .stats div { background: var(--raised); border: 1px solid var(--line-soft); border-radius: var(--r-sm); padding: 0.375rem; text-align: center; }
  .stats dt { font-size: 0.5625rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--label); }
  .stats dd { margin: 0.125rem 0 0; font-size: 1.0625rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  .conds { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.3125rem; }
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
    .tools { order: -1; width: 100%; justify-content: flex-end; }
  }
</style>
