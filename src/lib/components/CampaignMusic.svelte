<script lang="ts">
  /**
   * The DM's jukebox: a list of YouTube links (songs or whole playlists) and
   * the sheet's own music player for whichever is chosen. Choosing one plays
   * it; when one ends, the next on the list follows (unless the player's
   * loop is on). The list is
   * kept with the campaign; which one is playing is kept on this device.
   */
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import { parsePlaylist } from '$lib/music';
  import { setSound } from '$lib/sound';
  import type { Song } from '$lib/data/campaigns';
  import MusicPlayer from './MusicPlayer.svelte';

  let {
    campaignId,
    songs,
    onchange
  }: { campaignId: string; songs: Song[]; onchange: (songs: Song[]) => Promise<void> | void } = $props();

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
  let problem = $state<string | null>(null);
  async function add() {
    const link = adding.trim();
    if (!link) return;
    if (!parsePlaylist(link)) {
      problem = 'That’s not a tune the bard knows! Paste a YouTube or YouTube Music link.';
      return;
    }
    problem = null;
    adding = '';
    await onchange([...songs, { url: link }]);
  }
  async function remove(index: number) {
    const left = songs.filter((_, i) => i !== index);
    if (index < current || current >= left.length) current = Math.max(0, current - 1);
    await onchange(left);
  }
  /** A song added without a name takes the one YouTube gives it. */
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
</script>

<section class="jukebox" aria-label="Table music">
  <span class="cap">Table music</span>
  <div class="body">
    <div class="player">
      {#if playingSong}
        <MusicPlayer url={playingSong.url} place="campaign" onended={next} ontitle={learnTitle} />
      {:else}
        <p class="none">Add a song or a playlist and it plays here, for you alone.</p>
      {/if}
    </div>
    <div class="list">
      {#if songs.length}
        <ol>
          {#each songs as song, i (song.url + i)}
            <li class:on={playingSong === song} animate:flip={{ duration: 220, easing: cubicOut }} in:fade={{ duration: 160 }}>
              <button class="pick" onclick={() => choose(i)} aria-current={playingSong === song ? 'true' : undefined}
                      title={song.url}>
                <span class="n" aria-hidden="true">{playingSong === song ? '♪' : i + 1}</span>
                <span class="nm">{label(song, i)}</span>
              </button>
              <button class="x" aria-label="Remove {label(song, i)}" title="Remove" onclick={() => remove(i)}>×</button>
            </li>
          {/each}
        </ol>
      {/if}
      <div class="add">
        <input bind:value={adding} placeholder="Paste a YouTube link" aria-label="YouTube link to add"
               onkeydown={(e) => { if (e.key === 'Enter') add(); }} />
        <button onclick={add} disabled={!adding.trim()}>Add</button>
      </div>
      {#if problem}<p class="err" role="alert">{problem}</p>{/if}
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
  ol { list-style: none; margin: 0 0 0.5rem; padding: 0; display: grid; gap: 0.25rem; max-height: 13rem; overflow-y: auto; }
  li {
    display: flex; align-items: center; border-radius: var(--r-sm);
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
