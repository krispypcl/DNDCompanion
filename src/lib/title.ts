/** A tab's title: the page's own name first, then the app's ("Account | DND Companion"). */
export const APP_NAME = 'DND Companion';

export function pageTitle(name?: string | null): string {
  const own = (name ?? '').trim();
  return own ? `${own} | ${APP_NAME}` : APP_NAME;
}
