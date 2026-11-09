<script lang="ts">
  import { siteRoot } from '$lib/rules/share';
  /**
   * A sheet's campaign, from its header in edit mode: join one with an invite,
   * start one (and run it as its DM), leave, or retire the character. A DM
   * also gets the campaign's invite link here to pass round the table.
   */
  import { onMount, untrack } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { base } from '$app/paths';
  import { portal } from '$lib/actions';
  import { prefersReducedMotion } from '$lib/motion';
  import { campaignMessage, campaignRepo, inviteCode, type Campaign } from '$lib/data/campaigns';
  import Switch from './Switch.svelte';

  let {
    sheetId,
    campaign,
    isDm,
    retired,
    suggestedName = '',
    themeCss = '',
    beforeChange,
    onjoined,
    onleave,
    onretire,
    onclose
  }: {
    sheetId: string;
    /** The campaign the sheet is in, if any. */
    campaign: Campaign | null;
    /** Whether the reader runs that campaign. */
    isDm: boolean;
    retired: boolean;
    /** A name to start a campaign with: what was typed before campaigns existed. */
    suggestedName?: string;
    themeCss?: string;
    /** Saves anything waiting first, so the sheet's row is current. */
    beforeChange: () => Promise<void>;
    onjoined: (campaignId: string, updatedAt: string | null) => void;
    onleave: () => Promise<void>;
    onretire: (retired: boolean) => Promise<void>;
    onclose: () => void;
  } = $props();

  const still = prefersReducedMotion();
  let busy = $state(false);
  let error = $state<string | null>(null);
  let code = $state('');
  let preview = $state<{ id: string; name: string } | null>(null);
  let newName = $state(untrack(() => suggestedName));
  let invite = $state<string | null>(null);
  let copied = $state(false);

  const inviteLink = $derived(
    invite && typeof location !== 'undefined' ? `${siteRoot(location.origin, base)}/join?code=${invite}` : ''
  );

  // The DM sees the invite as soon as the dialog opens.
  $effect(() => {
    if (!campaign || !isDm) return;
    campaignRepo.invite(campaign.id).then((c) => (invite = c)).catch(() => {});
  });

  // Naming the campaign an invite is for, as it is typed or pasted.
  let lookup: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const c = inviteCode(code);
    preview = null;
    clearTimeout(lookup);
    if (c.length < 6) return;
    lookup = setTimeout(() => {
      campaignRepo.byInvite(c).then((p) => { if (inviteCode(code) === c) preview = p; }).catch(() => {});
    }, 300);
  });

  async function run(task: () => Promise<void>) {
    busy = true;
    error = null;
    try {
      await beforeChange();
      await task();
    } catch (e) {
      error = campaignMessage(e, 'The dice slipped! Try that again.');
    } finally {
      busy = false;
    }
  }

  const join = () => run(async () => {
    const r = await campaignRepo.join(inviteCode(code), sheetId);
    onjoined(r.campaignId, r.sheetUpdatedAt);
    code = '';
  });
  const start = () => run(async () => {
    const r = await campaignRepo.create(newName.trim(), sheetId);
    invite = r.invite;
    onjoined(r.id, r.sheetUpdatedAt);
  });
  const leave = () => run(onleave);
  const resetInvite = () => run(async () => {
    if (campaign) invite = await campaignRepo.resetInvite(campaign.id);
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      error = 'The clipboard said no! Select the link and copy it yourself.';
    }
  }

  let box = $state<HTMLElement>();
  onMount(() => {
    box?.querySelector<HTMLElement>('[data-first]')?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onclose();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });
</script>

<div class="scrim themed" style={themeCss} use:portal role="presentation" transition:fade={{ duration: still ? 0 : 140 }}
     onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}>
  <div class="box" bind:this={box} role="dialog" aria-modal="true" aria-labelledby="campaign-title"
       transition:scale={{ start: 0.95, duration: still ? 0 : 180, easing: cubicOut }}>
    <h2 id="campaign-title">Campaign</h2>

    {#if campaign}
      <p class="lead">
        In <a href="{base}/c/{campaign.id}">{campaign.name}</a>{#if isDm}<span class="dm">You’re the DM</span>{/if}
      </p>
      {#if isDm}
        <h3>Invite link</h3>
        <p class="hint">Anyone with it can bring a character in. Make a new one to stop the old one working.</p>
        <div class="row">
          <input class="link" readonly value={inviteLink || 'Fetching…'} aria-label="Invite link"
                 onfocus={(e) => e.currentTarget.select()} />
          <button onclick={copy} disabled={!inviteLink} data-first="">{copied ? 'Copied!' : 'Copy'}</button>
        </div>
        <button class="quiet" onclick={resetInvite} disabled={busy}>New link</button>
      {/if}
      <div class="row end">
        <a class="btn" href="{base}/c/{campaign.id}">Open the campaign page</a>
        <button class="danger" onclick={leave} disabled={busy} data-first={isDm ? undefined : ''}>Leave</button>
      </div>
    {:else}
      <h3>Join with an invite</h3>
      <div class="row">
        <input bind:value={code} placeholder="Paste the invite link or code" aria-label="Invite link or code" data-first=""
               onkeydown={(e) => e.key === 'Enter' && inviteCode(code) && join()} />
        <button onclick={join} disabled={busy || !inviteCode(code)}>Join</button>
      </div>
      {#if preview}<p class="found" in:fade={{ duration: 160 }}>That’s the invite to <b>{preview.name}</b>.</p>{/if}

      <h3>Or start one</h3>
      <p class="hint">You run it as its DM, and get a link to invite the others.</p>
      <div class="row">
        <input bind:value={newName} placeholder="Campaign name" aria-label="Campaign name"
               onkeydown={(e) => e.key === 'Enter' && newName.trim() && start()} />
        <button onclick={start} disabled={busy || !newName.trim()}>Start</button>
      </div>
    {/if}

    <div class="retire">
      <Switch checked={retired} label="Retired" disabled={busy} onchange={(on) => run(() => onretire(on))} />
      <span>The character’s story is done: it stays on your list, and leaves the campaign page.</span>
    </div>

    {#if error}<p class="err" role="alert">{error}</p>{/if}
    <div class="row end"><button class="quiet" onclick={onclose}>Done</button></div>
  </div>
</div>

<style>
  .scrim {
    position: fixed; inset: 0; z-index: 55; display: grid; place-items: center; padding: 1rem;
    background: rgb(0 0 0 / 0.5); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
  }
  .box {
    width: min(27rem, 100%); background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--r); padding: 1.125rem; box-shadow: 0 20px 60px rgb(0 0 0 / 0.45);
  }
  h2 { margin: 0; font-size: 1.0625rem; font-weight: 650; }
  h3 {
    margin: 1rem 0 0.4375rem; font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--label); font-weight: 600;
  }
  .lead { margin: 0.5rem 0 0; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .lead a { color: var(--a); font-weight: 600; }
  .dm {
    font-size: 0.6875rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--a);
    border: 1px solid var(--a-edge); background: var(--a-wash); border-radius: 999px; padding: 0.0625rem 0.5rem;
  }
  .hint { margin: 0 0 0.5rem; color: var(--dim); font-size: 0.8125rem; line-height: 1.45; }
  .found { margin: 0.375rem 0 0; font-size: 0.8125rem; color: var(--text); }
  .row { display: flex; gap: 0.5rem; align-items: center; }
  .row.end { justify-content: flex-end; margin-top: 1rem; }
  input {
    flex: 1; min-width: 0; font: inherit; font-size: 0.875rem; padding: 0.4375rem 0.625rem;
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg); color: var(--text);
  }
  input:focus { outline: none; border-color: var(--a-edge); }
  .link { font-size: 0.8125rem; color: var(--dim); }
  button, .btn {
    font: inherit; font-size: 0.875rem; cursor: pointer; border-radius: var(--r-sm); padding: 0.4375rem 0.875rem;
    border: 1px solid var(--a-edge); background: var(--a-wash); color: var(--a); text-decoration: none;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }
  button:hover:not(:disabled), .btn:hover { border-color: var(--a); }
  button:disabled { opacity: 0.5; cursor: default; }
  .quiet { border-color: var(--line); background: none; color: var(--dim); margin-top: 0.5rem; }
  .quiet:hover:not(:disabled) { color: var(--text); border-color: var(--a-edge); }
  .danger { border-color: color-mix(in oklch, var(--bad) 50%, transparent); background: none; color: var(--bad); }
  .retire {
    display: flex; gap: 0.625rem; align-items: flex-start; margin-top: 1.125rem; padding-top: 0.875rem;
    border-top: 1px solid var(--line-soft); font-size: 0.8125rem; color: var(--dim); line-height: 1.45;
  }
  .retire :global(.switch) { flex: none; }
  .err { margin: 0.75rem 0 0; font-size: 0.8125rem; color: var(--bad); }
</style>
