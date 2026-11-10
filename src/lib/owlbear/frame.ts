/**
 * How every page of the extension starts: load the Owlbear SDK (only these
 * pages ever do), wait for Owlbear, and follow its light or dark. The way
 * to stop following goes onto `stops`, for the page's cleanup.
 */
import { applyMode } from '$lib/stores/mode';

export type Obr = typeof import('./obr');

export async function joinRoom(stops: (() => void)[]): Promise<Obr> {
  const obr = await import('./obr');
  await obr.ready();
  stops.push(await obr.followTheme(applyMode));
  return obr;
}
