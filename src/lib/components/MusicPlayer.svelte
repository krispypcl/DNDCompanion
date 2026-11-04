<script lang="ts">
  /**
   * The sheet's music, top centre: the song playing, then back, play/pause and
   * next, over a YouTube player kept out of sight. It plays
   * a YouTube (or YouTube Music) playlist, or a single video's sound, once or on loop.
   *
   * The speaker beside the light/dark switch is its mute: off (the default),
   * the music waits, paused; on, it plays at once, or at the first tap on
   * the page where the browser will not start sound by itself.
   *
   * The player is rebuilt only when the link itself changes. The parent hands
   * in a new sheet on every edit, so everything here hangs off the link as a
   * string, which stays equal however often it is handed in again.
   */
  import { onDestroy, untrack } from 'svelte';
  import { fade } from 'svelte/transition';
  import { get } from 'svelte/store';
  import { setSound, soundOn } from '$lib/sound';
  import {
    clock, loadYouTube, parsePlaylist, storeLoop, storeShuffle, storedLoop, storeVolume, storedShuffle, storedVolume,
    type Playlist, type YTPlayer
  } from '$lib/music';
  import { session } from '$lib/stores/session';
  import { loopOf, saveLoop, saveShuffle, shuffleOf, type MusicPlace } from '$lib/data/session';

  let {
    url,
    place = 'sheet',
    onended,
    ontitle
  }: {
    url: string;
    /** A sheet's player or a campaign's jukebox: each remembers its own loop. */
    place?: MusicPlace;
    /** Told when the music runs out (loop off): the jukebox moves on. */
    onended?: () => void;
    /** Told each song's title as YouTube gives it. */
    ontitle?: (title: string) => void;
  } = $props();

  /**
   * Shuffle: the player's own choice, kept with their account (or on this
   * device when not signed in). On, the playlist is put in a fresh random
   * order each time the sheet opens, the first song included.
   */
  let shuffle = $state(false);
  /** What the player wants, read when it is needed rather than when the page
      happened to render: the account's choice, or this device's. */
  const wantShuffle = () => shuffleOf(get(session).user) ?? (typeof localStorage === 'undefined' ? false : storedShuffle());
  $effect(() => {
    const fromAccount = shuffleOf($session.user);
    shuffle = fromAccount ?? (typeof localStorage === 'undefined' ? false : storedShuffle());
    // The device follows the account, so the next visit knows before sign-in finishes.
    if (fromAccount !== null) storeShuffle(fromAccount);
  });
  /**
   * Loop, beside it and kept the same way: on, a playlist starts over at its
   * end and a single song plays again; off, the music stops (or, in a
   * jukebox, the next song on the list follows).
   */
  let looping = $state(false);
  $effect(() => {
    const fromAccount = loopOf($session.user, place);
    looping = fromAccount ?? (typeof localStorage === 'undefined' ? place === 'campaign' : storedLoop(place));
    if (fromAccount !== null) storeLoop(place, fromAccount);
  });
  function toggleLoop() {
    looping = !looping;
    storeLoop(place, looping);
    if ($session.user) void saveLoop(place, looping).catch(() => {});
    applyLoop();
  }
  /** YouTube's own loop, for a playlist; a single song is started again by hand. */
  function applyLoop() {
    if (!yt || !playlist?.list) return;
    try { yt.setLoop(untrack(() => looping)); } catch { /* not ready */ }
  }

  /**
   * The new order is made once per visit, as soon as YouTube says how many
   * songs the playlist has (on loading, or at the latest when it starts):
   * the list is asked for again starting at a random song, and YouTube's own
   * shuffle picks the rest. Pressing play while one is pending starts that
   * random song instead of the list's own first.
   */
  let pendingShuffle = false;
  /** Whether a song has started this visit. */
  let hasPlayed = false;
  let hushed = false;
  function applyShuffle(play: boolean): boolean {
    if (!pendingShuffle || !yt || !playlist?.list) return false;
    const count = yt.getPlaylist?.()?.length ?? 0;
    if (!count) return false;
    pendingShuffle = false;
    stopWatch();
    if (count < 2) {
      unhush();
      return false;
    }
    const request = { list: playlist.list, listType: 'playlist' as const, index: Math.floor(Math.random() * count) };
    if (play) yt.loadPlaylist(request);
    else yt.cuePlaylist(request);
    reshuffle = true;
    unhush();
    return play;
  }
  /** YouTube's shuffle, set once the new list has arrived (asking sooner is forgotten). */
  let reshuffle = false;
  function settleShuffle() {
    if (!reshuffle || !yt) return;
    reshuffle = false;
    try { yt.setShuffle(true); } catch { /* not ready */ }
  }
  /** Sound back on for a song started silently while the shuffle waited. */
  function unhush() {
    if (!hushed) return;
    hushed = false;
    if (get(soundOn)) yt?.unMute();
  }
  /**
   * YouTube fills in a playlist's songs when it gets round to it: often not
   * by the time the player is ready, sometimes not until a song has started.
   * So while a shuffle is waiting, it asks every few tenths of a second, and
   * gives up after a while (unmuting anything it had hushed) rather than for ever.
   */
  let watch: ReturnType<typeof setInterval> | undefined;
  let watchUntil = 0;
  function startWatch() {
    stopWatch();
    watchUntil = Date.now() + 20000;
    watch = setInterval(() => {
      if (!pendingShuffle || !yt) return stopWatch();
      const state = yt.getPlayerState();
      if (applyShuffle(state === 1 || state === 3)) return;
      if (Date.now() > watchUntil) {
        pendingShuffle = false;
        stopWatch();
        unhush();
      }
    }, 300);
  }
  function stopWatch() {
    clearInterval(watch);
    watch = undefined;
  }
  function toggleShuffle() {
    shuffle = !shuffle;
    storeShuffle(shuffle);
    if ($session.user) void saveShuffle(shuffle).catch(() => {});
    // Before anything has played, the whole list (first song too) is
    // reshuffled; mid-song, the rest of it is shuffled (or not) from here on.
    if (shuffle && !hasPlayed && playlist?.list) {
      pendingShuffle = true;
      if (!applyShuffle(false) && pendingShuffle) startWatch();
    } else {
      pendingShuffle = false;
      try { yt?.setShuffle(shuffle); } catch { /* not ready */ }
    }
  }

  const key = $derived.by(() => {
    const p = parsePlaylist(url);
    return p ? JSON.stringify(p) : '';
  });
  const playlist = $derived<Playlist | null>(key ? JSON.parse(key) : null);

  let host = $state<HTMLDivElement>();
  let yt: YTPlayer | null = null;
  let ready = $state(false);
  let volume = $state(typeof localStorage === 'undefined' ? 70 : storedVolume());
  /** The volume slider, folded into its speaker until wanted. */
  let volOpen = $state(false);
  /** Leaving the speaker gives the pointer a moment to reach the slider. */
  let volTimer: ReturnType<typeof setTimeout> | undefined;
  function setVol(v: number) {
    volume = v;
    applyVolume();
    storeVolume(v);
  }

  /*
   * Fading. Songs come in softly and go out softly: each new song rises from
   * silence, the last seconds of one sink into the next, and pausing,
   * skipping or the speaker going off dip the sound first. What the player
   * hears is the volume times the fade times the song's tail.
   */
  const FADE_IN = 1.4;
  const FADE_OUT = 0.45;
  /** Seconds at a song's end that fade it out. */
  const TAIL = 2.5;
  let gain = 0;
  let fadeTarget = 0;
  let fadeRate = 1;
  let afterFade: (() => void) | null = null;
  let fader: ReturnType<typeof setInterval> | undefined;
  let lastStep = 0;
  let sent = -1;
  function applyVolume() {
    if (!yt) return;
    let tail = 1;
    if (playing && length > TAIL * 4) {
      const left = length - (yt.getCurrentTime?.() ?? 0);
      tail = Math.max(0, Math.min(1, left / TAIL));
    }
    const v = Math.round(volume * gain * tail);
    if (v === sent) return;
    sent = v;
    yt.setVolume(v);
  }
  function fadeStep() {
    const now = performance.now();
    const dt = Math.min(0.2, (now - lastStep) / 1000);
    lastStep = now;
    if (gain !== fadeTarget) {
      gain = gain < fadeTarget ? Math.min(fadeTarget, gain + dt * fadeRate) : Math.max(fadeTarget, gain - dt * fadeRate);
    }
    if (gain === fadeTarget && afterFade) {
      const then = afterFade;
      afterFade = null;
      then();
    }
    applyVolume();
  }
  /** Fade to a level over some seconds, then (if given) do something. */
  function fadeTo(target: number, seconds: number, then: (() => void) | null = null) {
    fadeTarget = target;
    fadeRate = 1 / seconds;
    afterFade = then;
    lastStep = performance.now();
  }
  /** Silent at once: a new song starts from nothing. */
  function hushNow() {
    gain = 0;
    fadeTarget = 0;
    applyVolume();
  }
  /** Out softly, then the action: a pause, a skip. */
  const fadeThen = (then: () => void) => fadeTo(0, FADE_OUT, then);
  let playing = $state(false);
  let title = $state('');
  let failed = $state(false);
  let waiting = $state(false);
  /** Paused by its own button: sound coming on again does not override it. */
  let userPaused = false;
  let checkTimer: ReturnType<typeof setTimeout> | undefined;
  /** Where the song is and how long it is, read from the player a few times a second. */
  let at = $state(0);
  let length = $state(0);
  /** While the timeline is held, it shows where the thumb is, not the song. */
  let scrubbing = $state(false);
  let ticker: ReturnType<typeof setInterval> | undefined;
  function readTime() {
    if (!yt || scrubbing) return;
    at = yt.getCurrentTime?.() ?? 0;
    length = yt.getDuration?.() ?? 0;
  }
  $effect(() => {
    if (!playing) return;
    untrack(readTime);
    ticker = setInterval(readTime, 250);
    return () => clearInterval(ticker);
  });
  function scrubTo(v: number) {
    at = v;
  }
  function seek(v: number) {
    scrubbing = false;
    at = v;
    yt?.seekTo(v, true);
  }
  let disarm: (() => void) | null = null;

  function updateTitle() {
    const t = yt?.getVideoData?.().title;
    if (!t || t === title) return;
    title = t;
    ontitle?.(t);
  }

  /** Browsers start sound only after a press on the page; until then, wait for one. */
  function armGesture() {
    if (disarm) return;
    waiting = true;
    const go = () => {
      disarm?.();
      if (get(soundOn) && !userPaused) start();
    };
    document.addEventListener('pointerdown', go, true);
    document.addEventListener('keydown', go, true);
    disarm = () => {
      document.removeEventListener('pointerdown', go, true);
      document.removeEventListener('keydown', go, true);
      disarm = null;
      waiting = false;
    };
  }

  function start() {
    if (!ready || !yt) return;
    yt.unMute();
    // Anything a fade-out was about to do is called off; the sound rises
    // once the song is actually playing.
    if (playing) fadeTo(1, FADE_IN);
    else fadeTo(0, FADE_OUT);
    // A shuffle still waiting is played from its first song; otherwise go on.
    // If YouTube has not said what the songs are yet, the list's own first
    // song starts silently and gives way to the shuffled one once it has.
    if (!applyShuffle(true)) {
      if (pendingShuffle) {
        hushed = true;
        yt.mute();
        if (!watch) startWatch();
      }
      yt.playVideo();
    }
    clearTimeout(checkTimer);
    checkTimer = setTimeout(() => {
      const state = yt?.getPlayerState();
      if (yt && state !== 1 && state !== 3 && get(soundOn) && !userPaused) armGesture();
    }, 1500);
  }
  function stop() {
    fadeThen(() => {
      yt?.pauseVideo();
      yt?.mute();
    });
  }

  function teardown() {
    clearTimeout(checkTimer);
    clearInterval(fader);
    stopWatch();
    pendingShuffle = false;
    reshuffle = false;
    hushed = false;
    afterFade = null;
    gain = 0;
    fadeTarget = 0;
    sent = -1;
    disarm?.();
    try { yt?.destroy(); } catch { /* already gone */ }
    yt = null;
    ready = false;
    playing = false;
    title = '';
    failed = false;
    hasPlayed = false;
    at = 0;
    length = 0;
    if (host) host.innerHTML = '';
  }

  // A new link, a new player; nothing else rebuilds it.
  $effect(() => {
    const p = playlist;
    if (!p || !host) return;
    let gone = false;
    teardown();
    const target = document.createElement('div');
    host.appendChild(target);
    loadYouTube()
      .then((YT) => {
        if (gone) return;
        yt = new YT.Player(target, {
          width: 200,
          height: 200,
          ...(p.video ? { videoId: p.video } : {}),
          playerVars: {
            ...(p.list ? { listType: 'playlist', list: p.list } : {}),
            controls: 0, disablekb: 1, playsinline: 1, rel: 0, fs: 0, iv_load_policy: 3
          },
          events: {
            onReady: () => {
              if (gone || !yt) return;
              ready = true;
              pendingShuffle = wantShuffle() && Boolean(p.list);
              if (pendingShuffle && !applyShuffle(false) && pendingShuffle) {
                // Ask for the list itself (not the one song the link opened
                // on), so its songs are fetched, then wait for them.
                try { yt.cuePlaylist({ list: p.list!, listType: 'playlist' }); } catch { /* not ready */ }
                startWatch();
              }
              hushNow();
              lastStep = performance.now();
              fader = setInterval(fadeStep, 50);
              if (get(soundOn)) start();
              else yt.mute();
              updateTitle();
            },
            onStateChange: (e: { data: number }) => {
              // 1 playing, 3 buffering: the list's own first song has begun, so
              // the shuffled one replaces it straight away.
              if (applyShuffle(e.data === 1 || e.data === 3)) return;
              if (e.data === 5 || e.data === 1) settleShuffle();
              playing = e.data === 1;
              // -1 a new song loading, 0 one ended: the next starts from silence.
              if (e.data === -1 || e.data === 0) hushNow();
              if (e.data === 1) {
                applyLoop();
                hasPlayed = true;
                disarm?.();
                if (!afterFade) fadeTo(1, FADE_IN);
              }
              // The end of the music: again from the top, or over to the jukebox.
              if (e.data === 0) {
                if (!untrack(() => looping)) onended?.();
                else if (p.list) yt?.playVideoAt(0);
                else {
                  yt?.seekTo(0, true);
                  yt?.playVideo();
                }
              }
              updateTitle();
              readTime();
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
    clearInterval(fader);
    clearInterval(ticker);
    clearTimeout(volTimer);
    disarm?.();
  });

  function toggle() {
    if (playing) {
      userPaused = true;
      fadeThen(() => yt?.pauseVideo());
      return;
    }
    userPaused = false;
    // Playing with the sound off would be silence: pressing play turns it on.
    if (!get(soundOn)) setSound(true);
    else start();
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
  <div class="music" class:playing role="group" aria-label="Music" transition:fade={{ duration: 200 }}>
    <!-- Out of sight: YouTube plays here and the controls below drive it. -->
    <div class="ythost" bind:this={host} aria-hidden="true"></div>
    <div class="title" title={title || undefined} aria-live="polite">
      <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
      {#key status}<span class="text" class:bad={failed} in:fade={{ duration: 220 }}>{status}</span>{/key}
    </div>
    <!-- The song's timeline: dragged or tapped with a mouse or a finger. -->
    <div class="time">
      <span class="t">{clock(at)}</span>
      <input type="range" min="0" max={Math.max(1, length)} step="0.5" value={Math.min(at, length || 1)}
             aria-label="Song position" aria-valuetext="{clock(at)} of {clock(length)}"
             disabled={!ready || failed || !length}
             style:--p="{length ? (Math.min(at, length) / length) * 100 : 0}%"
             onpointerdown={() => (scrubbing = true)}
             onpointerup={() => (scrubbing = false)}
             onpointercancel={() => (scrubbing = false)}
             oninput={(e) => { scrubbing = true; scrubTo(Number(e.currentTarget.value)); }}
             onchange={(e) => seek(Number(e.currentTarget.value))} />
      <span class="t">−{clock(Math.max(0, length - at))}</span>
    </div>
    <div class="row">
      <button class="ctl" aria-label="Previous song" title="Previous" disabled={!ready || failed || !playlist.list}
              onclick={() => fadeThen(() => yt?.previousVideo())}>
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3.5 3v10M13 3.2v9.6L5.6 8z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
      </button>
      <button class="ctl play" aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}
              disabled={!ready || failed} onclick={toggle}>
        {#if playing}
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4.5 3h2.2v10H4.5zM9.3 3h2.2v10H9.3z" fill="currentColor" /></svg>
        {:else}
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor" /></svg>
        {/if}
      </button>
      <button class="ctl" aria-label="Next song" title="Next" disabled={!ready || failed || !playlist.list}
              onclick={() => fadeThen(() => yt?.nextVideo())}>
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M12.5 3v10M3 3.2v9.6L10.4 8z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
      </button>
    </div>
    <!-- Shuffle and loop, in the other bottom corner. -->
    <button class="shuf" class:on={shuffle} aria-pressed={shuffle} disabled={!playlist.list}
            aria-label={shuffle ? 'Shuffle on' : 'Shuffle off'}
            title={!playlist.list ? 'One song: nothing to shuffle' : shuffle ? 'Shuffle on: a new order every visit' : 'Shuffle off'}
            onclick={toggleShuffle}>
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
        <path d="M2 4.5h2.4c1.3 0 2.2.6 2.9 1.7l1.4 3.6c.7 1.1 1.6 1.7 2.9 1.7H14M2 11.5h2.4c1.3 0 2.2-.6 2.9-1.7M9.3 5.6c.6-.7 1.4-1.1 2.3-1.1H14M12 2.6l2 1.9-2 1.9M12 9.6l2 1.9-2 1.9"
              fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <button class="loop" class:on={looping} aria-pressed={looping}
            aria-label={looping ? 'Loop on' : 'Loop off'}
            title={looping
              ? (playlist.list ? 'Loop on: the playlist starts over at its end' : 'Loop on: the song plays again')
              : place === 'campaign' ? 'Loop off: the next song on the list follows' : 'Loop off: the music stops at the end'}
            onclick={toggleLoop}>
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
        <path d="M3 7.2V6.4c0-1.1.9-2 2-2h7.2M10.6 2.6l1.9 1.8-1.9 1.8M13 8.8v.8c0 1.1-.9 2-2 2H3.8M5.4 13.4l-1.9-1.8 1.9-1.8"
              fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <!-- Volume: a speaker in the bottom corner. Hovered, focused or tapped, a
         slider slides out beside it over the module's edge, so the module's
         layout and size never change. -->
    <div class="vol" class:open={volOpen} role="group" aria-label="Volume"
         onmouseenter={() => clearTimeout(volTimer)}
         onmouseleave={() => { clearTimeout(volTimer); volTimer = setTimeout(() => (volOpen = false), 450); }}>
      <!-- Rises above the speaker when wanted, over the module rather than in it. -->
      <div class="pop">
        <input type="range" min="0" max="100" step="1" value={volume} aria-label="Volume"
               style:--v="{volume}%" tabindex={volOpen ? 0 : -1}
               oninput={(e) => setVol(Number(e.currentTarget.value))} />
      </div>
      <button class="volbtn" aria-label="Volume {volume}%" aria-expanded={volOpen} title="Volume {volume}%"
              onclick={() => (volOpen = !volOpen)} onmouseenter={() => (volOpen = true)}>
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <path d="M2.5 6.2h2.3l3-2.6v8.8l-3-2.6H2.5z" fill="currentColor" />
          {#if volume > 0}<path d="M10.4 6a2.8 2.8 0 0 1 0 4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />{/if}
          {#if volume > 50}<path d="M12.3 4.2a5.4 5.4 0 0 1 0 7.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />{/if}
          {#if volume === 0}<path d="M10.5 6.2l3.4 3.6M13.9 6.2l-3.4 3.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />{/if}
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  /* Frosted like the modules, and a little more see-through than they are. */
  .music {
    position: relative; min-width: 0; width: min(19rem, 100%);
    display: grid; justify-items: center; gap: 0.25rem;
    border: 1px solid color-mix(in oklch, var(--line) 70%, transparent); border-radius: var(--r);
    background: color-mix(in oklch, var(--surface) 58%, transparent);
    backdrop-filter: blur(16px) saturate(1.1); -webkit-backdrop-filter: blur(16px) saturate(1.1);
    padding: 0.4375rem 0.75rem 0.5rem;
  }
  /* As with the modules, no frost on a phone: it is costly to keep redrawing. */
  @media (max-width: 720px), (pointer: coarse) {
    .music { backdrop-filter: none; -webkit-backdrop-filter: none; background: color-mix(in oklch, var(--surface) 82%, transparent); }
  }
  .vol { position: absolute; right: 0.5rem; bottom: 0.5rem; z-index: 2; }
  .shuf, .loop {
    position: absolute; left: 0.5rem; bottom: 0.5rem; z-index: 2;
    width: 1.75rem; height: 1.75rem; border-radius: 50%; display: grid; place-items: center; padding: 0;
    border: 0; background: none; color: var(--dim); cursor: pointer; transition: color 0.15s ease, background-color 0.15s ease;
  }
  .loop { left: 2.375rem; }
  .shuf:hover:not(:disabled), .loop:hover { color: var(--a); }
  .shuf.on, .loop.on { color: var(--a); background: var(--a-wash); }
  .shuf:disabled { opacity: 0.35; cursor: default; }
  .volbtn {
    width: 1.75rem; height: 1.75rem; border-radius: 50%; display: grid; place-items: center; padding: 0;
    border: 0; background: none; color: var(--dim); cursor: pointer; transition: color 0.15s ease;
  }
  .volbtn:hover, .vol.open .volbtn { color: var(--a); }
  /* A narrow upright pill above the speaker, holding a slider turned on end. */
  .pop {
    position: absolute; left: 50%; bottom: calc(100% + 0.25rem); width: 1.625rem; height: 4.25rem;
    border: 1px solid var(--line); border-radius: 999px; background: color-mix(in oklch, var(--surface) 94%, transparent);
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
    opacity: 0; pointer-events: none; transform: translate(-50%, 6px) scale(0.92); transform-origin: bottom center;
    transition: opacity 0.16s ease, transform 0.2s cubic-bezier(0.2, 0.8, 0.3, 1);
  }
  .vol.open .pop, .vol:focus-within .pop { opacity: 1; pointer-events: auto; transform: translate(-50%, 0); }
  /* Bridges the gap down to the speaker, so the pointer never leaves on the way up. */
  .pop::after { content: ''; position: absolute; left: -0.25rem; right: -0.25rem; top: 100%; height: 0.5rem; }
  .pop input {
    -webkit-appearance: none; appearance: none; position: absolute; left: 50%; top: 50%;
    width: 3.125rem; height: 4px; margin: 0; border-radius: 2px; transform: translate(-50%, -50%) rotate(-90deg);
    background: linear-gradient(to right, var(--a) var(--v), var(--line) var(--v)); cursor: pointer; touch-action: none;
  }
  .pop input::-webkit-slider-thumb {
    -webkit-appearance: none; width: 0.75rem; height: 0.75rem; border-radius: 50%; background: var(--a); border: 0;
  }
  .pop input::-moz-range-thumb { width: 0.75rem; height: 0.75rem; border-radius: 50%; background: var(--a); border: 0; }
  .ythost { position: fixed; left: -10000px; top: 0; width: 200px; height: 200px; opacity: 0; pointer-events: none; }
  .title {
    max-width: 100%; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 0.4375rem;
    font-size: 0.8125rem; color: var(--dim);
  }
  .playing .title { color: var(--text); }
  .text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .text.bad { color: var(--bad); white-space: normal; text-align: center; }
  /* Three small bars that dance while it plays and rest while it doesn't. */
  .eq { flex: none; display: inline-flex; align-items: flex-end; gap: 2px; height: 0.75rem; }
  .eq i { width: 2px; height: 30%; background: var(--a); border-radius: 1px; transform-origin: bottom; }
  .playing .eq i { animation: eq 0.9s ease-in-out infinite; height: 100%; }
  .playing .eq i:nth-child(2) { animation-delay: -0.3s; }
  .playing .eq i:nth-child(3) { animation-delay: -0.6s; }
  @keyframes eq { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
  .time { display: flex; align-items: center; gap: 0.5rem; width: 100%; }
  .t { flex: none; min-width: 2.25rem; font-size: 0.6875rem; color: var(--dim); font-variant-numeric: tabular-nums; }
  .t:last-child { text-align: right; }
  /* Tall enough to grab with a thumb; the line itself stays thin. */
  .time input {
    -webkit-appearance: none; appearance: none; flex: 1; min-width: 0; height: 1.25rem; margin: 0; background: none;
    cursor: pointer; touch-action: none;
  }
  .time input:disabled { cursor: default; opacity: 0.5; }
  .time input::-webkit-slider-runnable-track {
    height: 4px; border-radius: 2px; background: linear-gradient(to right, var(--a) var(--p), var(--line) var(--p));
  }
  .time input::-moz-range-track { height: 4px; border-radius: 2px; background: var(--line); }
  .time input::-moz-range-progress { height: 4px; border-radius: 2px; background: var(--a); }
  .time input::-webkit-slider-thumb {
    -webkit-appearance: none; width: 0.75rem; height: 0.75rem; margin-top: -4px; border-radius: 50%; background: var(--a); border: 0;
    transform: scale(0.8); transition: transform 0.15s ease;
  }
  .time input:hover::-webkit-slider-thumb, .time input:active::-webkit-slider-thumb { transform: scale(1.1); }
  .time input::-moz-range-thumb { width: 0.75rem; height: 0.75rem; border-radius: 50%; background: var(--a); border: 0; }
  .row { display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
  .ctl {
    flex: none; width: 1.875rem; height: 1.875rem; border-radius: 50%; display: grid; place-items: center;
    padding: 0; border: 1px solid transparent; background: none; color: var(--text); cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease, transform 0.08s ease;
  }
  .ctl:hover:not(:disabled) { background: var(--a-wash); color: var(--a); }
  .ctl:active:not(:disabled) { transform: scale(0.92); }
  .ctl:disabled { opacity: 0.4; cursor: default; }
  .ctl.play { width: 2.125rem; height: 2.125rem; background: var(--a-wash); color: var(--a); border-color: var(--a-edge); }
  @media (prefers-reduced-motion: reduce) { .playing .eq i { animation: none; } }
</style>
