<script lang="ts">
  /**
   * The DM's jukebox: a list of YouTube links (songs or whole playlists) and
   * the sheet's own music player for whichever is chosen. Choosing one plays
   * it; when one ends, the next on the list follows (unless the player's
   * loop is on). Adding and removing songs is for edit mode. The list is
   * kept with the campaign; which one is playing is kept on this device.
   */
  import { fade, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { parsePlaylist, youtubeTitle } from '$lib/music';
  import { foldRow, prefersReducedMotion } from '$lib/motion';
  import { setSound } from '$lib/sound';
  import type { Song } from '$lib/data/campaigns';
  import MusicPlayer from './MusicPlayer.svelte';

  let {
    campaignId,
    songs,
    editing,
    onchange
  }: {
    campaignId: string;
    songs: Song[];
    editing: boolean;
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
  const playingSong = $derived(songs.length ? songs[Math.min(current, songs.length - 1)] : null);

  function choose(index: number) {
    current = index;
    try { localStorage.setItem(memoryKey, String(index)); } catch { /* private window */ }
    // Choosing a song is asking to hear it.
    setSound(true);
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
    const name = await youtubeTitle(found);
    busy = false;
    adding = '';
    await onchange([...songs, name ? { url: link, name } : { url: link }]);
  }
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

<section class="jukebox" aria-label="Table music">
  <span class="cap">Table music</span>
  <div class="body">
    <div class="player">
      {#if playingSong}
        <MusicPlayer url={playingSong.url} place="campaign" onended={next} ontitle={learnTitle} />
      {:else}
        <p class="none" in:fade={{ duration: 160 }}>Add a song or a playlist and it plays here, for you alone.</p>
      {/if}
    </div>
    <div class="list">
      <ol>
        {#each songs as song, i (song.url)}
          <li class:on={playingSong === song} transition:foldRow>
            <button class="pick" onclick={() => choose(i)} aria-current={playingSong === song ? 'true' : undefined}
                    title={song.url}>
              <span class="n" aria-hidden="true">{playingSong === song ? '♪' : i + 1}</span>
              {#key song.name}<span class="nm" in:fade={{ duration: 200 }}>{label(song, i)}</span>{/key}
            </button>
            {#if editing}
              <button class="x" aria-label="Remove {label(song, i)}" title="Remove" onclick={() => remove(i)}
                      transition:fade={{ duration: 160 }}>×</button>
            {/if}
          </li>
        {/each}
      </ol>
      {#if editing}
        <div class="adder" transition:slide={motion()}>
          <div class="add">
            <input bind:value={adding} placeholder="Paste a YouTube link" aria-label="YouTube link to add"
                   oninput={() => (problem = null)}
                   onkeydown={(e) => { if (e.key === 'Enter') add(); }} />
            <button onclick={add} disabled={!adding.trim() || busy}>{busy ? 'Adding…' : 'Add'}</button>
          </div>
          {#if problem}<p class="err" role="alert" transition:slide={motion()}>{problem}</p>{/if}
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .jukebox {
    margin-top: 1rem; padding: 0.875rem 1rem; border: 1px solid var(--line-soft); border-radius: var(--r);
    background: color-mix(in oklch, var(--surface) 82%, transparent);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  }
  .cap { font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--label); font-weight: 600; }
  .body { display: grid; grid-template-columns: minmax(0, 19rem) minmax(0, 1fr); gap: 1rem; margin-top: 0.625rem; align-items: start; }
  .player { display: grid; justify-items: center; }
  .none { margin: 0; color: var(--dim); font-size: 0.8125rem; line-height: 1.45; align-self: center; }
  /* No gap between rows: a row folding away takes its own room with it. */
  ol { list-style: none; margin: 0; padding: 0; max-height: 13rem; overflow-y: auto; }
  li {
    display: flex; align-items: center; border-radius: var(--r-sm); margin-bottom: 0.125rem;
    transition: background-color 0.15s ease;
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
  .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .x {
    flex: none; width: 1.75rem; height: 1.75rem; display: grid; place-items: center; padding: 0;
    background: none; border: 0; color: var(--faint); font-size: 1.05rem; cursor: pointer; border-radius: var(--r-sm);
    opacity: 0; transition: opacity 0.15s ease, color 0.15s ease;
  }
  li:hover .x, .x:focus-visible { opacity: 1; }
  .x:hover { color: var(--bad); }
  @media (hover: none) { .x { opacity: 1; } }
  .adder { padding-top: 0.375rem; }
  .add { display: flex; gap: 0.5rem; }
  .add input {
    flex: 1; min-width: 0; font: inherit; font-size: 0.8125rem; padding: 0.4375rem 0.625rem; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  .add input:focus { outline: none; border-color: var(--a-edge); }
  .add button {
    font: inherit; font-size: 0.875rem; cursor: pointer; border-radius: var(--r-sm); padding: 0.4375rem 0.875rem;
    border: 1px solid var(--a-edge); background: var(--a-wash); color: var(--a);
  }
  .add button:disabled { opacity: 0.5; cursor: default; }
  .err { color: var(--bad); font-size: 0.8125rem; margin: 0.375rem 0 0; }
  @media (max-width: 700px) {
    .body { grid-template-columns: minmax(0, 1fr); }
  }
</style>
