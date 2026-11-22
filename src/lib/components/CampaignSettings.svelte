<script lang="ts">
  /**
   * The campaign's settings in one window over the dimmed page (the cog):
   * its name, the next session, the invite link, the crest, the banner, the
   * Owlbear Rodeo room, the name's font, the theme, and ending or deleting
   * it. The DM changes them, each saved as it is made; a player in the
   * campaign reads the name, the next session, the invite, and the room.
   * Its × closes it.
   */
  import { sessionWhen } from '#lib/rules/dates.ts';
  import { setNextSession, type Campaign, type CampaignDetails } from '#lib/data/campaigns.ts';
  import { resolveImageUrl } from '#lib/rules/imageUrl.ts';
  import { faceFamily, nameFont } from '#lib/rules/fonts.ts';
  import { webLink } from '#lib/rules/presence.ts';
  import DimModal from './DimModal.svelte';
  import InfoTip from './InfoTip.svelte';
  import ThemePicker from './ThemePicker.svelte';
  import Lightbox from './Lightbox.svelte';

  let {
    campaign,
    dm = true,
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
    /** The DM changes the settings; a player only reads them. */
    dm?: boolean;
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
  const next = $derived(sessionWhen(campaign.details.nextSession));
  const bannerLink = $derived(resolveImageUrl(campaign.details.bannerUrl));
  const crestLink = $derived(resolveImageUrl(campaign.details.crestUrl));
  /** A picture opened full screen (Lightbox), growing out of what was pressed. */
  let viewing = $state<{ src: string; alt: string; from?: Element | null } | null>(null);
  /** Whether each link turned into a picture, for the DM's thumbnails (as the sheet's Appearance). */
  let loads = $state<Record<string, 'ok' | 'failed'>>({});
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

<!-- A player sees the crest and the banner as they look; pressed, each opens full screen. -->
{#snippet crestPic()}
  {#if crestLink.url}
    <button type="button" class="bigpic crestpic" aria-label="View the crest full screen" title="View full screen"
            onclick={(e) => (viewing = { src: crestLink.url, alt: 'The campaign’s crest', from: e.currentTarget })}>
      <img src={crestLink.url} alt="The campaign's crest" />
    </button>
  {/if}
{/snippet}
{#snippet bannerPic()}
  {#if bannerLink.url}
    <button type="button" class="bigpic bannerpic" aria-label="View the banner full screen" title="View full screen"
            onclick={(e) => (viewing = { src: bannerLink.url, alt: 'The campaign’s banner', from: e.currentTarget })}>
      <img src={bannerLink.url} alt="The campaign's banner" />
    </button>
  {/if}
{/snippet}
<!-- The DM's: a link's field with a small picture of it beside, as a sheet's portrait and banner in
     Appearance: faint while it loads, pressed to open it full screen, red when it isn't a picture. -->
{#snippet linkField(role: 'crest' | 'banner', link: { url: string; source: string; note: string | null }, value: string, save: (v: string) => void, placeholder: string)}
  {@const status = link.url ? loads[link.url] : undefined}
  <div class="urlrow">
    <input id="campaign-{role}" {value} {placeholder} aria-label="{role === 'crest' ? 'Crest' : 'Banner'} link"
           onchange={(e) => save(e.currentTarget.value.trim())} />
    {#if link.url}
      <button type="button" class="thumb {role}" class:failed={status === 'failed'} class:ready={status === 'ok'}
              disabled={status !== 'ok'} aria-label="View the {role} full screen"
              title={status === 'failed' ? 'This link didn’t turn into a picture!' : 'View full screen'}
              onclick={(e) => (viewing = { src: link.url, alt: role === 'crest' ? 'The campaign’s crest' : 'The campaign’s banner', from: e.currentTarget })}>
        {#key link.url}
          <img src={link.url} alt="" onload={() => (loads[link.url] = 'ok')} onerror={() => (loads[link.url] = 'failed')} />
        {/key}
      </button>
    {/if}
  </div>
  {#if status === 'failed'}
    <p class="hint bad" role="status">That link didn’t turn into a picture! {link.source === 'drive' || link.source === 'onedrive'
      ? 'Check it is shared with anyone who has the link.'
      : 'Open the picture itself, copy its image address, and paste that instead.'}</p>
  {:else if link.note}
    <p class="hint" class:bad={link.source === 'invalid'}>{link.note}</p>
  {/if}
{/snippet}

<DimModal id="campaign-settings" title="Campaign Settings" wide closer onclose={close}>
  <div class="settings">
  {#if !dm}
    <!-- A player: what the DM set, to read, and the invite to pass on. -->
    <div class="row">
      <span class="label">Name</span>
      <p class="value" style:font-family={faceFamily(face)}>{campaign.name}</p>
    </div>
    <div class="row">
      <span class="label">Next session</span>
      <p class="value">{next ? `${next.when}${next.past ? '' : `, ${next.until}`}` : 'Not set yet'}</p>
    </div>
    {#if !ended}
      <div class="row">
        <span class="label">Invite link
          <InfoTip label="About the invite link">Pass it to a friend: they open it, sign in, and pick which character joins. Only your DM can make a new one.</InfoTip>
        </span>
        <div class="inline">
          <input readonly value={inviteLink || 'Fetching the link'} aria-label="Invite link" onfocus={(e) => e.currentTarget.select()} />
          <button class="smallbtn accent" onclick={copyInvite} disabled={!inviteLink}>{copied ? 'Copied!' : 'Copy'}</button>
        </div>
        {#if copyFailed}<p class="hint bad" role="status">The clipboard said no! Select the link and copy it yourself.</p>{/if}
      </div>
    {/if}
    {#if crestLink.url}
      <div class="row">
        <span class="label">Crest</span>
        {@render crestPic()}
      </div>
    {/if}
    {#if bannerLink.url}
      <div class="row">
        <span class="label">Banner</span>
        {@render bannerPic()}
      </div>
    {/if}
    <p class="hint">Only your DM can change these.</p>
  {:else}
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
          <InfoTip label="About the invite link">Players open it, sign in, and pick which character joins. Anyone with this page’s own link can watch, but only the invite lets a character in. A new link stops the old one working.</InfoTip>
        </span>
        <div class="inline">
          <input readonly value={inviteLink || 'Fetching the link'} aria-label="Invite link" onfocus={(e) => e.currentTarget.select()} />
          <button class="smallbtn accent" onclick={copyInvite} disabled={!inviteLink}>{copied ? 'Copied!' : 'Copy'}</button>
          <button class="smallbtn" onclick={onnewinvite} title="Make a new link; the old one stops working">New Link</button>
        </div>
        {#if copyFailed}<p class="hint bad" role="status">The clipboard said no! Select the link and copy it yourself.</p>{/if}
      </div>
    {/if}

    <div class="row">
      <span class="label">Crest link
        <InfoTip label="About the crest">The campaign's own picture, in place of the die at the top of its page and on its card in everyone's menu. A square picture suits it best.</InfoTip>
      </span>
      {@render linkField('crest', crestLink, campaign.details.crestUrl ?? '', (v) => onsave({ crestUrl: v }), 'Optional: a picture link')}
    </div>

    <div class="row">
      <label class="label" for="campaign-banner">Banner link</label>
      {@render linkField('banner', bannerLink, campaign.details.bannerUrl ?? '', (v) => onsave({ bannerUrl: v }), 'Optional: a wide picture link')}
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
          <button class="smallbtn danger" onclick={async () => { await onended(true); confirming = null; }}>End It</button>
          <button class="smallbtn quiet" onclick={() => (confirming = null)}>Keep Playing</button>
        {:else if confirming === 'delete'}
          <span class="ask">Delete this campaign for good? Its characters stay, out of any campaign.</span>
          <button class="smallbtn danger" onclick={ondelete}>Delete It</button>
          <button class="smallbtn quiet" onclick={() => (confirming = null)}>Keep</button>
        {:else}
          {#if ended}
            <button class="smallbtn" onclick={() => onended(false)}>Reopen Campaign</button>
          {:else}
            <button class="smallbtn" onclick={() => (confirming = 'end')}>End Campaign</button>
          {/if}
          <button class="smallbtn dangerish" onclick={() => (confirming = 'delete')}>Delete Campaign</button>
        {/if}
      </div>
    </div>
  {/if}
  </div>
</DimModal>

{#if viewing}
  <Lightbox src={viewing.src} alt={viewing.alt} from={viewing.from} onclose={() => (viewing = null)} />
{/if}

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
  .value { margin: 0; font-size: 0.9375rem; color: var(--text); overflow-wrap: anywhere; }
  /* A player's: the crest as on the page, a rounded square; the banner a wide strip, cut to fit. */
  .bigpic {
    display: block; padding: 0; overflow: hidden; cursor: zoom-in; border-radius: var(--r); background: var(--raised);
    transition: border-color 0.15s ease, transform 0.15s ease;
  }
  .bigpic img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .bigpic:hover { border-color: var(--a-edge); transform: scale(1.02); }
  .bigpic:active { transform: translateY(1px); }
  .bigpic:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
  .crestpic { width: 4.5rem; height: 4.5rem; border: 1px solid var(--a-edge); justify-self: start; }
  .bannerpic { width: 100%; height: 6rem; border: 1px solid var(--line-soft); }
  /* The DM's: the field and its small picture on one line (as the sheet's Appearance). */
  .urlrow { display: flex; align-items: center; gap: 0.625rem; }
  .urlrow input { flex: 1 1 auto; min-width: 0; }
  .thumb {
    padding: 0; cursor: zoom-in; flex: none; height: 2.125rem; border-radius: var(--r-sm); overflow: hidden;
    border: 1px solid var(--line); background: var(--raised); position: relative;
    opacity: 0.4; transition: opacity 0.25s ease, border-color 0.25s ease, transform 0.15s ease;
  }
  .thumb.crest { width: 2.125rem; }
  .thumb.banner { width: 4.5rem; }
  .thumb.ready { opacity: 1; }
  .thumb.ready:hover { border-color: var(--a-edge); transform: scale(1.04); }
  .thumb.ready:active { transform: translateY(1px); }
  .thumb:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  .thumb:disabled { cursor: default; }
  .thumb.failed { opacity: 1; border-color: var(--danger); background: var(--danger-wash); }
  .thumb.failed img { visibility: hidden; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
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
