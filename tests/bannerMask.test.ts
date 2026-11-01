import { describe, expect, it } from 'vitest';
import { DESKTOP_SLASH, FALLBACK_MASK, PHONE_SLASH, slashMask } from '$lib/bannerMask';

const parse = (mask: string) => {
  const angle = Number(mask.match(/linear-gradient\(([\d.]+)deg/)![1]);
  const stops = [...mask.matchAll(/(-?[\d.]+)px/g)].map((m) => Number(m[1]));
  return { angle, stops };
};

describe('banner slash', () => {
  it('is level until the layer has a size', () => {
    expect(slashMask(0, 0, DESKTOP_SLASH)).toBe(FALLBACK_MASK);
  });

  it('is a straight edge falling to the right: square to it is down and a little left', () => {
    const { angle } = parse(slashMask(1440, 432, DESKTOP_SLASH));
    expect(angle).toBeGreaterThan(180);
    expect(angle).toBeLessThan(200);
  });

  it('is level when both sides meet at the same height', () => {
    const { angle, stops } = parse(slashMask(1000, 400, { left: 0.5, right: 0.5, feather: 0.5 }));
    expect(angle).toBe(180);
    // Centred on half way down, fading over half the height.
    expect(stops[0]).toBe(100);
    expect(stops.at(-1)).toBe(300);
  });

  it('fades over a long stretch, solid to clear in order', () => {
    const { stops } = parse(slashMask(1440, 432, DESKTOP_SLASH));
    expect(stops).toEqual([...stops].sort((a, b) => a - b));
    expect(stops.at(-1)! - stops[0]).toBeGreaterThan(432 * 0.5);
  });

  it('falls less steeply on a phone', () => {
    expect(PHONE_SLASH.right - PHONE_SLASH.left).toBeLessThan(DESKTOP_SLASH.right - DESKTOP_SLASH.left);
  });
});
