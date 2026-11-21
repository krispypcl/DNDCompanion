/**
 * A phone's two bars, drawn once by the layout (TopBar, BottomBar) outside
 * every page, so they keep one place on every screen, never move with a
 * page or anything inside it, and come and go with their own motion. A page
 * says what goes in them with PhoneTop and PhoneBar, which draw nothing
 * themselves.
 */
import type { Snippet } from 'svelte';
import type { PhonePlace } from '#lib/components/PhoneBar.svelte';

/** themeCss: the page's own colors (theme.ts themeStyle), so the bar's accent is the page's. */
export type TopSpec = { left?: Snippet; right?: Snippet; themeCss?: string; owner: symbol };
export type BarSpec = { places: PhonePlace[]; active: string; onchoose: (key: string) => void; dock?: Snippet; themeCss?: string; owner: symbol };

class Chrome {
  top = $state.raw<TopSpec | null>(null);
  bar = $state.raw<BarSpec | null>(null);
}

export const chrome = new Chrome();
