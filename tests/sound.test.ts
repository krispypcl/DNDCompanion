import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetSound, clatter, coins, cue, deathBell, deathSave, heartbeat, initiativeCall, land, levelUp, nat1, nat20, newRound, nextTurn, setButtonSounds, soundOf, yourTurn } from '#lib/sound.ts';
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
    createBiquadFilter() { return { ...node(), type: '', frequency: param(), Q: { value: 0 } }; }
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

  it('plays the moments new to the table, each made on the spot', () => {
    const started = fakeAudio();
    levelUp(); yourTurn(); initiativeCall(); nextTurn(); newRound(); coins();
    expect(started.length).toBeGreaterThan(30);
  });

  it('plays only the strongest sound of one moment: a press that opens something is heard as that', () => {
    vi.useFakeTimers();
    const started = fakeAudio();
    cue('press');
    cue('success');
    cue('press');
    vi.runAllTimers();
    // The success's three notes, and nothing of the press.
    expect(started.length).toBe(3);
    vi.useRealTimers();
  });

  it('keeps button sounds quiet when they are turned off, never the table’s moments', () => {
    vi.useFakeTimers();
    const started = fakeAudio();
    setButtonSounds(false);
    cue('press');
    vi.runAllTimers();
    expect(started.length).toBe(0);
    cue('newRound');
    vi.runAllTimers();
    expect(started.length).toBeGreaterThan(0);
    setButtonSounds(true);
    vi.useRealTimers();
  });

  it('gives each control its sound by what it is and says', () => {
    const make = (html: string) => {
      document.body.innerHTML = html;
      return document.body.firstElementChild!;
    };
    expect(soundOf(make('<button>Roll</button>'))).toBe('press');
    expect(soundOf(make('<button role="switch" aria-checked="false">Reduce motion</button>'))).toBe('switchOn');
    expect(soundOf(make('<button aria-pressed="true">Mode</button>'))).toBe('switchOff');
    expect(soundOf(make('<button role="tab">Spells</button>'))).toBe('tab');
    expect(soundOf(make('<button class="closex" aria-label="Close">×</button>'))).toBe('back');
    expect(soundOf(make('<button>Keep</button>'))).toBe('back');
    expect(soundOf(make('<button aria-label="Remove Goblin">×</button>'))).toBe('removed');
    expect(soundOf(make('<button>Add</button>'))).toBe('added');
    expect(soundOf(make('<button disabled>Add</button>'))).toBeNull();
    expect(soundOf(make('<button data-sound="none">Quiet</button>'))).toBeNull();
    expect(soundOf(make('<button data-sound="pageTurn">Page 2</button>'))).toBe('pageTurn');
    document.body.innerHTML = '';
  });

  it('beats twice per heartbeat, 0.3s apart', () => {
    const started = fakeAudio();
    const n = started.length;
    heartbeat(0.15);
    const times = [...new Set(started.slice(n).map((t) => Math.round(t * 100) / 100))].sort();
    expect(times).toEqual([0.15, 0.45]);
  });
});
