/**
 * A phone: the layout built for a thumb (a bottom bar between places, windows
 * rising from the bottom). Narrow screens only; a tablet keeps the desktop
 * layout. One switch, so the two layouts never both run.
 */
import { MediaQuery } from 'svelte/reactivity';

export const PHONE_QUERY = '(max-width: 700px)';
export const phone = new MediaQuery(PHONE_QUERY, false);
