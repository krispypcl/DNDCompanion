/**
 * The Owlbear Rodeo extension's manifest: what Owlbear reads when someone
 * adds the extension by this file's address. Built with the site, so its
 * paths carry the site's base path.
 */
import { base } from '$app/paths';
import { version } from '$app/environment';

export const prerender = true;

export function GET() {
  const at = (p: string) => `${base}/owlbear/${p}`;
  const site = String(import.meta.env.PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  const manifest = {
    name: 'DND Companion',
    version: '1.0.0',
    manifest_version: 1,
    author: 'DND Companion',
    description: 'Your DND Companion characters at the table: live hit points, AC and conditions, tokens that wear their portraits and follow their sheets, and the sheets’ rolls in the room.',
    ...(site ? { homepage_url: `${site}/` } : {}),
    icon: at('icon.svg'),
    background_url: at('background'),
    action: {
      title: 'DND Companion',
      icon: at('icon.svg'),
      popover: at('panel'),
      width: 380,
      height: 600
    }
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'content-type': 'application/json', 'x-build': version }
  });
}
