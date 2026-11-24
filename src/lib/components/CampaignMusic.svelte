<script lang="ts">
  /**
   * The campaign's jukebox: the DM's list of songs and the sheet's own music
   * player for whichever is chosen. The DM chooses, plays, pauses, and skips;
   * everyone else's page follows along (database/0008, campaign_live), with
   * only their own volume and speaker. A playlist pasted in is added song by
   * song. When one ends, the next follows unless the DM's loop is on. Adding
   * and removing songs is for edit mode.
   *
   * Whole, it is the player beside the list of songs (the list in a frosted
   * box as tall as the player). For the DM, the field to add one sits above
   * the list, on the title's line and as wide as the list, always there. Compact, it is
   * the little capsule (MusicPlayer's): the song playing, a mute, and a volume
   * slider. The players only ever see that; the DM folds the jukebox into it
   * with the icon beside the song's name and opens it again, in view or edit
   * mode alike. The same player plays underneath either way, so the music
   * never stops for the switch.
   */
  import { onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { fade, foldRow, prefersReducedMotion } from '#lib/motion.ts';
  import { cubicOut } from 'svelte/easing';
  import { clock, inBatches, parsePlaylist, playlistSongs, setMusicOn, songLengths, youtubeTitle } from '#lib/music.ts';
  import type { Playback, Song } from '#lib/data/campaigns.ts';
  import MusicPlayer from './MusicPlayer.svelte';
  import SectionHead from './SectionHead.svelte';

  let {
    campaignId,
    songs,
    editing,
    lead,
    playback = null,
    away = false,
    compact = false,
    oncompact,
    onexpand,
    onplayback,
    onchange
  }: {
    /** The capsule (see above). */
    compact?: boolean;
    /** The DM folds the jukebox into the capsule, or opens it again. */
    oncompact?: () => void;
    onexpand?: () => void;
    campaignId: string;
    songs: Song[];
    editing: boolean;
    /** The DM: they choose and play; everyone else follows. */
    lead: boolean;
    /** What the DM's music is doing (its `at` already on this device's clock). */
    playback?: Playback | null;
    onplayback?: (p: Playback) => void;
    /** A player's page, with the DM not on the campaign page. */
    away?: boolean;
    onchange: (songs: Song[]) => Promise<void> | void;
  } = $props();

  const memoryKey = $derived(`dndcompanion:jukebox:${campaignId}`);
  let current = $state(0);
  $effect(() => {
    try {
      current = Number(localStorage.getItem(memoryKey)) || 0;
    } catch {
      current = 0;
    }
  });
  // The DM picks up where the table's music is, on any device.
  let tookPlayback = false;
  $effect(() => {
    if (lead && playback && !tookPlayback) {
      tookPlayback = true;
      current = playback.index;
    }
  });
  /** Which song: the DM's choice, or for everyone else, the DM's. */
  const index = $derived(lead ? current : (playback?.index ?? -1));
  const playingSong = $derived(index >= 0 && songs.length ? songs[Math.min(index, songs.length - 1)] : null);
  const followMoment = $derived(!lead && playback ? { playing: playback.playing, t: playback.t, item: playback.item, at: playback.at } : null);
  const resumeMoment = $derived(lead && playback && playback.index === current ? { playing: playback.playing, t: playback.t, item: playback.item, at: playback.at } : null);

  function choose(i: number) {
    if (!lead) return;
    current = i;
    try { localStorage.setItem(memoryKey, String(i)); } catch { /* private window */ }
    onplayback?.({ index: i, url: songs[i]?.url, playing: true, t: 0, at: Date.now() });
    // Choosing a song is asking to hear it.
    setMusicOn(true);
  }
  function told(m: { playing: boolean; t: number; item?: number }) {
    const song = songs[current];
    if (!song) return;
    onplayback?.({ index: current, url: song.url, ...m, at: Date.now() });
  }
  const next = () => songs.length > 1 && choose((current + 1) % songs.length);

  let adding = $state('');
  let busy = $state(false);
  let problem = $state<string | null>(null);
  /** A new song arrives already named: YouTube is asked first. */
  async function add() {
    const link = adding.trim();
    if (!link || busy) return;
    const found = parsePlaylist(link);
    if (!found) {
      problem = 'That’s not a tune the bard knows! Paste a YouTube or YouTube Music link.';
      return;
    }
    if (songs.some((s) => s.url === link)) {
      problem = 'That one’s already on the list! The bard only needs it once.';
      return;
    }
    problem = null;
    busy = true;
    try {
      // A playlist: every song in it, one by one, each named.
      if (found.list) {
        let ids: string[];
        try {
          ids = await playlistSongs(found.list);
        } catch {
          problem = 'That playlist wouldn’t open its doors! It may be private, or the link is off.';
          return;
        }
        const have = new Set(songs.map((s) => parsePlaylist(s.url)?.video).filter(Boolean));
        const fresh = ids.filter((id) => !have.has(id)).slice(0, Math.max(0, MAX_SONGS - songs.length));
        if (!fresh.length) {
          problem = ids.length ? 'Every song in that playlist is already on the list!' : 'That playlist is empty! Nothing to add.';
          return;
        }
        progress = { done: 0, of: fresh.length };
        const named = await inBatches(fresh, 6, async (id) => {
          const name = await youtubeTitle({ kind: 'youtube', video: id });
          return name ? { url: `https://youtu.be/${id}`, name } : { url: `https://youtu.be/${id}` };
        }, (done) => (progress = { done, of: fresh.length }));
        adding = '';
        await onchange([...songs, ...named]);
        if (ids.length > fresh.length && songs.length + fresh.length >= MAX_SONGS) {
          problem = `The list holds ${MAX_SONGS} songs, so the rest of that playlist stayed off it.`;
        }
        return;
      }
      if (songs.length >= MAX_SONGS) {
        problem = `The list is full at ${MAX_SONGS} songs! Take a few away first.`;
        return;
      }
      const name = await youtubeTitle(found);
      adding = '';
      await onchange([...songs, name ? { url: link, name } : { url: link }]);
    } finally {
      busy = false;
      progress = null;
    }
  }
  const MAX_SONGS = 300;
  let progress = $state<{ done: number; of: number } | null>(null);
  async function remove(index: number) {
    const left = songs.filter((_, i) => i !== index);
    if (index < current || current >= left.length) current = Math.max(0, current - 1);
    await onchange(left);
  }

  /** Songs saved before names were looked up get theirs, once each. */
  const asked = new Set<string>();
  $effect(() => {
    const unnamed = songs.filter((s) => !s.name && !asked.has(s.url));
    if (!unnamed.length) return;
    unnamed.forEach((s) => asked.add(s.url));
    void Promise.all(unnamed.map(async (s) => [s.url, await youtubeTitle(parsePlaylist(s.url) ?? { kind: 'youtube' })] as const))
      .then((named) => {
        const found = new Map(named.filter(([, n]) => n) as [string, string][]);
        if (!found.size) return;
        void onchange(songs.map((s) => (!s.name && found.has(s.url) ? { ...s, name: found.get(s.url) } : s)));
      });
  });
  /**
   * Each song's length, found once on the DM's page (a hidden player cues
   * them one by one) and kept on the list, so everyone sees it. Saved every
   * few songs, merged into the list as it is then.
   */
  const measured = new Set<string>();
  let found: Record<string, number> = {};
  let saving: ReturnType<typeof setTimeout> | undefined;
  function keepLength(url: string, seconds: number) {
    found[url] = seconds;
    clearTimeout(saving);
    saving = setTimeout(() => {
      const got = found;
      found = {};
      if (songs.some((s) => got[s.url] && s.length !== got[s.url])) void onchange(songs.map((s) => (got[s.url] ? { ...s, length: got[s.url] } : s)));
    }, 1200);
  }
  $effect(() => {
    if (!lead) return;
    const todo = songs.filter((s) => !s.length && !measured.has(s.url)).flatMap((s) => {
      const p = parsePlaylist(s.url);
      return p?.video && !p.list ? [[s.url, p.video] as const] : [];
    });
    if (!todo.length) return;
    todo.forEach(([url]) => measured.add(url));
    const byId = new Map(todo.map(([url, id]) => [id, url]));
    // Not stopped by the list changing (saving a length changes it): only by leaving.
    void songLengths(todo.map(([, id]) => id), (id, seconds) => {
      const url = byId.get(id);
      if (url) keepLength(url, seconds);
    }, () => gone);
  });
  let gone = false;
  onDestroy(() => {
    gone = true;
    clearTimeout(saving);
  });
  /** The playing song's length, if the list doesn't have it yet. */
  function learnLength(seconds: number) {
    const song = playingSong;
    if (lead && song && !song.length && !parsePlaylist(song.url)?.list) keepLength(song.url, seconds);
  }

  /** If YouTube's lookup said nothing, the playing song's title will do. */
  function learnTitle(title: string) {
    const song = playingSong;
    // A playlist's titles are its songs', not its own.
    if (!song || song.name || parsePlaylist(song.url)?.list) return;
    void onchange(songs.map((s) => (s === song ? { ...s, name: title } : s)));
  }
  const label = (song: Song, index: number) => {
    if (song.name) return song.name;
    const p = parsePlaylist(song.url);
    return p?.list ? `Playlist ${index + 1}` : `Song ${index + 1}`;
  };
  const motion = () => ({ duration: prefersReducedMotion() ? 0 : 240, easing: cubicOut });
</script>

<section class="jukebox" class:compact aria-label="Table music">
  {#if !compact}
    <!-- The title over the player, and (the DM's) the field to add a song over the list. -->
    <div class="jhead">
      <SectionHead title="Table Music">
        {#snippet info()}
          You play the table’s music here and everyone on the campaign page hears it, each at their own volume. Your players
          only see the song playing, in a small capsule. Paste a song or a playlist from YouTube to add it.
        {/snippet}
      </SectionHead>
      {#if editing}
        <div class="adder">
          <div class="add">
            <input bind:value={adding} placeholder="Paste a YouTube song or playlist link" aria-label="YouTube link to add"
                   oninput={() => (problem = null)}
                   onkeydown={(e) => { if (e.key === 'Enter') add(); }} />
            <button onclick={add} disabled={!adding.trim() || busy}>
              {busy ? (progress ? `Adding ${progress.done} of ${progress.of}` : 'Adding') : 'Add'}
            </button>
          </div>
          {#if progress}
            <div class="progress" transition:slide={motion()} aria-hidden="true">
              <i style:width="{(progress.done / Math.max(1, progress.of)) * 100}%"></i>
            </div>
          {/if}
          {#if problem}<p class="err" role="alert" transition:slide={motion()}>{problem}</p>{/if}
        </div>
      {/if}
    </div>
  {/if}
  <div class="body">
    <div class="player">
      {#if playingSong}
        <MusicPlayer url={playingSong.url} place="campaign" onended={next} ontitle={learnTitle} onlength={learnLength} capsule={compact}
                     onexpand={compact ? onexpand : undefined} oncompact={compact ? undefined : oncompact}
                     lead={lead ? told : undefined} follow={followMoment} resume={resumeMoment} {away} />
      {:else}
        <MusicPlayer url="" idle={lead ? 'No song playing' : 'Waiting for the DM to play music'} capsule={compact}
                     onexpand={compact ? onexpand : undefined} oncompact={compact ? undefined : oncompact} />
      {/if}
    </div>
    {#if !compact}
    <div class="list">
      <!-- Only the songs are in the box; it is as tall as the player beside it, and scrolls. -->
      <div class="songbox">
      {#if !songs.length}
        <p class="none" in:fade={{ duration: 160 }}>{editing ? 'Paste a song or a playlist above and it plays here, for the whole table.' : 'No songs yet.'}</p>
      {/if}
      <ol class:empty={!songs.length}>
        {#each songs as song, i (song.url)}
          <li class:on={playingSong === song} transition:foldRow>
            <button class="pick" class:still={!lead} onclick={() => choose(i)} aria-current={playingSong === song ? 'true' : undefined}
                    title={lead ? song.url : undefined} tabindex={lead ? 0 : -1}>
              <span class="n" aria-hidden="true">{playingSong === song ? '♪' : i + 1}</span>
              {#key song.name}<span class="nm" in:fade={{ duration: 200 }}>{label(song, i)}</span>{/key}
              {#if song.length}<span class="len" in:fade={{ duration: 200 }}>{clock(song.length)}</span>{/if}
            </button>
            {#if editing}
              <button class="x" aria-label="Remove {label(song, i)}" title="Remove" onclick={() => remove(i)}
                      transition:fade={{ duration: 160 }}>×</button>
            {/if}
          </li>
        {/each}
      </ol>
      </div>
    </div>
    {/if}
  </div>
</section>

<style>
  /* The title sits above, like every section's; the songs sit in frosted
     glass, the banner and the page behind it showing through, softened. */
  .jukebox .songbox {
    padding: 0.375rem; border-radius: var(--r);
    border: 1px solid color-mix(in oklch, var(--line) 70%, transparent);
    background: color-mix(in oklch, var(--surface) 55%, transparent);
    backdrop-filter: blur(18px) saturate(1.15); -webkit-backdrop-filter: blur(18px) saturate(1.15);
    box-shadow: inset 0 1px 0 color-mix(in oklch, white 6%, transparent);
  }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .jukebox .songbox { background: color-mix(in oklch, var(--surface) 92%, transparent); }
  }
  /* Beside the player, the box takes the player's height, never its songs': it
     has no size of its own, so the row is the player's, and the list scrolls.
     The field to add a song sits on the row below, under the box. */
  @media (min-width: 701px) {
    .jukebox .body { align-items: stretch; }
    .jukebox .list { display: grid; }
    .jukebox .songbox { contain: size; display: grid; grid-template-rows: minmax(0, 1fr); }
    .jukebox .songbox ol { max-height: none; }
  }
  /* The head lines up with the body's two columns: the title over the
     player, the field over the list, as wide as it. */
  .jhead { display: grid; grid-template-columns: minmax(0, 19rem) minmax(0, 1fr); gap: 0.25rem 1rem; align-items: start; margin-bottom: 0.625rem; }
  .jhead :global(.sechead) { margin-bottom: 0; }
  .jhead .adder { grid-column: 2; }
  @media (max-width: 700px) {
    .jhead { grid-template-columns: minmax(0, 1fr); }
    .jhead .adder { grid-column: 1; }
  }
  .jukebox.compact { min-width: 0; max-width: min(24rem, 100%); }
  .compact .body { display: flex; margin: 0; }
  .compact .player { display: flex; min-width: 0; max-width: 100%; }
  .body { display: grid; grid-template-columns: minmax(0, 19rem) minmax(0, 1fr); gap: 1rem; align-items: start; }
  .player { display: grid; justify-items: center; align-self: start; }
  .none { margin: 0; padding: 0.375rem 0.5rem; color: var(--dim); font-size: 0.8125rem; line-height: 1.45; }
  ol.empty { display: none; }
  /* No gap between rows: a row folding away takes its own room with it. */
  ol {
    list-style: none; margin: 0; padding: 0; max-height: 13rem; overflow-y: auto;
    /* A slim scrollbar in the campaign's color when the songs outrun the room. */
    scrollbar-width: thin; scrollbar-color: color-mix(in oklch, var(--a) 55%, transparent) transparent;
  }
  ol::-webkit-scrollbar { width: 6px; }
  ol::-webkit-scrollbar-track { background: transparent; }
  ol::-webkit-scrollbar-thumb { background: color-mix(in oklch, var(--a) 55%, transparent); border-radius: 6px; }
  li {
    display: flex; align-items: center; border-radius: var(--r-sm); margin-bottom: 0.125rem;
    transition: background-color 0.15s var(--ease-out);
  }
  li:hover { background: var(--hover-bg); }
  li.on { background: var(--a-wash); }
  .pick {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: 0.5rem; text-align: left;
    font: inherit; font-size: 0.875rem; color: var(--text); background: none; border: 0; cursor: pointer;
    padding: 0.3125rem 0.5rem;
  }
  li.on .pick { color: var(--a); }
  .n { flex: none; width: 1.125rem; text-align: center; font-size: 0.75rem; color: var(--faint); font-variant-numeric: tabular-nums; }
  li.on .n { color: var(--a); }
  .nm { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .len { flex: none; margin-left: auto; font-size: 0.75rem; color: var(--dim); font-variant-numeric: tabular-nums; }
  li.on .len { color: var(--a); }
  .x {
    flex: none; width: 1.75rem; height: 1.75rem; display: grid; place-items: center; padding: 0;
    background: none; border: 0; color: var(--faint); font-size: 1.05rem; cursor: pointer; border-radius: var(--r-sm);
    opacity: 0; transition: opacity 0.15s var(--ease-out), color 0.15s var(--ease-out);
  }
  li:hover .x, .x:focus-visible { opacity: 1; }
  .x:hover { color: var(--bad); }
  @media (hover: none) { .x { opacity: 1; } }
  .adder { min-width: 0; }
  .add { display: flex; gap: 0.5rem; }
  .add button { white-space: nowrap; flex: none; }
  .progress { height: 3px; border-radius: 2px; background: var(--line-soft); margin-top: 0.5rem; overflow: hidden; }
  .progress i { display: block; height: 100%; background: var(--a); transition: width 0.25s var(--ease-out); }
  .pick.still { cursor: default; }
  .add input {
    flex: 1; min-width: 0; font: inherit; font-size: 0.8125rem; padding: 0.4375rem 0.625rem; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  .add input:focus { outline: none; border-color: var(--a-edge); }
  .add button {
    font: inherit; font-size: 0.875rem; cursor: pointer; border-radius: var(--r-sm); padding: 0.4375rem 0.875rem;
    border: 1px solid var(--a-edge); background: var(--a-wash); color: var(--a);
  }
  .add button:hover:not(:disabled) { border-color: var(--a); }
  .add button:active:not(:disabled) { transform: translateY(1px); }
  .add button:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
  .add button:disabled { opacity: 0.5; cursor: default; }
  .err { color: var(--bad); font-size: 0.8125rem; margin: 0.375rem 0 0; }
  @media (max-width: 700px) {
    .body { grid-template-columns: minmax(0, 1fr); }
  }
</style>
