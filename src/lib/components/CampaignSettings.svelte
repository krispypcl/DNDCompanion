<script lang="ts">
  /**
   * The campaign's settings, the DM's alone, in one window over the dimmed
   * page (the gear beside Back): its name, the next session, the invite
   * link, the crest, the banner, the Owlbear Rodeo room, the name's font,
   * the theme, and ending or deleting it.
   * Each change is saved as it is made, as on the page before; Done closes.
   */
  import { setNextSession, type Campaign, type CampaignDetails } from '#lib/data/campaigns.ts';
  import { resolveImageUrl } from '#lib/rules/imageUrl.ts';
  import { faceFamily, nameFont } from '#lib/rules/fonts.ts';
  import { webLink } from '#lib/rules/presence.ts';
  import DimModal from './DimModal.svelte';
  import InfoTip from './InfoTip.svelte';
  import ThemePicker from './ThemePicker.svelte';

  let {
    campaign,
    inviteLink,
    onrename,
    onsave,
    onnewinvite,
    onended,
    ondelete,
    onpreview,
    onclose
  }: {
    campaign: Campaign;
    inviteLink: string;
    onrename: (name: string) => Promise<void> | void;
    onsave: (patch: Partial<CampaignDetails>) => Promise<void> | void;
    onnewinvite: () => Promise<void> | void;
    onended: (ended: boolean) => Promise<void> | void;
    ondelete: () => Promise<void> | void;
    /** The theme being tried, shown on the page behind (null when the picking stops). */
    onpreview: (hex: string | null) => void;
    onclose: () => void;
  } = $props();

  const ended = $derived(campaign.archived);
  const bannerLink = $derived(resolveImageUrl(campaign.details.bannerUrl));
  const crestLink = $derived(resolveImageUrl(campaign.details.crestUrl));
  const owlbearBad = $derived(Boolean(campaign.details.owlbearUrl?.trim()) && !webLink(campaign.details.owlbearUrl));
  const font = $derived(nameFont(campaign.details.nameFont));
  const face = $derived(font && font !== 'bad' ? font : null);
  /** Which of the last two buttons is asking to be sure. */
  let confirming = $state<'end' | 'delete' | null>(null);
  let copied = $state(false);
  let copyFailed = $state(false);

  /** An ISO time as a datetime-local input shows it, in this device's time. */
  function localInput(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      copied = true;
      copyFailed = false;
      setTimeout(() => (copied = false), 1600);
    } catch {
      copyFailed = true;
    }
  }
  function close() {
    onpreview(null);
    onclose();
  }
</script>

<DimModal id="campaign-settings" title="Campaign settings" wide onclose={close}>
  <div class="settings">
    <label class="row">
      <span class="label">Name</span>
      <input value={campaign.name} maxlength="80" placeholder="Campaign name" aria-label="Campaign name"
             style:font-family={faceFamily(face)}
             onchange={(e) => { const v = e.currentTarget.value.trim(); if (v && v !== campaign.name) void onrename(v); }} />
    </label>

    <div class="row">
      <label class="label" for="campaign-next">Next session</label>
      <div class="inline">
        <input id="campaign-next" type="datetime-local" value={localInput(campaign.details.nextSession)}
               onchange={(e) => onsave(setNextSession(campaign.details, e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : ''))} />
        {#if campaign.details.nextSession}
          <button class="smallbtn" onclick={() => onsave(setNextSession(campaign.details, ''))}>Clear</button>
        {/if}
      </div>
    </div>

    {#if !ended}
      <div class="row">
        <span class="label">Invite link
          <InfoTip label="About the invite link">Players open it, sign in and pick which character joins. Anyone with this page’s own link can watch, but only the invite lets a character in. A new link stops the old one working.</InfoTip>
        </span>
        <div class="inline">
          <input readonly value={inviteLink || 'Fetching the link'} aria-label="Invite link" onfocus={(e) => e.currentTarget.select()} />
          <button class="smallbtn accent" onclick={copyInvite} disabled={!inviteLink}>{copied ? 'Copied!' : 'Copy'}</button>
          <button class="smallbtn" onclick={onnewinvite} title="Make a new link; the old one stops working">New link</button>
        </div>
        {#if copyFailed}<p class="hint bad" role="status">The clipboard said no! Select the link and copy it yourself.</p>{/if}
      </div>
    {/if}

    <div class="row">
      <span class="label">Crest
        <InfoTip label="About the crest">The campaign's own picture, in place of the die at the top of its page and on its card in everyone's menu. A square picture suits it best.</InfoTip>
      </span>
      <input value={campaign.details.crestUrl ?? ''} placeholder="Optional: a picture link" aria-label="Crest link"
             onchange={(e) => onsave({ crestUrl: e.currentTarget.value.trim() })} />
      {#if crestLink.note}<p class="hint" class:bad={crestLink.source === 'invalid'}>{crestLink.note}</p>{/if}
    </div>

    <div class="row">
      <label class="label" for="campaign-banner">Banner link</label>
      <input id="campaign-banner" value={campaign.details.bannerUrl ?? ''} placeholder="Optional: a wide picture link"
             onchange={(e) => onsave({ bannerUrl: e.currentTarget.value.trim() })} />
      {#if bannerLink.note}<p class="hint" class:bad={bannerLink.source === 'invalid'}>{bannerLink.note}</p>{/if}
    </div>

    <div class="row">
      <span class="label">Owlbear Rodeo room
        <InfoTip label="About the Owlbear Rodeo room">Your table's room on owlbear.rodeo. Everyone in the campaign gets a button for it at the top of this page.</InfoTip>
      </span>
      <input value={campaign.details.owlbearUrl ?? ''} placeholder="Optional: your room's link" aria-label="Owlbear Rodeo room link"
             onchange={(e) => onsave({ owlbearUrl: e.currentTarget.value.trim() })} />
      {#if owlbearBad}<p class="hint bad" role="status">That doesn't look like a link! Copy your room's address from Owlbear Rodeo.</p>{/if}
    </div>

    <div class="row">
      <span class="label">Name font
        <InfoTip label="About the name font">
          The font of the campaign's name, on this page and in your list of campaigns. On
          <a href="https://fonts.google.com" target="_blank" rel="noopener noreferrer">fonts.google.com</a>, open a font
          and copy the address of its page (or the link from "Get font" → "Get embed code"). Paste either here, or
          just the font's name. Leave it blank for the site's own font.
        </InfoTip>
      </span>
      <input value={campaign.details.nameFont ?? ''} placeholder="Optional: a Google Fonts link" aria-label="Name font"
             onchange={(e) => onsave({ nameFont: e.currentTarget.value.trim() })} />
      {#if font === 'bad'}
        <p class="hint bad" role="status">That’s not a font we can find! Paste a link from fonts.google.com, or the font’s name.</p>
      {:else if face}
        <p class="hint" role="status">Using <span style:font-family={faceFamily(face)}>{face.family}</span></p>
      {/if}
    </div>

    <div class="row">
      <span class="label">Campaign theme</span>
      <ThemePicker value={campaign.details.theme} label="Campaign theme"
                   onpreview={(hex) => onpreview(hex)}
                   onchange={(name) => { onpreview(null); void onsave({ theme: name }); }} />
    </div>

    <div class="foot">
      <div class="ending">
        {#if confirming === 'end'}
          <span class="ask">End this campaign? It moves to your archived campaigns, its characters stay in it, and you can reopen it later.</span>
          <button class="smallbtn danger" onclick={async () => { await onended(true); confirming = null; }}>End it</button>
          <button class="smallbtn quiet" onclick={() => (confirming = null)}>Keep playing</button>
        {:else if confirming === 'delete'}
          <span class="ask">Delete this campaign for good? Its characters stay, out of any campaign.</span>
          <button class="smallbtn danger" onclick={ondelete}>Delete it</button>
          <button class="smallbtn quiet" onclick={() => (confirming = null)}>Keep</button>
        {:else}
          {#if ended}
            <button class="smallbtn" onclick={() => onended(false)}>Reopen campaign</button>
          {:else}
            <button class="smallbtn" onclick={() => (confirming = 'end')}>End campaign</button>
          {/if}
          <button class="smallbtn dangerish" onclick={() => (confirming = 'delete')}>Delete campaign</button>
        {/if}
      </div>
      <button class="smallbtn accent" onclick={close}>Done</button>
    </div>
  </div>
</DimModal>

<style>
  .settings { display: grid; gap: 1.125rem; }
  .row { display: grid; gap: 0.375rem; min-width: 0; }
  .label {
    display: inline-flex; align-items: center; gap: 0.25rem;
    font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--label); font-weight: 600;
  }
  .inline { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .inline input { flex: 1; min-width: 12rem; }
  input {
    font: inherit; font-size: 0.875rem; padding: 0.4375rem 0.625rem; color: var(--text); min-width: 0;
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg); color-scheme: inherit;
  }
  input[readonly] { color: var(--dim); }
  input:focus { outline: none; border-color: var(--a-edge); }
  .hint { margin: 0; font-size: 0.8125rem; color: var(--dim); line-height: 1.45; }
  .hint.bad { color: var(--bad); }
  .foot {
    display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;
    margin-top: 0.375rem; padding-top: 1rem; border-top: 1px solid var(--line-soft);
  }
  .ending { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; flex: 1; min-width: 0; }
  .ask { font-size: 0.8125rem; color: var(--dim); line-height: 1.4; flex-basis: 100%; }
  .smallbtn.danger { color: var(--bad); border-color: color-mix(in oklab, var(--bad) 55%, transparent); }
  .smallbtn.danger:hover { background: color-mix(in oklab, var(--bad) 12%, transparent); }
  .smallbtn.dangerish:hover { color: var(--bad); border-color: color-mix(in oklab, var(--bad) 55%, transparent); }
</style>
