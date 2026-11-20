import { afterEach, describe, expect, it, vi } from 'vitest';
import { debounce } from '#lib/debounce.ts';
import { inSafeTriangle } from '#lib/safeTriangle.ts';

afterEach(() => vi.useRealTimers());

describe('debounce', () => {
  it('runs once, after the last call, with its arguments', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const later = debounce(fn, 100);
    later('f');
    later('fi');
    vi.advanceTimersByTime(60);
    later('fir');
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith('fir');
  });

  it('runs what is waiting at once when flushed, and nothing when cancelled', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const later = debounce(fn, 100);
    later(1);
    later.flush();
    expect(fn).toHaveBeenCalledWith(1);
    later(2);
    later.cancel();
    vi.advanceTimersByTime(200);
    later.flush();
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('the safe triangle', () => {
  // A name at the left, its pop-up opened to the right of it.
  const from = { x: 100, y: 200 };
  const popup = new DOMRect(300, 100, 200, 300);

  it('holds a pointer heading for the pop-up, even past other names on the way', () => {
    expect(inSafeTriangle(from, popup, { x: 200, y: 200 })).toBe(true);
    expect(inSafeTriangle(from, popup, { x: 250, y: 130 })).toBe(true);
    expect(inSafeTriangle(from, popup, { x: 250, y: 350 })).toBe(true);
  });

  it('lets go of a pointer heading elsewhere', () => {
    expect(inSafeTriangle(from, popup, { x: 120, y: 60 })).toBe(false);
    expect(inSafeTriangle(from, popup, { x: 60, y: 200 })).toBe(false);
    expect(inSafeTriangle(from, popup, { x: 200, y: 420 })).toBe(false);
  });

  it('works for a pop-up opened above, below or to the left', () => {
    expect(inSafeTriangle({ x: 400, y: 500 }, new DOMRect(300, 100, 200, 200), { x: 400, y: 400 })).toBe(true);
    expect(inSafeTriangle({ x: 400, y: 50 }, new DOMRect(300, 100, 200, 200), { x: 400, y: 80 })).toBe(true);
    expect(inSafeTriangle({ x: 600, y: 200 }, popup, { x: 550, y: 200 })).toBe(true);
  });
});
