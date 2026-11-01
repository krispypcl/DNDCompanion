import { describe, expect, it } from 'vitest';
import { DESKTOP_CURVE, PHONE_CURVE, STEP, maskSvg, maskUrl, snap } from '$lib/bannerMask';

describe('banner mask', () => {
  it('rounds sizes to a step, never below one', () => {
    expect(snap(1440)).toBe(1440);
    expect(snap(1451)).toBe(1440);
    expect(snap(1460)).toBe(1472);
    expect(snap(3)).toBe(STEP);
  });

  it('draws at the snapped pixel size', () => {
    const svg = maskSvg(1451, 349, DESKTOP_CURVE, 16);
    expect(svg).toContain('width="1440"');
    expect(svg).toContain('height="352"');
    expect(svg).toContain('viewBox="0 0 1440 352"');
  });

  it('runs the shape past the box on top and both sides, so the blur does not fade them', () => {
    const svg = maskSvg(1440, 352, DESKTOP_CURVE, 16);
    const d = svg.match(/ d="([^"]+)"/)![1];
    expect(d.startsWith('M-64,-64')).toBe(true);
    expect(d).toContain('H1504');
    expect(d).toContain('H-64');
  });

  it('follows the same curve as the clip it replaces', () => {
    const d = maskSvg(1000, 320, DESKTOP_CURVE, 16).match(/ d="([^"]+)"/)![1];
    // Right edge at 70% of 320 = 224, left at 30% = 96.
    expect(d).toContain('V224');
    expect(d).toContain('0,96');
  });

  it('gives the phone a shallower curve and a smaller blur', () => {
    expect(PHONE_CURVE.right).toBeLessThan(DESKTOP_CURVE.right);
    const d = maskSvg(384, 416, PHONE_CURVE, 11).match(/ d="([^"]+)"/)![1];
    expect(d).toContain('V191.4');
  });

  it('is a url() a stylesheet can use, with nothing that would end the string early', () => {
    const url = maskUrl(1440, 352, DESKTOP_CURVE, 16);
    expect(url.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(url.endsWith('")')).toBe(true);
    expect(url.slice(5, -2)).not.toMatch(/["<>]/);
  });
});
