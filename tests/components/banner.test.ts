/**
 * The banner. Its geometry and its contrast are measured against the built
 * app with a deliberately hostile image; what is guarded here is the part
 * that would break quietly — that it stays optional, that it crops rather
 * than stretches, and that the tint it depends on is still there.
 */
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import Banner from '$lib/components/Banner.svelte';

const source = readFileSync('src/lib/components/Banner.svelte', 'utf8');
const sheet = readFileSync('src/routes/s/[id]/+page.svelte', 'utf8');
const details = readFileSync('src/lib/components/DetailsBlock.svelte', 'utf8');

describe('Banner', () => {
  it('shows the image it was given', () => {
    const { container } = render(Banner, { props: { url: 'https://example.test/b.png' } });
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://example.test/b.png');
    // Decorative: the sheet's meaning does not depend on it.
    expect(img.getAttribute('alt')).toBe('');
    expect(container.querySelector('.slash')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('crops rather than stretches, whatever shape the image is', () => {
    expect(source).toMatch(/object-fit: cover/);
    expect(source).not.toMatch(/object-fit: fill/);
  });

  it('belongs to the page, not the window, and lags it as it scrolls', () => {
    // Anchored to the sheet, so it scrolls away with the header it sits
    // behind rather than following the reader down the page.
    expect(source).toMatch(/position: absolute/);
    expect(source).not.toMatch(/position: (fixed|sticky)/);
    expect(sheet).toMatch(/\.sheet \{[^}]*position: relative/);
    // Held down by a quarter of the page's travel: that is the lag.
    expect(source).toMatch(/scrollY \* 0\.25/);
    expect(source).toMatch(/translate3d\(0, var\(--drift, 0px\), 0\)/);
    // A layer over the sheet that captured clicks would break every control.
    expect(source).toMatch(/pointer-events: none/);
  });

  it('is the whole top of the sheet, cut off along a curve', () => {
    const { container } = render(Banner, { props: { url: 'https://example.test/b.png' } });
    const path = container.querySelector('clipPath path')!;
    expect(container.querySelector('clipPath')?.getAttribute('clipPathUnits'))
      .toBe('objectBoundingBox');
    const d = path.getAttribute('d')!;
    // Starts at the top corners — the banner is the whole upper portion,
    // not a band with a gap above it.
    expect(d).toMatch(/^M0,0 H1/);
    // And comes back along a cubic rather than a straight edge.
    expect(d).toMatch(/C/);
    expect(source).toMatch(/clip-path: url\(#banner-curve\)/);
  });

  it('holds still for anyone who asked for less movement', () => {
    expect(source).toMatch(/prefersReducedMotion\(\)/);
    expect(source).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transform: none/);
  });

  it('tints the band in the page colour, so it follows light and dark', () => {
    const tint = source.slice(source.indexOf('.tint {'), source.indexOf('@media'));
    expect(tint).toMatch(/var\(--bg\)/);
    expect(tint).not.toMatch(/#[0-9a-f]{3,6}/i);
    // Darkest where the name and class line sit, opening up away from them.
    expect(tint).toMatch(/linear-gradient\(\s*to right/);
  });

  it('is optional: no banner, no layer and no frost', () => {
    expect(sheet).toMatch(/\{#if banner\}<Banner/);
    expect(sheet).toMatch(/class:bannered=\{banner\}/);
    // Every rule that frosts belongs to a selector that names .bannered,
    // so an ordinary sheet never pays for a blur it cannot see.
    // The declaration, not the @supports query that asks whether it exists.
    const rules = sheet.split('}').filter((r) => /backdrop-filter:\s*blur\(\d+px\) saturate/.test(r));
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      const selector = rule.slice(rule.lastIndexOf('\n', rule.indexOf('{')), rule.indexOf('{'));
      expect(selector, rule.trim().slice(0, 60)).toContain('.bannered');
    }
  });

  it('falls back to a solid module where the browser cannot frost', () => {
    expect(sheet).toMatch(/@supports not \(\(backdrop-filter/);
  });

  it('is written right below the portrait URL', () => {
    const portrait = details.indexOf('Portrait URL');
    const banner = details.indexOf('Banner URL');
    expect(portrait).toBeGreaterThan(-1);
    expect(banner).toBeGreaterThan(portrait);
    // They are the only two, and in that order.
    const labels = [...details.matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => m[1]);
    const urls = labels.filter((l) => l.endsWith('URL'));
    expect(urls).toEqual(['Portrait URL', 'Banner URL']);
  });
});
