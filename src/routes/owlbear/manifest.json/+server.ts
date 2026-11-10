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
    version: '1.2.0',
    manifest_version: 1,
    author: 'DND Companion',
    description: 'Your DND Companion party in the room: live HP and conditions, tied tokens, rolls, the campaign board and table music.',
    ...(site ? { homepage_url: `${site}/` } : {}),
    icon: at('icon.svg'),
    background_url: at('background'),
    action: {
      title: 'DND Companion',
      icon: at('icon.svg'),
      popover: at('panel'),
      width: 460,
      height: 760
    }
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'content-type': 'application/json', 'x-build': version }
  });
}
