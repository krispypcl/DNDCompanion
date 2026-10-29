/**
 * The splash has to be painted by the document, not by the app: anything the
 * app renders can only appear after hydration, which let the sheet flash past
 * first. These guard that arrangement, since nothing else would catch it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const shell = readFileSync('src/app.html', 'utf8');
const component = readFileSync('src/lib/components/Splash.svelte', 'utf8');

describe('splash', () => {
  it('is in the document shell, ahead of the app', () => {
    expect(shell).toMatch(/id="splash"/);
    expect(shell.indexOf('id="splash"')).toBeLessThan(shell.indexOf('%sveltekit.body%'));
  });

  it('carries its own styles, because the shell links no stylesheet', () => {
    const style = shell.slice(shell.indexOf('<style>'), shell.indexOf('</style>'));
    expect(style).toMatch(/#splash\s*\{/);
    expect(style).toMatch(/position: fixed/);
    expect(style).toMatch(/background:/);
  });

  it('does not fade in, which is what let the app show first', () => {
    const style = shell.slice(shell.indexOf('<style>'), shell.indexOf('</style>'));
    const base = style.slice(style.indexOf('#splash {'), style.indexOf('#splash svg'));
    expect(base).not.toMatch(/splash-in/);
    expect(base).not.toMatch(/opacity: 0/);
  });

  it('gives up on its own if the bundle never arrives', () => {
    expect(shell).toMatch(/splash-giveup/);
  });

  it('renders nothing itself; it only takes the shell one away', () => {
    const markup = component.slice(component.indexOf('</script>') + '</script>'.length).trim();
    expect(markup).toBe('');
    expect(component).toMatch(/getElementById\('splash'\)/);
    expect(component).toMatch(/\.remove\(\)/);
  });
});
