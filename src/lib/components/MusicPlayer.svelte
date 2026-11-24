<script lang="ts">
  /**
   * The music player (a sheet's, top center, and the campaign's table music):
   * the song playing, its timeline, and its controls, over a YouTube player
   * kept out of sight. It plays a YouTube (or YouTube Music) playlist, or a
   * single video's sound, once or on loop.
   *
   * Its speaker is its mute (music.ts musicOn): off (the default), the music
   * waits, paused; on, it plays at once, or at the first tap on the page
   * where the browser will not start sound by itself.
   *
   * As a capsule (the campaign page's table music, minimized, and all the
   * players ever see of it): the dancing bars, the title, scrolling when it
   * outruns its line, a speaker that mutes and opens a volume slider, play
   * and pause, and for the DM a button back to the whole player. The YouTube
   * player underneath is the same either way, so switching between the two
   * never stops the song.
   *
   * The player is rebuilt only when the link itself changes. The parent hands
   * in a new sheet on every edit, so everything here hangs off the link as a
   * string, which stays equal however often it is handed in again.
   */
  import { onDestroy, untrack } from 'svelte';
  import { fade, popIn } from '#lib/motion.ts';
  import { get } from 'svelte/store';
  import {
    clock, loadYouTube, musicOn, parsePlaylist, setMusicOn, storeLoop, storeShuffle, storedLoop, storeVolume, storedShuffle, storedVolume,
    type Playlist, type YTPlayer
  } from '#lib/music.ts';
  import { session } from '#lib/stores/session.ts';
  import { loopOf, saveLoop, saveShuffle, shuffleOf, type MusicPlace } from '#lib/data/session.ts';
  import { profile } from '#lib/stores/profile.ts';

  let {
    url,
    place = 'sheet',
    onended,
    ontitle,
    onlength,
    lead,
    follow = null,
    resume = null,
    away = false,
    idle = '',
    capsule = false,
    onexpand,
    oncompact
  }: {
    /** Drawn as the little capsule (see above). */
    capsule?: boolean;
    /** The DM's capsule: back to the whole player. */
    onexpand?: () => void;
    /** The DM's whole player: folded into the capsule (an icon beside the song's name). */
    oncompact?: () => void;
    url: string;
    /** With no music to play yet: the player drawn still, saying this. */
    idle?: string;
    /** A sheet's player or a campaign's jukebox: each remembers its own loop. */
    place?: MusicPlace;
    /** Told when the music runs out (loop off): the jukebox moves on. */
    onended?: () => void;
    /** Told each song's title as YouTube gives it. */
    ontitle?: (title: string) => void;
    /** Told a single song's length in seconds, once it is known. */
    onlength?: (seconds: number) => void;
    /** The DM's jukebox: told what it is doing (playing or not, where), for the table to follow. */
    lead?: (now: Moment) => void;
    /**
     * A player's view of the DM's jukebox: it plays what the DM plays, where
     * they are in it, with only the volume and the speaker of its own.
     */
    follow?: (Moment & { at: number }) | null;
    /** The DM coming back to music already playing: carry on from there, once. */
    resume?: (Moment & { at: number }) | null;
    /** Following, and the DM is not on the campaign page: the music waits at 0:00. */
    away?: boolean;
  } = $props();

  type Moment = { playing: boolean; t: number; item?: number };
  const following = $derived(Boolean(follow));
  /** Where the DM's music should be now, by the clock. */
  const expected = (m: Moment & { at: number }) => m.t + (m.playing ? Math.max(0, (Date.now() - m.at) / 1000) : 0);
  /** What the DM's page last told the table, to notice when the song wanders from it. */
  let told: (Moment & { at: number }) | null = null;
  function tell() {
    if (!lead || !yt || hushed) return;
    const state = yt.getPlayerState();
    const now = {
      playing: state === 1 || state === 3,
      t: yt.getCurrentTime?.() ?? 0,
      ...(playlist?.list ? { item: Math.max(0, yt.getPlaylistIndex?.() ?? 0) } : {})
    };
    told = { ...now, at: Date.now() };
    lead(now);
  }
  /**
   * The DM's song can fall behind the clock (buffering, a slow device); the
   * table follows the clock. Every few seconds the DM's page checks, and
   * tells the table again when it has wandered more than a second.
   */
  $effect(() => {
    if (!lead || !playing) return;
    const check = setInterval(() => {
      if (!yt || !told || !told.playing || hushed) return;
      if (Math.abs((yt.getCurrentTime?.() ?? 0) - expected(told)) > 1.2) tell();
    }, 4000);
    return () => clearInterval(check);
  });
  /** A follower's page checks just as often that it is still where the DM is. */
  $effect(() => {
    if (!following || !ready) return;
    const check = setInterval(() => untrack(syncFollow), 4000);
    return () => clearInterval(check);
  });
  /** A player's page catching up with the DM's music. */
  function syncFollow() {
    const f = untrack(() => follow);
    if (!f || !yt || !ready || !get(musicOn)) return;
    const want = expected(f);
    if (playlist?.list && f.item != null && (yt.getPlaylistIndex?.() ?? -1) !== f.item) {
      yt.playVideoAt(f.item);
      pendingSeek = want;
      if (!f.playing) setTimeout(() => yt?.pauseVideo(), 600);
      return;
    }
    const cur = yt.getCurrentTime?.() ?? 0;
    const state = yt.getPlayerState();
    if (f.playing) {
      if (Math.abs(cur - want) > 1.5) yt.seekTo(want, true);
      if (state !== 1 && state !== 3) yt.playVideo();
    } else {
      if (state === 1 || state === 3) fadeThen(() => yt?.pauseVideo());
      if (Math.abs(cur - f.t) > 0.75) yt.seekTo(f.t, true);
    }
  }
  /** Where to go once the new song has started (a playlist item asked for by number). */
  let pendingSeek: number | null = null;
  $effect(() => {
    // The DM did something: follow it.
    void follow;
    if (ready) untrack(syncFollow);
  });

  /**
   * Shuffle: the player's own choice, kept with their account (or on this
   * device when not signed in). On, the playlist is put in a fresh random
   * order each time the sheet opens, the first song included.
   */
  let shuffle = $state(false);
  /** What the player wants, read when it is needed rather than when the page
      happened to render: the account's choice, or this device's. */
  const wantShuffle = () => shuffleOf(get(profile)) ?? (typeof localStorage === 'undefined' ? false : storedShuffle());
  $effect(() => {
    const fromAccount = shuffleOf($profile);
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
    const fromAccount = loopOf($profile, place);
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
    if (get(musicOn)) yt?.unMute();
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
   * skipping, or the speaker going off dip the sound first. What the player
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
  let toldLength = 0;
  function readTime() {
    if (!yt || scrubbing) return;
    length = yt.getDuration?.() ?? 0;
    // A single song's length, once: the jukebox shows it in the list.
    if (length > 0 && !playlist?.list && Math.round(length) !== toldLength) {
      toldLength = Math.round(length);
      onlength?.(toldLength);
    }
    // Following, the bar shows where the DM is, listening or not.
    const f = untrack(() => follow);
    at = f ? Math.min(expected(f), length || Infinity) : (yt.getCurrentTime?.() ?? 0);
  }
  $effect(() => {
    void follow;
    if (!playing && !following) return;
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
    setTimeout(tell, 150);
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
      if (get(musicOn) && !userPaused) start();
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
    if (follow) {
      if (playing) fadeTo(1, FADE_IN);
      syncFollow();
      return;
    }
    // The DM's music was already going: pick it up where it is.
    const r = untrack(() => resume);
    if (r && resumeOnce) {
      resumeOnce = false;
      if (r.playing) yt.seekTo(expected(r), true);
      else {
        // Paused when the DM left it: it waits where it stopped, for their play.
        yt.seekTo(r.t, true);
        yt.pauseVideo();
        userPaused = true;
        readTime();
        return;
      }
    }
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
      if (yt && state !== 1 && state !== 3 && get(musicOn) && !userPaused) armGesture();
    }, 1500);
  }
  function stop() {
    fadeThen(() => {
      // The DM's own speaker only silences their page: the table plays on.
      if (!lead || userPaused) yt?.pauseVideo();
      yt?.mute();
    });
  }
  let resumeOnce = true;

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
    toldLength = 0;
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
              pendingShuffle = !untrack(() => follow) && wantShuffle() && Boolean(p.list);
              if (pendingShuffle && !applyShuffle(false) && pendingShuffle) {
                // Ask for the list itself (not the one song the link opened
                // on), so its songs are fetched, then wait for them.
                try { yt.cuePlaylist({ list: p.list!, listType: 'playlist' }); } catch { /* not ready */ }
                startWatch();
              }
              hushNow();
              lastStep = performance.now();
              fader = setInterval(fadeStep, 50);
              if (get(musicOn)) start();
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
                if (pendingSeek != null) {
                  yt?.seekTo(pendingSeek, true);
                  pendingSeek = null;
                }
              }
              if (e.data === 1 || e.data === 2) tell();
              // Following: the DM's page says what comes next, not this one.
              if (e.data === 0 && untrack(() => follow)) {
                updateTitle();
                return;
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
  const unsub = musicOn.subscribe((on) => {
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
    // A shuffle still waiting for the player would keep asking a gone one.
    stopWatch();
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
    if (!get(musicOn)) setMusicOn(true);
    else start();
  }

  const status = $derived(
    failed
      ? 'That playlist won’t play! It may be private, or the link is off.'
      : !ready
        ? 'Tuning the lute'
        : waiting
          ? 'Tap anywhere to start the music'
          : title || (playing ? 'Playing' : 'Paused')
  );
  // ── The title and the speaker ──
  /** How far the title outruns its line; past it, the title runs from right to left without end. */
  let capBox = $state(0);
  let capText = $state(0);
  const capOver = $derived(Math.max(0, capText - capBox));
  /** On a touch screen the first tap on the speaker opens the slider; the next mutes. */
  let skipMute = false;
  function speakerDown(e: PointerEvent) {
    if (e.pointerType !== 'mouse' && !volOpen) {
      volOpen = true;
      skipMute = true;
    }
  }
  function speaker() {
    if (skipMute) {
      skipMute = false;
      return;
    }
    setMusicOn(!$musicOn);
  }
  let capVol = $state<HTMLElement>();
  function closeVolOutside(e: PointerEvent) {
    if (volOpen && capVol && !capVol.contains(e.target as Node)) volOpen = false;
  }
</script>

<svelte:window onpointerdown={closeVolOutside} />

{#snippet speakerIcon()}
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
    <path d="M2.5 6.2h2.3l3-2.6v8.8l-3-2.6H2.5z" fill="currentColor" />
    {#if !$musicOn || volume === 0}
      <path d="M10.5 6.2l3.4 3.6M13.9 6.2l-3.4 3.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    {:else}
      <path d="M10.4 6a2.8 2.8 0 0 1 0 4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
      {#if volume > 50}<path d="M12.3 4.2a5.4 5.4 0 0 1 0 7.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />{/if}
    {/if}
  </svg>
{/snippet}

{#snippet playIcon(size: number)}
  {#if playing}
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true"><path d="M4.5 3h2.2v10H4.5zM9.3 3h2.2v10H9.3z" fill="currentColor" /></svg>
  {:else}
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor" /></svg>
  {/if}
{/snippet}

<!-- The song's name on one line. Past its room it runs from right to left without end: drawn
     twice, a gap between, and moved by exactly one name and its gap, so each turn starts where the
     last one ended. -->
{#snippet scroller(text: string)}
  <span class="capbox" class:rolling={capOver > 2} bind:clientWidth={capBox} title={text}>
    <!-- A new song's name rises into place rather than replacing the last one at once. -->
    <!-- The rise is on its own wrapper: the scroll moves the track by transform too. -->
    {#key text}
      <span class="titlein" in:popIn>
        <span class="track" style:--shift="-{capText}px" style:--dur="{Math.max(6, capText / 34)}s">
          <span class="captext" class:bad={failed} bind:clientWidth={capText}>{text}</span>{#if capOver > 2}<span class="captext copy" class:bad={failed} aria-hidden="true">{text}</span>{/if}
        </span>
      </span>
    {/key}
  </span>
{/snippet}

{#snippet capsuleView(text: string, live: boolean)}
  <div class="capsule" class:playing={live && playing} role="group" aria-label="Table music" in:fade={{ duration: 200 }}>
    <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
    {@render scroller(text)}
    {#if live}
      <!-- Volume before play: its slider slides out to the left, so play never moves. -->
      <div class="capvol" class:open={volOpen} bind:this={capVol} role="group" aria-label="Volume"
           onmouseenter={() => { clearTimeout(volTimer); volOpen = true; }}
           onmouseleave={() => { clearTimeout(volTimer); volTimer = setTimeout(() => (volOpen = false), 450); }}
           onfocusin={() => (volOpen = true)}>
        <input class="caprange" type="range" min="0" max="100" step="1" value={volume} aria-label="Volume"
               style:--v="{volume}%" tabindex={volOpen ? 0 : -1} oninput={(e) => setVol(Number(e.currentTarget.value))} />
        <button class="capbtn" aria-pressed={!$musicOn} aria-label={$musicOn ? 'Mute the music' : 'Unmute the music'}
                title={$musicOn ? `Mute (volume ${volume}%)` : 'Unmute'} onpointerdown={speakerDown} onclick={speaker}>
          {@render speakerIcon()}
        </button>
      </div>
      {#if !following}
        <button class="capbtn" aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'} disabled={!ready || failed} onclick={toggle}>
          {@render playIcon(12)}
        </button>
      {/if}
    {/if}
    {#if onexpand}
      <button class="capbtn" aria-label="Open the whole music player" title="Open the whole player" onclick={onexpand}>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
    {/if}
  </div>
{/snippet}

<!--
  The whole player: the bars, the song's name (centered) and, for the DM,
  Minimize, on one line; the timeline; then one row of controls on a single
  middle line: shuffle and loop on the left, back, play, and next in the
  center, the speaker on the right. At rest (no song yet) it is the same
  player, still, so nothing changes size when a song arrives.
-->
{#snippet wholeView(text: string, live: boolean)}
  <div class="music" class:playing={live && playing} class:idle={!live} role="group" aria-label="Music" in:fade={{ duration: 200 }}>
    <div class="title" aria-live="polite">
      <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
      {@render scroller(text)}
      {#if oncompact}
        <button class="capbtn" aria-label="Minimize the music player" title="Minimize" onclick={oncompact}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M13.5 6.5h-4v-4M2.5 9.5h4v4M9.5 6.5 14 2M6.5 9.5 2 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      {:else}
        <span class="titlepad" aria-hidden="true"></span>
      {/if}
    </div>
    <!-- The song's timeline: dragged or tapped with a mouse or a finger. -->
    <div class="time">
      <span class="t">{clock(live ? at : 0)}</span>
      <input type="range" min="0" max={Math.max(1, length)} step="0.5" value={live ? Math.min(at, length || 1) : 0}
             aria-label="Song position" aria-valuetext="{clock(at)} of {clock(length)}"
             disabled={!live || !ready || failed || !length || following}
             style:--p="{live && length ? (Math.min(at, length) / length) * 100 : 0}%"
             onpointerdown={() => (scrubbing = true)}
             onpointerup={() => (scrubbing = false)}
             onpointercancel={() => (scrubbing = false)}
             oninput={(e) => { scrubbing = true; scrubTo(Number(e.currentTarget.value)); }}
             onchange={(e) => seek(Number(e.currentTarget.value))} />
      <span class="t">−{clock(live ? Math.max(0, length - at) : 0)}</span>
    </div>
    <div class="row">
      <div class="side">
        {#if live && !following && playlist}
          <button class="capbtn toggle" aria-pressed={shuffle} disabled={!playlist.list}
                  aria-label={shuffle ? 'Shuffle on' : 'Shuffle off'}
                  title={!playlist.list ? 'One song: nothing to shuffle' : shuffle ? 'Shuffle on: a new order every visit' : 'Shuffle off'}
                  onclick={toggleShuffle}>
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M2 4.5h2.4c1.3 0 2.2.6 2.9 1.7l1.4 3.6c.7 1.1 1.6 1.7 2.9 1.7H14M2 11.5h2.4c1.3 0 2.2-.6 2.9-1.7M9.3 5.6c.6-.7 1.4-1.1 2.3-1.1H14M12 2.6l2 1.9-2 1.9M12 9.6l2 1.9-2 1.9"
                    fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button class="capbtn toggle" aria-pressed={looping} aria-label={looping ? 'Loop on' : 'Loop off'}
                  title={looping
                    ? (playlist.list ? 'Loop on: the playlist starts over at its end' : 'Loop on: the song plays again')
                    : place === 'campaign' ? 'Loop off: the next song on the list follows' : 'Loop off: the music stops at the end'}
                  onclick={toggleLoop}>
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M3 7.2V6.4c0-1.1.9-2 2-2h7.2M10.6 2.6l1.9 1.8-1.9 1.8M13 8.8v.8c0 1.1-.9 2-2 2H3.8M5.4 13.4l-1.9-1.8 1.9-1.8"
                    fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        {/if}
      </div>
      {#if following}
        <!-- A player's page: the DM plays; they have only the speaker. -->
        {#key away ? 'away' : follow?.playing}
          <span class="by" in:fade={{ duration: 200 }}>{away ? 'The DM isn’t here yet' : follow?.playing ? 'The DM is playing' : 'The DM has paused'}</span>
        {/key}
      {:else}
        <div class="mid">
          <button class="ctl" aria-label="Previous song" title="Previous" disabled={!live || !ready || failed || !playlist?.list}
                  onclick={() => fadeThen(() => yt?.previousVideo())}>
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3.5 3v10M13 3.2v9.6L5.6 8z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
          </button>
          <button class="ctl play" aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}
                  disabled={!live || !ready || failed} onclick={toggle}>
            {@render playIcon(14)}
          </button>
          <button class="ctl" aria-label="Next song" title="Next" disabled={!live || !ready || failed || !playlist?.list}
                  onclick={() => fadeThen(() => yt?.nextVideo())}>
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M12.5 3v10M3 3.2v9.6L10.4 8z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
          </button>
        </div>
      {/if}
      <div class="side end">
        {#if live}
          <!-- The speaker mutes; hovered (or tapped once on a touch screen), the volume rises above it. -->
          <div class="vol" class:open={volOpen} bind:this={capVol} role="group" aria-label="Volume"
               onmouseenter={() => { clearTimeout(volTimer); volOpen = true; }}
               onmouseleave={() => { clearTimeout(volTimer); volTimer = setTimeout(() => (volOpen = false), 450); }}
               onfocusin={() => (volOpen = true)}>
            <div class="pop">
              <input type="range" min="0" max="100" step="1" value={volume} aria-label="Volume"
                     style:--v="{volume}%" tabindex={volOpen ? 0 : -1}
                     oninput={(e) => setVol(Number(e.currentTarget.value))} />
            </div>
            <button class="capbtn" aria-pressed={!$musicOn} aria-label={$musicOn ? 'Mute the music' : 'Unmute the music'}
                    title={$musicOn ? `Mute (volume ${volume}%)` : 'Unmute'} onpointerdown={speakerDown} onclick={speaker}>
              {@render speakerIcon()}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/snippet}

{#if playlist}
  <!-- Out of sight: YouTube plays here and the controls drive it. Outside the
       two looks, so switching between them never stops the song. -->
  <div class="ythost" bind:this={host} aria-hidden="true"></div>
{/if}
{#if playlist && capsule}
  {@render capsuleView(following && away ? 'The DM isn’t here yet' : status, true)}
{:else if playlist}
  <!-- Each look only fades in: folding one into the other never leaves the old one fading out beside it. -->
  {@render wholeView(status, true)}
{:else if idle && capsule}
  {@render capsuleView(idle, false)}
{:else if idle}
  {@render wholeView(idle, false)}
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
  .idle .captext { color: var(--dim); }
  /* As with the modules, no frost on a phone: it is costly to keep redrawing. */
  @media (max-width: 720px), (pointer: coarse) {
    .music { backdrop-filter: none; -webkit-backdrop-filter: none; background: color-mix(in oklch, var(--surface) 82%, transparent); }
  }
  /* The speaker, its slider rising above it over the module rather than in it. */
  .vol { position: relative; z-index: 2; display: inline-flex; }
  /* A narrow upright pill above the speaker, holding a slider turned on end. */
  .pop {
    position: absolute; left: 50%; bottom: calc(100% + 0.25rem); width: 1.625rem; height: 4.25rem;
    border: 1px solid var(--line); border-radius: 999px; background: color-mix(in oklch, var(--surface) 94%, transparent);
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
    opacity: 0; pointer-events: none; transform: translate(-50%, 6px) scale(0.92); transform-origin: bottom center;
    transition: opacity 0.16s var(--ease-out), transform 0.2s cubic-bezier(0.2, 0.8, 0.3, 1);
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
  /* The capsule: a pill one line high. */
  .capsule {
    display: inline-flex; align-items: center; gap: 0.5rem; height: 2.25rem; min-width: 0; max-width: min(24rem, 100%);
    padding: 0 0.3125rem 0 0.875rem; border-radius: 999px; font-size: 0.8125rem; color: var(--dim);
    border: 1px solid color-mix(in oklch, var(--line) 70%, transparent);
    background: color-mix(in oklch, var(--surface) 70%, transparent);
    backdrop-filter: blur(14px) saturate(1.1); -webkit-backdrop-filter: blur(14px) saturate(1.1);
  }
  @media (max-width: 720px), (pointer: coarse) {
    .capsule { backdrop-filter: none; -webkit-backdrop-filter: none; background: color-mix(in oklch, var(--surface) 88%, transparent); }
  }
  .capsule.playing { color: var(--text); }
  .capbox { flex: 1 1 auto; min-width: 3rem; overflow: clip; white-space: nowrap; }
  .capbox.rolling { mask-image: linear-gradient(to right, transparent 0, #000 0.625rem, #000 calc(100% - 0.625rem), transparent 100%); }
  .titlein { display: inline-block; }
  .track { display: inline-block; white-space: nowrap; }
  .captext { display: inline-block; padding: 0 0.625rem 0 0; }
  /* Running: the gap after each name is the same, so the loop never shows its seam. */
  .capbox.rolling .track { padding-left: 0.625rem; animation: capscroll var(--dur) linear infinite; }
  .capbox.rolling .captext { padding: 0 2.5rem 0 0; }
  .captext.bad { color: var(--bad); }
  /* A name that fits sits in the middle of its room; a long one scrolls from its start. */
  .capbox:not(.rolling) { text-align: center; }
  .capbox:not(.rolling) .captext { padding: 0 0.3125rem; }
  @keyframes capscroll { to { transform: translateX(var(--shift)); } }
  /* Without motion the title wraps instead: it is never cut short. */
  @media (prefers-reduced-motion: reduce) {
    .capsule { height: auto; min-height: 2.25rem; padding-block: 0.25rem; border-radius: 1.125rem; }
    .capbox, .track { white-space: normal; overflow-wrap: anywhere; mask-image: none; }
    .titlein { display: inline; }
    .capbox.rolling .track { animation: none; padding-left: 0; }
    .capbox.rolling .captext { padding: 0; }
    .captext.copy { display: none; }
  }
  /* The same when reduced motion was chosen on the account page: the global
     rule there stops the scroll, which would otherwise leave the name cut short. */
  :global(html[data-motion='reduce']) .capsule { height: auto; min-height: 2.25rem; padding-block: 0.25rem; border-radius: 1.125rem; }
  :global(html[data-motion='reduce']) :is(.capbox, .track) { white-space: normal; overflow-wrap: anywhere; mask-image: none; }
  :global(html[data-motion='reduce']) .titlein { display: inline; }
  :global(html[data-motion='reduce']) .capbox.rolling .track { animation: none; padding-left: 0; }
  :global(html[data-motion='reduce']) .capbox.rolling .captext { padding: 0; }
  :global(html[data-motion='reduce']) .captext.copy { display: none; }
  .capbtn {
    flex: none; width: 1.75rem; height: 1.75rem; border-radius: 50%; display: grid; place-items: center; padding: 0;
    border: 0; background: none; color: var(--dim); cursor: pointer; transition: color 0.15s var(--ease-out), background-color 0.15s var(--ease-out), transform 0.08s var(--ease-out);
  }
  .capbtn:hover:not(:disabled), .capvol.open .capbtn, .vol.open > .capbtn { color: var(--a); background: var(--a-wash); }
  .capbtn:active:not(:disabled) { transform: translateY(1px); }
  .capbtn:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  .capbtn:disabled { opacity: 0.4; cursor: default; }
  .capbtn[aria-pressed='true'] { color: var(--bad); }
  /* Shuffle and loop: on is the accent, as on the whole player. */
  .capbtn.toggle[aria-pressed='true'] { color: var(--a); background: var(--a-wash); }
  .capvol { flex: none; display: inline-flex; align-items: center; }
  .caprange {
    -webkit-appearance: none; appearance: none; width: 0; height: 4px; margin: 0; padding: 0; border-radius: 2px; opacity: 0;
    background: linear-gradient(to right, var(--a) var(--v), var(--line) var(--v)); cursor: pointer; touch-action: none;
    transition: width 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s var(--ease-out), margin 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .capvol.open .caprange { width: 5.5rem; opacity: 1; margin: 0 0.375rem 0 0.25rem; }
  .caprange::-webkit-slider-thumb { -webkit-appearance: none; width: 0.75rem; height: 0.75rem; border-radius: 50%; background: var(--a); border: 0; }
  .caprange::-moz-range-thumb { width: 0.75rem; height: 0.75rem; border-radius: 50%; background: var(--a); border: 0; }
  .ythost { position: fixed; left: -10000px; top: 0; width: 200px; height: 200px; opacity: 0; pointer-events: none; }
  /* The bars on the left, the name centered, Minimize (or its room) on the right. */
  .title {
    width: 100%; min-width: 0; display: grid; grid-template-columns: 1.75rem minmax(0, 1fr) 1.75rem; align-items: center;
    gap: 0.25rem; font-size: 0.8125rem; color: var(--dim);
  }
  .title .eq { justify-self: start; margin-left: 0.125rem; }
  .title .capbox { text-align: center; }
  .title .captext { padding: 0; }
  .title .rolling { text-align: left; }
  .playing .title { color: var(--text); }
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
    transform: scale(0.8); transition: transform 0.15s var(--ease-out);
  }
  .time input:hover::-webkit-slider-thumb, .time input:active::-webkit-slider-thumb { transform: scale(1.1); }
  .time input::-moz-range-thumb { width: 0.75rem; height: 0.75rem; border-radius: 50%; background: var(--a); border: 0; }
  /* One line of controls: shuffle and loop; back, play, and next; the speaker. */
  .row { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 0.25rem; }
  .side { display: flex; align-items: center; gap: 0.125rem; min-width: 0; }
  .side.end { justify-content: flex-end; }
  .mid { display: flex; align-items: center; gap: 0.5rem; }
  .ctl {
    flex: none; width: 1.875rem; height: 1.875rem; border-radius: 50%; display: grid; place-items: center;
    padding: 0; border: 1px solid transparent; background: none; color: var(--text); cursor: pointer;
    transition: background-color 0.15s var(--ease-out), color 0.15s var(--ease-out), transform 0.08s var(--ease-out);
  }
  .ctl:hover:not(:disabled) { background: var(--a-wash); color: var(--a); }
  .ctl:active:not(:disabled) { transform: scale(0.92); }
  .ctl:disabled { opacity: 0.4; cursor: default; }
  .ctl.play { width: 2.125rem; height: 2.125rem; background: var(--a-wash); color: var(--a); border-color: var(--a-edge); }
  .by { font-size: 0.75rem; color: var(--dim); text-align: center; }
  @media (prefers-reduced-motion: reduce) { .playing .eq i { animation: none; } }
</style>
