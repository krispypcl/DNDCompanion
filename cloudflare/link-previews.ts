/**
 * Link previews for DND Companion, as a Cloudflare Worker in front of the
 * GitHub Pages site.
 *
 * GitHub Pages has no file for /s/<id> or /c/<id>, so it answers with the
 * app's 404.html, with status 404 and the site-wide title and picture. Chat
 * apps and social sites read that and either show nothing or show the same
 * card for every link. This Worker passes every request through untouched,
 * except a sheet's or a campaign's page: there it answers 200 and writes the
 * character's (or campaign's) name, a line about them, and their portrait
 * (or banner) into the preview tags. People still get the same app.
 *
 * Settings (Worker → Settings → Variables and Secrets):
 *   SUPABASE_URL       https://<project>.supabase.co
 *   SUPABASE_ANON_KEY  the public anon key (the same one the site uses)
 *   ORIGIN             optional. Set it (https://krispypcl.github.io) when the
 *                      Worker has its own address (workers.dev) and fetches
 *                      the site from GitHub; leave it unset when the Worker
 *                      runs on a route of a domain already pointing at GitHub.
 *   HOME_PATH          optional, default /DNDCompanion/: where "/" sends people
 *                      when ORIGIN is set.
 *
 * Built into dist/link-previews.js (npm run build:worker), which is what goes
 * into the Cloudflare editor.
 */
import { resolveImageUrl } from '../src/lib/rules/imageUrl';

type Env = { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; ORIGIN?: string; HOME_PATH?: string };
type Preview = { title: string; description: string; image?: string };

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A sheet's or a campaign's page, either way it is written: /s/<id> (the
 * address bar's) or /s?id=<id> (the Share button's), and the same for /c.
 */
function pageOf(url: URL): { kind: 's' | 'c'; id: string } | null {
  const path = url.pathname.replace(/\/+$/, '').replace(/\.html$/, '');
  const byPath = path.match(/\/([sc])\/([^/]+)$/);
  if (byPath && ID.test(byPath[2])) return { kind: byPath[1] as 's' | 'c', id: byPath[2] };
  const byQuery = path.match(/\/([sc])$/);
  const id = url.searchParams.get('id') ?? '';
  if (byQuery && ID.test(id)) return { kind: byQuery[1] as 's' | 'c', id };
  return null;
}

async function rows<T>(env: Env, path: string): Promise<T[]> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
    cf: { cacheTtl: 60, cacheEverything: true }
  } as RequestInit);
  if (!res.ok) return [];
  return (await res.json()) as T[];
}

type ClassEntry = { name?: string; subclass?: string; level?: number };
type Identity = {
  name?: string; class?: string; subclass?: string; level?: number; ancestry?: string;
  portraitUrl?: string; bannerUrl?: string; classes?: ClassEntry[];
};

async function sheetPreview(id: string, env: Env): Promise<Preview | null> {
  const [row] = await rows<{ name: string; identity: Identity | null }>(env, `sheets?id=eq.${id}&select=name,identity:definition->identity`);
  if (!row) return null;
  const who = row.identity ?? {};
  const classes = who.classes?.length
    ? who.classes.map((c) => `${c.name ?? ''}${c.level ? ` ${c.level}` : ''}`.trim()).filter(Boolean).join(' / ')
    : [who.class, who.level ? String(who.level) : ''].filter(Boolean).join(' ');
  const total = who.classes?.length ? who.classes.reduce((n, c) => n + (c.level ?? 0), 0) : who.level;
  const line = [who.classes && who.classes.length > 1 && total ? `Level ${total}` : '', who.ancestry, classes].filter(Boolean).join(' ');
  const image = resolveImageUrl(who.portraitUrl).url || resolveImageUrl(who.bannerUrl).url || undefined;
  return {
    title: who.name || row.name || 'A character',
    description: line || 'A D&D 5e character sheet.',
    image
  };
}

async function campaignPreview(id: string, env: Env): Promise<Preview | null> {
  const [row] = await rows<{ name: string; details: { bannerUrl?: string } | null }>(env, `campaigns?id=eq.${id}&select=name,details`);
  if (!row) return null;
  const count = (await rows<{ id: string }>(env, `sheets?campaign_id=eq.${id}&select=id`)).length;
  return {
    title: row.name || 'A campaign',
    description: count ? `A D&D campaign with ${count} ${count === 1 ? 'character' : 'characters'} at the table.` : 'A D&D campaign.',
    image: resolveImageUrl(row.details?.bannerUrl).url || undefined
  };
}

/**
 * The page at GitHub, asked for plainly: always over https (an http ORIGIN
 * would only be sent back to https), and with only the headers that matter,
 * so nothing about this address confuses GitHub.
 */
function fromOrigin(url: URL, request: Request, origin: string): Request {
  const target = new URL(url.pathname + url.search, origin.trim());
  target.protocol = 'https:';
  const headers = new Headers();
  for (const name of ['accept', 'accept-language', 'user-agent', 'if-none-match', 'if-modified-since', 'range']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Request(target.toString(), { method: request.method, headers, redirect: 'manual' });
}

/** A redirect from GitHub to itself points back here instead, so people stay on this address. */
function keepHere(res: Response, url: URL, origin?: string): Response {
  const location = res.headers.get('location');
  if (!origin || !location || res.status < 300 || res.status > 399) return res;
  const to = new URL(location, url);
  const github = new URL(origin.trim());
  if (to.hostname !== github.hostname) return res;
  to.protocol = url.protocol;
  to.host = url.host;
  const headers = new Headers(res.headers);
  headers.set('location', to.toString());
  return new Response(res.body, { status: res.status, headers });
}

const set = (value: string) => ({ element: (el: Element) => { el.setAttribute('content', value); } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (env.ORIGIN && url.pathname === '/') return Response.redirect(new URL(env.HOME_PATH || '/DNDCompanion/', url).toString(), 302);
    const upstream = keepHere(await fetch(env.ORIGIN ? fromOrigin(url, request, env.ORIGIN) : request), url, env.ORIGIN);

    const html = (upstream.headers.get('content-type') ?? '').includes('text/html');
    const match = pageOf(url);
    if (!html || !match) {
      // Any other page the app draws itself: the shell, but not an error.
      if (html && upstream.status === 404) return new Response(upstream.body, { status: 200, headers: upstream.headers });
      return upstream;
    }

    let preview: Preview | null = null;
    try {
      preview = match.kind === 's' ? await sheetPreview(match.id, env) : await campaignPreview(match.id, env);
    } catch {
      preview = null;
    }
    const headers = new Headers(upstream.headers);
    headers.set('cache-control', 'public, max-age=60');
    const page = new Response(upstream.body, { status: 200, headers });
    if (!preview) return page;

    const title = `${preview.title} · DND Companion`;
    let rewriter = new HTMLRewriter()
      .on('title', { element: (el) => { el.setInnerContent(title); } })
      .on('meta[property="og:title"]', set(preview.title))
      .on('meta[name="twitter:title"]', set(preview.title))
      .on('meta[name="description"]', set(preview.description))
      .on('meta[property="og:description"]', set(preview.description))
      .on('meta[name="twitter:description"]', set(preview.description))
      .on('head', { element: (el) => { el.append(`<meta property="og:url" content="${url.toString().replace(/"/g, '&quot;')}" />`, { html: true }); } });
    if (preview.image) {
      rewriter = rewriter
        .on('meta[property="og:image"]', set(preview.image))
        .on('meta[name="twitter:image"]', set(preview.image))
        .on('meta[property="og:image:width"]', { element: (el) => { el.remove(); } })
        .on('meta[property="og:image:height"]', { element: (el) => { el.remove(); } })
        .on('meta[property="og:image:alt"]', set(preview.title));
    }
    return rewriter.transform(page);
  }
};
