import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetSound, clatter, deathBell, deathSave, heartbeat, land, nat1, nat20, setSound, soundOn } from '$lib/sound';

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
    createBufferSource() { return { ...node(), buffer: null, start: (t: number) => started.push(t) }; }
    createBiquadFilter() { return { ...node(), type: '', frequency: { value: 0 }, Q: { value: 0 } }; }
    createBuffer(_c: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
  }
  vi.stubGlobal('AudioContext', Ctx);
  return started;
}

describe('sound', () => {
  afterEach(() => {
    setSound(false);
    _resetSound();
    vi.unstubAllGlobals();
  });

  it('is off until turned on, and remembers', () => {
    expect(get(soundOn)).toBe(false);
    const started = fakeAudio();
    nat20();
    expect(started).toHaveLength(0);
    setSound(true);
    expect(localStorage.getItem('dndcompanion:sound')).toBe('on');
  });

  it('plays every effect without throwing once on', () => {
    const started = fakeAudio();
    setSound(true);
    const before = started.length;
    clatter(3); land(); nat20(); nat1(); heartbeat(0.15); deathSave('save', 1); deathSave('fail', 3); deathBell();
    expect(started.length).toBeGreaterThan(before + 10);
  });

  it('beats twice per heartbeat, 0.3s apart', () => {
    const started = fakeAudio();
    setSound(true);
    const n = started.length;
    heartbeat(0.15);
    const times = [...new Set(started.slice(n).map((t) => Math.round(t * 100) / 100))].sort();
    expect(times).toEqual([0.15, 0.45]);
  });
});
