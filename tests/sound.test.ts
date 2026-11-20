import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetSound, clatter, deathBell, deathSave, heartbeat, hit, land, nat1, nat20, warmSounds } from '#lib/sound.ts';
import { musicOn, setMusicOn } from '#lib/music.ts';

/** Enough of the Web Audio API to count what would be played. */
function fakeAudio() {
  const started: number[] = [];
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const node = () => ({ connect: (n: unknown) => n });
  class Ctx {
    currentTime = 0;
    sampleRate = 8000;
    state = 'running';
    destination = node();
    resume = vi.fn();
    createGain() { return { ...node(), gain: param() }; }
    createOscillator() { return { ...node(), type: '', frequency: param(), start: (t: number) => started.push(t), stop: vi.fn() }; }
    createBufferSource() { return { ...node(), buffer: null, playbackRate: { value: 1 }, start: (t: number) => started.push(t) }; }
    createBiquadFilter() { return { ...node(), type: '', frequency: { value: 0 }, Q: { value: 0 } }; }
    createBuffer(_c: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
  }
  vi.stubGlobal('AudioContext', Ctx);
  return started;
}

describe('sound', () => {
  afterEach(() => {
    _resetSound();
    vi.unstubAllGlobals();
  });

  it('always plays, whatever the music is doing', () => {
    expect(get(musicOn)).toBe(false);
    const started = fakeAudio();
    nat20();
    expect(started.length).toBeGreaterThan(0);
  });

  it('leaves the music its own mute, remembered', () => {
    setMusicOn(true);
    expect(localStorage.getItem('dndcompanion:sound')).toBe('on');
    setMusicOn(false);
    expect(get(musicOn)).toBe(false);
  });

  it('plays every effect without throwing', () => {
    const started = fakeAudio();
    const before = started.length;
    clatter(3); land(); nat20(); nat1(); heartbeat(0.15); deathSave('save', 1); deathSave('fail', 3); deathBell();
    expect(started.length).toBeGreaterThan(before + 10);
  });

  it('plays the sound bank once it has loaded, and makes its own until then', async () => {
    const started = fakeAudio();
    const asked: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      asked.push(url);
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    });
    vi.stubGlobal('OfflineAudioContext', class { decodeAudioData = async () => ({ duration: 1 }); });
    nat20();
    const made = started.length;
    expect(made).toBeGreaterThan(2);
    await warmSounds();
    expect(asked.some((u) => u.endsWith('/sounds/nat20.ogg'))).toBe(true);
    const before = started.length;
    nat20();
    // The jingle and the dice landing: two recordings, not a chord made on the spot.
    expect(started.length - before).toBe(2);
    hit(0.9);
    expect(started.length - before).toBe(4);
  });

  it('makes every sound itself where the bank cannot load', async () => {
    const started = fakeAudio();
    vi.stubGlobal('fetch', async () => ({ ok: false }));
    vi.stubGlobal('OfflineAudioContext', class { decodeAudioData = async () => ({ duration: 1 }); });
    await warmSounds();
    nat20();
    expect(started.length).toBeGreaterThan(2);
  });

  it('beats twice per heartbeat, 0.3s apart', () => {
    const started = fakeAudio();
    const n = started.length;
    heartbeat(0.15);
    const times = [...new Set(started.slice(n).map((t) => Math.round(t * 100) / 100))].sort();
    expect(times).toEqual([0.15, 0.45]);
  });
});
