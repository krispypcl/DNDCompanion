import { describe, expect, it } from 'vitest';
import { parsePlaylist } from '$lib/music';

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
