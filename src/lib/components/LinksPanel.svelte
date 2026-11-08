<script lang="ts">
  /**
   * The Appearance tab: how the sheet looks and sounds. The portrait and
   * banner (shown as pictures, pressed for full screen), the theme, the
   * music (by its name on YouTube), the player's own links, and any sound
   * effect swapped for a recording or a YouTube clip of their own. Editing,
   * the addresses are typed in, with what each accepts behind an "i".
   */
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { fade, slide } from 'svelte/transition';
  import { parsePlaylist, youtubeTitle } from '$lib/music';
  import InfoTip from './InfoTip.svelte';
  import ThemePicker from './ThemePicker.svelte';
  import { resolveImageUrl } from '$lib/rules/imageUrl';
  import { SOUND_NAMES, audioUrl, playClip, type SoundName } from '$lib/sound';
  import { foldRow, prefersReducedMotion } from '$lib/motion';
  import EditableField from './EditableField.svelte';
  import Lightbox from './Lightbox.svelte';
  import type { Definition } from '$lib/types';

  let {
    definition,
    editable,
    onchange,
    onthemepreview
  }: {
    definition: Definition;
    editable: boolean;
    onchange: (next: Definition) => void;
    /** The theme being dragged to, before it is kept. */
    onthemepreview?: (hex: string | null) => void;
  } = $props();

  // ── The music, by name ──
  const music = $derived(parsePlaylist(definition.identity.playlistUrl));
  let musicTitle = $state<string | null>(null);
  $effect(() => {
    const link = music;
    musicTitle = null;
    if (!link) return;
    let gone = false;
    void youtubeTitle(link).then((t) => { if (!gone) musicTitle = t; });
    return () => { gone = true; };
  });
  const musicName = $derived(musicTitle ?? (music?.list ? 'YouTube playlist' : 'YouTube video'));
  /** A picture that failed to load is shown as the empty frame. */
  let broken = $state<Record<string, boolean>>({});

  const portraitLink = $derived(resolveImageUrl(definition.identity.portraitUrl));
  const bannerLink = $derived(resolveImageUrl(definition.identity.bannerUrl));
  /** Whether each resolved address actually loaded, so a link that cannot be
      shown says so while it is being pasted rather than leaving a blank. */
  let loads = $state<Record<string, 'loading' | 'ok' | 'failed'>>({});
  const loadState = (url: string) => (url ? (loads[url] ?? 'loading') : null);
  let viewing = $state<{ src: string; alt: string; from?: Element | null } | null>(null);
  function patchIdentity(key: string, value: string) {
    onchange({ ...definition, identity: { ...definition.identity, [key]: value } });
  }

  // ── The player's own links ──
  const links = $derived(definition.links ?? []);
  let draftLabel = $state('');
  let draftUrl = $state('');
  const cleanUrl = (raw: string) => {
    const t = raw.trim();
    if (!t) return '';
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  };
  const hostOf = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };
  function addLink() {
    const url = cleanUrl(draftUrl);
    if (!url) return;
    onchange({ ...definition, links: [...links, { label: draftLabel.trim() || hostOf(url), url }] });
    draftLabel = '';
    draftUrl = '';
  }
  function patchLink(i: number, patch: Partial<{ label: string; url: string }>) {
    onchange({ ...definition, links: links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  }
  function removeLink(i: number) {
    onchange({ ...definition, links: links.filter((_, j) => j !== i) });
  }

  // ── Sound effects ──
  const sounds = $derived(definition.sounds ?? {});
  const SOUND_KEYS = Object.keys(SOUND_NAMES) as SoundName[];
  const customSounds = $derived(SOUND_KEYS.filter((k) => sounds[k]));
  function setSoundUrl(key: SoundName, value: string) {
    const next = { ...sounds };
    if (value.trim()) next[key] = value.trim();
    else delete next[key];
    onchange({ ...definition, sounds: next });
  }
  const unfold = () => ({ duration: prefersReducedMotion() ? 0 : 220, easing: cubicOut });
</script>

<div class="links">
  <!-- The portrait and banner. Reading, they are pictures to look at. -->
  <section>
    <h3 class="cap">Pictures</h3>
    {#if editable}
      {#each [
        { role: 'portrait', label: 'Portrait URL', key: 'portraitUrl', link: portraitLink, placeholder: 'An image link' },
        { role: 'banner', label: 'Banner URL', key: 'bannerUrl', link: bannerLink, placeholder: 'Optional: a wide image link' }
      ] as const as field (field.role)}
        {@const status = loadState(field.link.url)}
        <div class="wide" data-flip-ghost="links:url:{field.role}" data-ghost-scale="0.94">
          <span class="lbl">{field.label}
            <InfoTip label="About the {field.role}">
              {#if field.role === 'portrait'}
                The character's picture, beside their name and on the campaign page. Paste any image link: Google Drive,
                Dropbox, OneDrive, Imgur or a direct image address. A Drive file has to be shared as "Anyone with the link".
              {:else}
                A wide picture shown behind the top of the sheet. Optional: without one the sheet looks as it always has.
                The same links work as for the portrait.
              {/if}
            </InfoTip>
          </span>
          <div class="urlrow">
            <div class="urlfield">
              <EditableField value={definition.identity[field.key] ?? ''} editable={true} label={field.label}
                             placeholder={field.placeholder} onchange={(v) => patchIdentity(field.key, String(v))} />
            </div>
            {#if field.link.url}
              <button type="button" class="thumb {field.role}" class:failed={status === 'failed'} class:ready={status === 'ok'}
                      disabled={status !== 'ok'} aria-label="View {field.role} full screen"
                      title={status === 'failed' ? 'This link didn’t turn into a picture!' : 'View full screen'}
                      onclick={(e) => (viewing = { src: field.link.url, alt: field.label.replace(' URL', ''), from: e.currentTarget })}>
                {#key field.link.url}
                  <img src={field.link.url} alt="" onload={() => (loads[field.link.url] = 'ok')}
                       onerror={() => (loads[field.link.url] = 'failed')} />
                {/key}
              </button>
            {/if}
          </div>
          {#if status === 'failed'}
            <p class="urlnote bad" role="status">
              That link didn’t turn into a picture! {field.link.source === 'drive' || field.link.source === 'onedrive'
                ? 'Check it is shared with anyone who has the link.'
                : 'Open the picture itself, copy its image address and paste that instead.'}
            </p>
          {:else if field.link.source === 'invalid' && field.link.note}
            <p class="urlnote bad" role="status">{field.link.note}</p>
          {/if}
        </div>
      {/each}
    {:else}
      <div class="pics" data-flip-ghost="links:read:pictures">
        {#if portraitLink.url && !broken[portraitLink.url]}
          <button class="pic portrait" aria-label="View portrait full screen"
                  onclick={(e) => (viewing = { src: portraitLink.url, alt: `Portrait of ${definition.identity.name}`, from: e.currentTarget })}>
            <img src={portraitLink.url} alt="Portrait of {definition.identity.name}" onerror={() => (broken[portraitLink.url] = true)} />
          </button>
        {:else}
          <div class="pic portrait empty" aria-label="No portrait yet" role="img">
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><circle cx="12" cy="9" r="4" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
          </div>
        {/if}
        {#if bannerLink.url && !broken[bannerLink.url]}
          <button class="pic banner" aria-label="View banner full screen"
                  onclick={(e) => (viewing = { src: bannerLink.url, alt: `Banner of ${definition.identity.name}`, from: e.currentTarget })}>
            <img src={bannerLink.url} alt="Banner of {definition.identity.name}" onerror={() => (broken[bannerLink.url] = true)} />
          </button>
        {:else}
          <div class="pic banner empty" aria-label="No banner yet" role="img">
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="m3 16 5-5 4 4 3-3 6 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /><circle cx="16" cy="9" r="1.5" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
          </div>
        {/if}
      </div>
    {/if}
  </section>

  {#if editable}
    <section transition:slide={unfold()}>
      <h3 class="cap">Character theme</h3>
      <ThemePicker value={definition.identity.theme} onpreview={(hex) => onthemepreview?.(hex)}
                   onchange={(name) => patchIdentity('theme', name)} />
    </section>
  {/if}

  <!-- The sheet's music. -->
  <section>
    <h3 class="cap">Music</h3>
    {#if editable}
      <div class="wide" data-flip-ghost="links:url:playlist" data-ghost-scale="0.94">
        <span class="lbl">Playlist URL
          <InfoTip label="About the music">
            A YouTube or YouTube Music playlist, or one video. It plays from the player at the top of the sheet; the
            speaker button is its mute.
          </InfoTip>
        </span>
        <EditableField value={definition.identity.playlistUrl ?? ''} editable={true} label="Playlist URL"
                       placeholder="Optional: a YouTube link"
                       onchange={(v) => patchIdentity('playlistUrl', String(v).trim())} />
        {#if definition.identity.playlistUrl?.trim()}
          {#if !music}
            <p class="urlnote bad" role="status">That’s not a tune we know! Paste a YouTube or YouTube Music link.</p>
          {:else}
            <p class="urlnote" role="status">♪ {musicName}</p>
          {/if}
        {/if}
      </div>
    {:else if music}
      <a class="go" href={cleanUrl(definition.identity.playlistUrl ?? '')} target="_blank" rel="noopener noreferrer">
        <span class="note" aria-hidden="true">♪</span>
        {#key musicName}<b in:fade={{ duration: 200 }}>{musicName}</b>{/key}
        <span>{music.list ? 'Playlist' : 'Video'} on YouTube</span>
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </a>
    {:else}
      <p class="none">No music yet.</p>
    {/if}
  </section>

  <!-- The player's own links. -->
  <section>
    <h3 class="cap">Your links
      <InfoTip label="About your links">
        Anything you keep reaching for during a game: a map, the campaign wiki, a character builder. Each opens in a new tab.
      </InfoTip>
    </h3>

    <ul class="own">
      {#each links as link, i (i + link.url)}
        <li animate:flip={{ duration: 200, easing: cubicOut }} transition:foldRow>
          {#if editable}
            <div class="linkedit">
              <EditableField value={link.label} editable={true} label="Link name" placeholder="Name"
                             onchange={(v) => patchLink(i, { label: String(v) })} />
              <EditableField value={link.url} editable={true} label="Link address" placeholder="https://…"
                             onchange={(v) => patchLink(i, { url: cleanUrl(String(v)) })} />
              <button class="x" aria-label="Remove {link.label}" title="Remove" onclick={() => removeLink(i)}>×</button>
            </div>
          {:else}
            <a class="go" href={link.url} target="_blank" rel="noopener noreferrer">
              <b>{link.label}</b><span>{hostOf(link.url)}</span>
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </a>
          {/if}
        </li>
      {/each}
    </ul>
    {#if editable}
      <div class="add" transition:slide={unfold()}>
        <input bind:value={draftLabel} placeholder="Name (e.g. Campaign wiki)" aria-label="New link name" />
        <input bind:value={draftUrl} placeholder="Address" aria-label="New link address"
               onkeydown={(e) => { if (e.key === 'Enter') addLink(); }} />
        <button onclick={addLink} disabled={!draftUrl.trim()}>Add link</button>
      </div>
    {:else if !links.length}
      <p class="none">No links yet.</p>
    {/if}
  </section>

  <!-- Sound effects: any of them can be a recording of the player's own. -->
  <section>
    <h3 class="cap">Sound effects
      <InfoTip label="About sound effects">
        Swap any built-in sound for your own: a link to a sound file (mp3, ogg or wav; a Google Drive or Dropbox share
        link works), or a YouTube video. A YouTube clip plays from its t= time (or the start) for up to 12 seconds, or
        until its end= time. Leave a field blank for the built-in sound.
      </InfoTip>
    </h3>
    {#if editable}
      <div class="sounds">
        {#each SOUND_KEYS as key (key)}
          <div class="snd" data-flip-ghost="links:sound:{key}" data-ghost-scale="0.96">
            <span class="lbl">{SOUND_NAMES[key]}</span>
            <div class="urlrow">
              <div class="urlfield">
                <EditableField value={sounds[key] ?? ''} editable={true} label="{SOUND_NAMES[key]} sound link"
                               placeholder="Built-in" onchange={(v) => setSoundUrl(key, String(v))} />
              </div>
              {#if sounds[key]}
                {@const url = audioUrl(sounds[key])}
                <button class="play" aria-label="Play {SOUND_NAMES[key]}" title={url ? 'Play it' : 'That isn’t a link we can play'}
                        disabled={!url} onclick={() => url && playClip(url)} in:fade={{ duration: 150 }}>
                  <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor" /></svg>
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {:else if customSounds.length}
      <ul class="chips" data-flip-ghost="links:read:sounds">
        {#each customSounds as key (key)}
          {@const url = audioUrl(sounds[key])}
          <li><button class="chipbtn" disabled={!url} onclick={() => url && playClip(url)} title="Play it">
            <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor" /></svg>
            {SOUND_NAMES[key]}</button></li>
        {/each}
      </ul>
    {:else}
      <p class="none">All built-in.</p>
    {/if}
  </section>
</div>

{#if viewing}
  <Lightbox src={viewing.src} alt={viewing.alt} from={viewing.from} onclose={() => (viewing = null)} />
{/if}

<style>
  .links { display: grid; gap: 1.5rem; }
  section { display: grid; gap: 0.625rem; }
  .cap { margin: 0; font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--label); font-weight: 600; }
  .lbl { display: block; font-size: 0.6875rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--label); font-weight: 600; margin-bottom: 0.125rem; }
  .wide { min-width: 0; }
  .lbl, h3.cap { display: flex; align-items: center; gap: 0.25rem; }
  .lbl :global(.info), h3.cap :global(.info) { text-transform: none; letter-spacing: 0; }
  /* Reading: the pictures themselves, pressed for full screen. */
  .pics { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; }
  .pic {
    flex: none; padding: 0; border: 1px solid var(--line); border-radius: var(--r); overflow: hidden;
    background: var(--raised); cursor: zoom-in; transition: transform 0.15s ease, opacity 0.15s ease, border-color 0.15s ease;
  }
  .pic img { display: block; width: 100%; height: 100%; object-fit: cover; }
  button.pic:hover { transform: scale(1.02); border-color: var(--a-edge); }
  .pic.portrait { width: 7rem; height: 7rem; }
  .pic.banner { flex: 1 1 12rem; max-width: 22rem; height: 7rem; }
  .pic.empty { display: grid; place-items: center; color: var(--faint); cursor: default; }
  .go .note { color: var(--a); flex: none; }
  .go b { flex: none; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wide :global(.field), .snd :global(.field), .linkedit :global(.field) { width: 100%; field-sizing: fixed; }
  .urlrow { display: flex; align-items: center; gap: 0.625rem; }
  .urlfield { flex: 1 1 auto; min-width: 0; }
  .thumb {
    padding: 0; cursor: zoom-in; flex: none; height: 2.125rem; border-radius: var(--r-sm); overflow: hidden;
    border: 1px solid var(--line); background: var(--raised); position: relative;
    opacity: 0.4; transition: opacity 0.25s ease, border-color 0.25s ease, transform 0.15s ease;
  }
  .thumb.portrait { width: 2.125rem; }
  .thumb.banner { width: 4.5rem; }
  .thumb.ready { opacity: 1; }
  .thumb.ready:hover { border-color: var(--a-edge); transform: scale(1.04); }
  .thumb:disabled { cursor: default; }
  .thumb.failed { opacity: 1; border-color: var(--danger); background: var(--danger-wash); }
  .thumb.failed img { visibility: hidden; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .urlnote { margin: 0.1875rem 0 0 calc(0.3rem + 1px); font-size: 0.78rem; line-height: 1.45; color: var(--dim); }
  .urlnote.bad { color: var(--danger); }
  .hint, .none { margin: 0; font-size: 0.8125rem; color: var(--dim); line-height: 1.45; }
  .chips, .own { list-style: none; margin: 0; padding: 0; }
  .chips { display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .chipbtn {
    display: inline-flex; align-items: baseline; gap: 0.375rem; padding: 0.3125rem 0.625rem; border-radius: 999px;
    border: 1px solid var(--line); background: var(--raised); color: var(--text); text-decoration: none; font: inherit; font-size: 0.8125rem;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .chipbtn { align-items: center; cursor: pointer; }
  .chipbtn:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  .own { display: grid; gap: 0.375rem; }
  .go {
    display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 0.75rem; border-radius: var(--r-sm);
    border: 1px solid var(--line-soft); background: var(--raised); color: var(--text); text-decoration: none;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }
  .go span { color: var(--dim); font-size: 0.8125rem; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .go svg { color: var(--dim); flex: none; }
  .go:hover { border-color: var(--a-edge); background: var(--hover-bg); }
  .go:hover svg { color: var(--a); }
  .linkedit { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto; gap: 0.5rem; align-items: center; }
  .x { width: 1.75rem; height: 1.75rem; padding: 0; border: 0; background: none; color: var(--dim); font-size: 1.1rem; cursor: pointer; }
  .x:hover { color: var(--bad); }
  .add { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto; gap: 0.5rem; }
  .add input {
    min-width: 0; font: inherit; font-size: 0.875rem; padding: 0.4375rem 0.625rem; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  .add input:focus { outline: none; border-color: var(--a-edge); }
  .add button, .play {
    font: inherit; font-size: 0.8125rem; cursor: pointer; border-radius: var(--r-sm); padding: 0.4375rem 0.75rem;
    border: 1px solid var(--a-edge); background: var(--a-wash); color: var(--a); white-space: nowrap;
  }
  .add button:disabled, .play:disabled, .chipbtn:disabled { opacity: 0.5; cursor: default; }
  .play { width: 2rem; height: 2rem; padding: 0; display: grid; place-items: center; flex: none; }
  .sounds { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.75rem 1rem; }
  @media (max-width: 560px) {
    .add, .linkedit { grid-template-columns: 1fr; }
  }
</style>
