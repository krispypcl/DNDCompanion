// src/lib/rules/imageUrl.ts
var none = { url: "", source: "none", note: null };
var invalid = (note) => ({ url: "", source: "invalid", note });
var ok = (url, source, note = null) => ({ url, source, note });
var COPY_ADDRESS = "right-click the picture (or long-press it on a phone) and copy its image address";
var DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;
var IMGUR_ID = /^[A-Za-z0-9]{5,9}$/;
function parse(raw) {
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}
function driveId(url) {
  const inPath = url.pathname.match(/\/d\/([^/]+)/)?.[1];
  const id = inPath ?? url.searchParams.get("id");
  return id && DRIVE_ID.test(id) ? id : null;
}
function oneDriveContent(link) {
  const bytes = new TextEncoder().encode(link);
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  const encoded = btoa(binary).replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
  return `https://api.onedrive.com/v1.0/shares/u!${encoded}/root/content`;
}
var PAGE_ONLY = [
  { test: (h) => /(^|\.)pinterest\.[a-z.]+$/.test(h) || h === "pin.it", name: "a Pinterest pin" },
  { test: (h) => h === "artstation.com", name: "an ArtStation page" },
  { test: (h) => h === "deviantart.com" || h.endsWith(".deviantart.com"), name: "a DeviantArt page" },
  { test: (h) => h === "flickr.com" || h === "flic.kr", name: "a Flickr page" },
  { test: (h) => h === "ibb.co", name: "an ImgBB page" },
  { test: (h) => h === "postimg.cc" || h === "postimages.org", name: "a Postimages page" },
  { test: (h) => h === "photos.app.goo.gl" || h === "photos.google.com", name: "a Google Photos page" },
  { test: (h) => h === "reddit.com" || h === "old.reddit.com" || h === "redd.it", name: "a Reddit post" },
  { test: (h) => h === "x.com" || h === "twitter.com", name: "a post on X" },
  { test: (h) => h === "instagram.com", name: "an Instagram post" },
  { test: (h) => h === "tumblr.com" || /\.tumblr\.com$/.test(h) && !/media\.tumblr\.com$/.test(h), name: "a Tumblr post" },
  { test: (h) => h === "canva.com", name: "a Canva design" }
];
function resolveImageUrl(input) {
  const raw = (input ?? "").trim();
  if (!raw) return none;
  const url = parse(raw);
  if (!url) return invalid("That doesn\u2019t look like a web address!");
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if ((host === "google.com" || /^google\.[a-z.]+$/.test(host)) && url.pathname === "/imgres") {
    const inner = url.searchParams.get("imgurl");
    if (inner) {
      const resolved = resolveImageUrl(inner);
      return resolved.source === "invalid" ? resolved : ok(resolved.url, "google");
    }
  }
  if (host === "drive.google.com" || host === "docs.google.com" || host === "drive.usercontent.google.com") {
    if (/\/folders\//.test(url.pathname)) {
      return invalid("That\u2019s a whole Drive folder! Share one picture and copy its link instead.");
    }
    const id = driveId(url);
    if (!id) return invalid("That Drive link doesn\u2019t point at a file! Use the file\u2019s Share link.");
    return ok(
      `https://lh3.googleusercontent.com/d/${id}`,
      "drive",
      "Google Drive link. The file has to be shared as \u201CAnyone with the link\u201D."
    );
  }
  if (host === "dropbox.com" || host === "dl.dropbox.com" || host === "dl.dropboxusercontent.com") {
    if (/^\/(s|scl|sh)\//.test(url.pathname)) {
      const file = new URL(url.toString());
      file.hostname = "www.dropbox.com";
      file.searchParams.delete("dl");
      file.searchParams.set("raw", "1");
      return ok(file.toString(), "dropbox");
    }
    if (host !== "dropbox.com") return ok(url.toString(), "dropbox");
    return invalid("That Dropbox link isn\u2019t a shared file! Use Share \u2192 Copy link on the picture.");
  }
  if (host === "1drv.ms" || host === "onedrive.live.com") {
    return ok(oneDriveContent(url.toString()), "onedrive", "OneDrive link. The file has to be shared with anyone who has the link.");
  }
  if (host === "github.com") {
    const m = url.pathname.match(/^\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/);
    if (m) return ok(`https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`, "github");
  }
  if (host === "imgur.com" || host === "m.imgur.com") {
    const [first] = url.pathname.split("/").filter(Boolean);
    if (!first) return invalid("That Imgur link doesn\u2019t point at a picture!");
    if (["a", "gallery", "t", "r", "user"].includes(first)) {
      return invalid(`That\u2019s an Imgur album or gallery! Open the picture, ${COPY_ADDRESS}.`);
    }
    const [id, ext] = first.split(".");
    if (!IMGUR_ID.test(id)) return invalid("That Imgur link doesn\u2019t point at a picture!");
    return ok(`https://i.imgur.com/${id}.${ext || "jpg"}`, "imgur");
  }
  if (host === "i.imgur.com") return ok(url.toString(), "imgur");
  if (host.endsWith("pinimg.com")) {
    const sharp = url.toString().replace(/\/(?:60x60|75x75|136x136|170x|236x|474x|564x)\//, "/736x/");
    return ok(sharp, "pinterest");
  }
  if (host === "gyazo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (id && /^[a-f0-9]{32}$/i.test(id)) return ok(`https://i.gyazo.com/${id}.png`, "gyazo");
  }
  if (host === "cdn.discordapp.com" || host === "media.discordapp.net") {
    return ok(url.toString(), "direct", "Discord links stop working after about a day. Host the picture somewhere lasting.");
  }
  const page = PAGE_ONLY.find((p) => p.test(host));
  if (page) {
    return invalid(`That\u2019s ${page.name}, not the picture itself! Open it, ${COPY_ADDRESS}, and paste that here.`);
  }
  return ok(url.toString(), "direct");
}

// cloudflare/link-previews.ts
var ID = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
var SHEET = new RegExp(`/s/${ID}/?$`, "i");
var CAMPAIGN = new RegExp(`/c/${ID}/?$`, "i");
async function rows(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
    cf: { cacheTtl: 60, cacheEverything: true }
  });
  if (!res.ok) return [];
  return await res.json();
}
async function sheetPreview(id, env) {
  const [row] = await rows(env, `sheets?id=eq.${id}&select=name,identity:definition->identity`);
  if (!row) return null;
  const who = row.identity ?? {};
  const classes = who.classes?.length ? who.classes.map((c) => `${c.name ?? ""}${c.level ? ` ${c.level}` : ""}`.trim()).filter(Boolean).join(" / ") : [who.class, who.level ? String(who.level) : ""].filter(Boolean).join(" ");
  const total = who.classes?.length ? who.classes.reduce((n, c) => n + (c.level ?? 0), 0) : who.level;
  const line = [who.classes && who.classes.length > 1 && total ? `Level ${total}` : "", who.ancestry, classes].filter(Boolean).join(" ");
  const image = resolveImageUrl(who.portraitUrl).url || resolveImageUrl(who.bannerUrl).url || void 0;
  return {
    title: who.name || row.name || "A character",
    description: [line, who.player ? `played by ${who.player}` : ""].filter(Boolean).join(", ") || "A D&D 5e character sheet.",
    image
  };
}
async function campaignPreview(id, env) {
  const [row] = await rows(env, `campaigns?id=eq.${id}&select=name,details`);
  if (!row) return null;
  const count = (await rows(env, `sheets?campaign_id=eq.${id}&select=id`)).length;
  return {
    title: row.name || "A campaign",
    description: count ? `A D&D campaign with ${count} ${count === 1 ? "character" : "characters"} at the table.` : "A D&D campaign.",
    image: resolveImageUrl(row.details?.bannerUrl).url || void 0
  };
}
function fromOrigin(url, request, origin) {
  const target = new URL(url.pathname + url.search, origin.trim());
  target.protocol = "https:";
  const headers = new Headers();
  for (const name of ["accept", "accept-language", "user-agent", "if-none-match", "if-modified-since", "range"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Request(target.toString(), { method: request.method, headers, redirect: "manual" });
}
function keepHere(res, url, origin) {
  const location = res.headers.get("location");
  if (!origin || !location || res.status < 300 || res.status > 399) return res;
  const to = new URL(location, url);
  const github = new URL(origin.trim());
  if (to.hostname !== github.hostname) return res;
  to.protocol = url.protocol;
  to.host = url.host;
  const headers = new Headers(res.headers);
  headers.set("location", to.toString());
  return new Response(res.body, { status: res.status, headers });
}
var set = (value) => ({ element: (el) => {
  el.setAttribute("content", value);
} });
var link_previews_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (env.ORIGIN && url.pathname === "/") return Response.redirect(new URL(env.HOME_PATH || "/DNDCompanion/", url).toString(), 302);
    const upstream = keepHere(await fetch(env.ORIGIN ? fromOrigin(url, request, env.ORIGIN) : request), url, env.ORIGIN);
    const html = (upstream.headers.get("content-type") ?? "").includes("text/html");
    const match = url.pathname.match(SHEET) ?? url.pathname.match(CAMPAIGN);
    if (!html || !match) {
      if (html && upstream.status === 404) return new Response(upstream.body, { status: 200, headers: upstream.headers });
      return upstream;
    }
    let preview = null;
    try {
      preview = SHEET.test(url.pathname) ? await sheetPreview(match[1], env) : await campaignPreview(match[1], env);
    } catch {
      preview = null;
    }
    const headers = new Headers(upstream.headers);
    headers.set("cache-control", "public, max-age=60");
    const page = new Response(upstream.body, { status: 200, headers });
    if (!preview) return page;
    const title = `${preview.title} \xB7 DND Companion`;
    let rewriter = new HTMLRewriter().on("title", { element: (el) => {
      el.setInnerContent(title);
    } }).on('meta[property="og:title"]', set(preview.title)).on('meta[name="twitter:title"]', set(preview.title)).on('meta[name="description"]', set(preview.description)).on('meta[property="og:description"]', set(preview.description)).on('meta[name="twitter:description"]', set(preview.description)).on("head", { element: (el) => {
      el.append(`<meta property="og:url" content="${url.toString().replace(/"/g, "&quot;")}" />`, { html: true });
    } });
    if (preview.image) {
      rewriter = rewriter.on('meta[property="og:image"]', set(preview.image)).on('meta[name="twitter:image"]', set(preview.image)).on('meta[property="og:image:width"]', { element: (el) => {
        el.remove();
      } }).on('meta[property="og:image:height"]', { element: (el) => {
        el.remove();
      } }).on('meta[property="og:image:alt"]', set(preview.title));
    }
    return rewriter.transform(page);
  }
};
export {
  link_previews_default as default
};
