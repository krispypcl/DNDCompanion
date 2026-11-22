import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePlaylist, youtubePlayable } from '#lib/music.ts';

describe('parsePlaylist', () => {
  it('reads YouTube and YouTube Music playlists', () => {
    expect(parsePlaylist('https://music.youtube.com/playlist?list=PLabcdef123')).toEqual({ kind: 'youtube', list: 'PLabcdef123' });
    expect(parsePlaylist('https://www.youtube.com/playlist?list=PLabcdef123&si=x')).toEqual({ kind: 'youtube', list: 'PLabcdef123' });
    expect(parsePlaylist('youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdef123')).toEqual({ kind: 'youtube', video: 'dQw4w9WgXcQ', list: 'PLabcdef123' });
    expect(parsePlaylist('https://youtu.be/dQw4w9WgXcQ')).toEqual({ kind: 'youtube', video: 'dQw4w9WgXcQ' });
  });
  it('turns away anything else', () => {
    expect(parsePlaylist('')).toBeNull();
    expect(parsePlaylist('https://soundcloud.com/x/sets/y')).toBeNull();
    expect(parsePlaylist('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBeNull();
    expect(parsePlaylist('https://www.youtube.com/')).toBeNull();
    expect(parsePlaylist('not a link at all')).toBeNull();
  });
});

describe('youtubePlayable (a video its owner keeps on YouTube cannot be a sound effect)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads oEmbed: allowed, kept on YouTube, or no answer', async () => {
    const answers: Record<string, number> = { okvideo01: 200, keptvideo1: 401, gonevideo1: 404, busyvideo1: 503 };
    const fetcher = vi.fn(async (url: string) => {
      const id = decodeURIComponent(url).match(/v=([\w-]+)/)![1];
      return new Response('{}', { status: answers[id] });
    });
    vi.stubGlobal('fetch', fetcher);
    expect(await youtubePlayable('okvideo01')).toBe(true);
    expect(await youtubePlayable('keptvideo1')).toBe(false);
    expect(await youtubePlayable('gonevideo1')).toBe(false);
    expect(await youtubePlayable('busyvideo1')).toBeNull();
    // Asked once per video.
    await youtubePlayable('keptvideo1');
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
