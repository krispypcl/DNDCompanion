<script lang="ts">
  /**
   * The sheet's music, top centre: the song playing, back, play/pause, next
   * and volume, over a YouTube player kept out of sight. A Spotify link shows
   * Spotify's own small player instead, which is the only way Spotify lets a
   * page play it (and it alone knows the song and can skip).
   *
   * The speaker beside the light/dark switch is its mute: off (the default),
   * the music waits, paused; on, it plays at once, or at the first tap on
   * the page where the browser will not start sound by itself.
   */
  import { onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { get } from 'svelte/store';
  import { setSound, soundOn } from '$lib/sound';
  import {
    loadSpotify, loadYouTube, parsePlaylist, storeVolume, storedVolume,
    type SpotifyController, type YTPlayer
  } from '$lib/music';

  let { url }: { url: string } = $props();

  const playlist = $derived(parsePlaylist(url));
  const key = $derived(playlist ? JSON.stringify(playlist) : '');

  let host = $state<HTMLDivElement>();
  let spHost = $state<HTMLDivElement>();
  let yt: YTPlayer | null = null;
  let sp: SpotifyController | null = null;
  let ready = $state(false);
  let playing = $state(false);
  let title = $state('');
  let failed = $state(false);
  let waiting = $state(false);
  let volume = $state(typeof localStorage === 'undefined' ? 50 : storedVolume());
  /** Paused by its own button: sound coming on again does not override it. */
  let userPaused = false;
  let checkTimer: ReturnType<typeof setTimeout> | undefined;

  function updateTitle() {
    const t = yt?.getVideoData?.().title;
    if (t) title = t;
  }

  /** Browsers start sound only after a press on the page; until then, wait for one. */
  function armGesture() {
    if (waiting) return;
    waiting = true;
    const go = () => {
      document.removeEventListener('pointerdown', go, true);
      document.removeEventListener('keydown', go, true);
      waiting = false;
      if (get(soundOn) && !userPaused) start();
    };
    document.addEventListener('pointerdown', go, true);
    document.addEventListener('keydown', go, true);
  }

  function start() {
    if (!ready) return;
    if (yt) {
      yt.unMute();
      yt.setVolume(volume);
      yt.playVideo();
      clearTimeout(checkTimer);
      checkTimer = setTimeout(() => {
        if (yt && yt.getPlayerState() !== 1 && yt.getPlayerState() !== 3 && get(soundOn) && !userPaused) armGesture();
      }, 1500);
    } else if (sp) {
      sp.resume();
    }
  }
  function stop() {
    if (yt) {
      yt.pauseVideo();
      yt.mute();
    } else sp?.pause();
  }

  function teardown() {
    clearTimeout(checkTimer);
    try { yt?.destroy(); } catch { /* already gone */ }
    try { sp?.destroy(); } catch { /* already gone */ }
    yt = null;
    sp = null;
    ready = false;
    playing = false;
    title = '';
    failed = false;
    if (host) host.innerHTML = '';
    if (spHost) spHost.innerHTML = '';
  }

  // A new link, a new player.
  $effect(() => {
    key;
    const p = playlist;
    if (!p || !host || !spHost) return;
    let gone = false;
    teardown();
    const target = document.createElement('div');
    if (p.kind === 'youtube') {
      host.appendChild(target);
      loadYouTube()
        .then((YT) => {
          if (gone) return;
          yt = new YT.Player(target, {
            width: 200,
            height: 200,
            ...(p.video ? { videoId: p.video } : {}),
            playerVars: {
              ...(p.list ? { listType: 'playlist', list: p.list } : { playlist: p.video, loop: 1 }),
              controls: 0, disablekb: 1, playsinline: 1, rel: 0, fs: 0, iv_load_policy: 3
            },
            events: {
              onReady: () => {
                if (gone || !yt) return;
                ready = true;
                yt.setVolume(volume);
                if (get(soundOn)) start();
                else yt.mute();
                updateTitle();
              },
              onStateChange: (e: { data: number }) => {
                playing = e.data === 1;
                if (e.data === 1) waiting = false;
                updateTitle();
              },
              onError: () => {
                // A video that will not play here: skip it, in a playlist.
                if (p.list) setTimeout(() => yt?.nextVideo(), 400);
                else failed = true;
              }
            }
          });
        })
        .catch(() => (failed = true));
    } else {
      spHost.appendChild(target);
      loadSpotify()
        .then((api) => {
          if (gone) return;
          api.createController(target, { uri: `spotify:${p.type}:${p.id}`, width: '100%', height: 80 }, (c) => {
            if (gone) { c.destroy(); return; }
            sp = c;
            c.addListener('ready', () => {
              ready = true;
              if (get(soundOn)) start();
            });
            c.addListener('playback_update', (e) => (playing = !e.data.isPaused));
          });
        })
        .catch(() => (failed = true));
    }
    return () => {
      gone = true;
      teardown();
    };
  });

  // The speaker is the mute: on plays, off pauses.
  let first = true;
  const unsub = soundOn.subscribe((on) => {
    if (first) { first = false; return; }
    if (!ready) return;
    if (on) {
      userPaused = false;
      start();
    } else stop();
  });
  onDestroy(() => {
    unsub();
    clearTimeout(checkTimer);
  });

  function toggle() {
    if (playing) {
      userPaused = true;
      if (yt) yt.pauseVideo();
      else sp?.pause();
      return;
    }
    userPaused = false;
    // Playing with the sound off would be silence: pressing play turns it on.
    if (!get(soundOn)) setSound(true);
    else start();
  }

  function setVol(v: number) {
    volume = v;
    yt?.setVolume(v);
    storeVolume(v);
  }

  const status = $derived(
    failed
      ? 'That playlist won’t play! It may be private, or the link is off.'
      : !ready
        ? 'Tuning the lute…'
        : waiting
          ? 'Tap anywhere to start the music'
          : title || (playing ? 'Playing' : 'Paused')
  );
</script>

{#if playlist}
  <div class="music" class:spotify={playlist.kind === 'spotify'} class:playing role="group" aria-label="Music"
       transition:fade={{ duration: 200 }}>
    <!-- Out of sight: YouTube plays here and the controls below drive it. -->
    <div class="ythost" bind:this={host} aria-hidden="true"></div>
    {#if playlist.kind === 'youtube'}
      <div class="row">
        <button class="ctl" aria-label="Previous song" title="Previous" disabled={!ready || failed || !playlist.list}
                onclick={() => yt?.previousVideo()}>
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3.5 3v10M13 3.2v9.6L5.6 8z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
        </button>
        <button class="ctl play" aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}
                disabled={!ready || failed} onclick={toggle}>
          {#if playing}
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M4.5 3h2.2v10H4.5zM9.3 3h2.2v10H9.3z" fill="currentColor" /></svg>
          {:else}
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor" /></svg>
          {/if}
        </button>
        <button class="ctl" aria-label="Next song" title="Next" disabled={!ready || failed || !playlist.list}
                onclick={() => yt?.nextVideo()}>
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M12.5 3v10M3 3.2v9.6L10.4 8z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
        </button>
        <div class="title" title={title || undefined} aria-live="polite">
          <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
          {#key status}<span class="text" in:fade={{ duration: 220 }}>{status}</span>{/key}
        </div>
        <label class="vol" title="Volume {volume}%">
          <span class="sr">Volume</span>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M2.5 6.2h2.3l3-2.6v8.8l-3-2.6H2.5z" fill="currentColor" /><path d="M10.4 6a2.8 2.8 0 0 1 0 4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
          <input type="range" min="0" max="100" step="1" value={volume}
                 style:--v="{volume}%" oninput={(e) => setVol(Number(e.currentTarget.value))} />
        </label>
      </div>
    {/if}
    <div class="sphost" bind:this={spHost}></div>
    {#if playlist.kind === 'spotify' && failed}<p class="err">{status}</p>{/if}
  </div>
{/if}

<style>
  .music {
    position: relative; min-width: 0; width: min(25rem, 100%);
    border: 1px solid var(--line); border-radius: 999px; background: color-mix(in oklch, var(--surface) 88%, transparent);
    padding: 0.25rem 0.75rem 0.25rem 0.3125rem;
  }
  .music.spotify { border: 0; background: none; padding: 0; border-radius: 12px; overflow: hidden; }
  .ythost { position: fixed; left: -10000px; top: 0; width: 200px; height: 200px; opacity: 0; pointer-events: none; }
  .row { display: flex; align-items: center; gap: 0.25rem; min-width: 0; }
  .ctl {
    flex: none; width: 1.875rem; height: 1.875rem; border-radius: 50%; display: grid; place-items: center;
    padding: 0; border: 1px solid transparent; background: none; color: var(--text); cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease, transform 0.08s ease;
  }
  .ctl:hover:not(:disabled) { background: var(--a-wash); color: var(--a); }
  .ctl:active:not(:disabled) { transform: scale(0.92); }
  .ctl:disabled { opacity: 0.4; cursor: default; }
  .ctl.play { background: var(--a-wash); color: var(--a); border-color: var(--a-edge); }
  .title {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: 0.4375rem; margin-left: 0.375rem;
    font-size: 0.8125rem; color: var(--dim);
  }
  .playing .title { color: var(--text); }
  .text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* Three small bars that dance while it plays and rest while it doesn't. */
  .eq { flex: none; display: inline-flex; align-items: flex-end; gap: 2px; height: 0.75rem; }
  .eq i { width: 2px; height: 30%; background: var(--a); border-radius: 1px; transform-origin: bottom; }
  .playing .eq i { animation: eq 0.9s ease-in-out infinite; height: 100%; }
  .playing .eq i:nth-child(2) { animation-delay: -0.3s; }
  .playing .eq i:nth-child(3) { animation-delay: -0.6s; }
  @keyframes eq { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
  /* The volume folds to its speaker and opens on hover or focus, so the song
     keeps the room. */
  .music { container-type: inline-size; }
  .vol { flex: none; display: flex; align-items: center; gap: 0.3125rem; color: var(--dim); margin-left: 0.25rem; cursor: pointer; }
  .vol:hover, .vol:focus-within { color: var(--a); }
  .vol input {
    -webkit-appearance: none; appearance: none; width: 0; opacity: 0; height: 4px; border-radius: 2px; margin: 0;
    transition: width 0.22s cubic-bezier(0.2, 0.8, 0.3, 1), opacity 0.18s ease;
    background: linear-gradient(to right, var(--a) var(--v), var(--line) var(--v)); cursor: pointer;
  }
  .vol input::-webkit-slider-thumb {
    -webkit-appearance: none; width: 0.75rem; height: 0.75rem; border-radius: 50%; background: var(--a); border: 0;
  }
  .vol input::-moz-range-thumb { width: 0.75rem; height: 0.75rem; border-radius: 50%; background: var(--a); border: 0; }
  .sphost :global(iframe) { display: block; border-radius: 12px; }
  .err { margin: 0.25rem 0 0; font-size: 0.75rem; color: var(--bad); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .vol:hover input, .vol:focus-within input { width: 4.5rem; opacity: 1; }
  /* No hover on a touch screen: the slider stays open when there is room. */
  @media (hover: none) { .vol input { width: 4rem; opacity: 1; } }
  /* Too narrow for the song's name: just the controls. */
  @container (max-width: 15rem) { .title .text { display: none; } }
  @media (prefers-reduced-motion: reduce) { .playing .eq i { animation: none; } }
</style>
