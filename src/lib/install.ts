/**
 * Putting the app on a phone's home screen. Android's browsers offer to
 * install it themselves (`beforeinstallprompt`), and that offer is kept here
 * so a button can make it; an iPhone never offers, so it is shown the way
 * (components/InstallTip). Already installed, nothing is said.
 */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let offer: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    offer = e as InstallPrompt;
    tell();
  });
  window.addEventListener('appinstalled', () => {
    offer = null;
    tell();
  });
}

/** Opened from the home screen (or as an installed app): nothing to install. */
export function installed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Which way to show: an iPhone or iPad, an Android phone, or anything else. */
export function platform(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent): 'ios' | 'android' | 'other' {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

/** Whether the browser has offered to install it (a button can then do it in one press). */
export const canPrompt = () => offer !== null;

/** Asks the browser to install it; true once it is. */
export async function promptInstall(): Promise<boolean> {
  const o = offer;
  if (!o) return false;
  offer = null;
  tell();
  await o.prompt();
  return (await o.userChoice).outcome === 'accepted';
}

export function onInstallChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
