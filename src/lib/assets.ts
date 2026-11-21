/**
 * A page shows only once what it shows is here: its pictures fetched and
 * decoded, and its name fonts loaded, so nothing pops in after the page
 * appears. Until then its skeleton stays, the die rolling over it. Never
 * longer than `limit`: a slow or broken picture doesn't hold the page.
 *
 * The pictures are fetched through the browser's own cache, so the page's
 * <img> finds them there and draws them at once.
 */

/** A Google Fonts stylesheet and the family it brings (rules/fonts nameFont). */
export type FontWant = { family: string; href: string };

function picture(src: string): Promise<void> {
  return new Promise((done) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const decoded = typeof img.decode === 'function' ? img.decode() : Promise.resolve();
      decoded.then(() => done(), () => done());
    };
    img.onerror = () => done();
    img.src = src;
  });
}

/** The stylesheet in the page's head (added by the page itself), loaded, then its font. */
async function font({ family, href }: FontWant): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  let link: HTMLLinkElement | null = null;
  for (let i = 0; i < 20 && !link; i++) {
    link = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].find((l) => l.href === href) ?? null;
    if (!link) await new Promise((r) => setTimeout(r, 50));
  }
  if (link && !link.sheet) await new Promise<void>((done) => { link!.addEventListener('load', () => done(), { once: true }); link!.addEventListener('error', () => done(), { once: true }); });
  await document.fonts.load(`600 1em "${family}"`).catch(() => undefined);
}

export function assetsReady(pictures: Iterable<string | null | undefined>, fonts: Iterable<FontWant | null | undefined> = [], limit = 4000): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const pics = [...new Set([...pictures].filter((u): u is string => Boolean(u)))].map(picture);
  const faces = [...fonts].filter((f): f is FontWant => Boolean(f)).map(font);
  const all = Promise.all([...pics, ...faces, document.fonts?.ready ?? Promise.resolve()]).then(() => undefined);
  return Promise.race([all, new Promise<void>((done) => setTimeout(done, limit))]);
}
