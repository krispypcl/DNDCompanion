/**
 * The Owlbear Rodeo extension's manifest: what Owlbear reads when someone
 * adds the extension by this file's address. Built with the site, so its
 * paths carry the site's base path.
 */
import { base } from '#lib/base.ts';
import { appVersion } from '#lib/version.ts';
import { version } from '$app/env';

export const prerender = true;

export function GET() {
  const at = (p: string) => `${base}/owlbear/${p}`;
  const site = String(import.meta.env.PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  const manifest = {
    name: 'DND Companion',
    version: appVersion,
    manifest_version: 1,
    author: 'DND Companion',
    description: 'Your DND Companion table in the room: live hit points, tokens, rolls, initiative, monsters and NPCs.',
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
