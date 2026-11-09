<script lang="ts">
  /**
   * The extension's panel in Owlbear Rodeo (its toolbar button): the room's
   * characters, live from their sheets — hit points, AC, conditions — with a
   * way to open each sheet, put its token on the map (wearing its portrait),
   * and the latest rolls made on the sheets. Anyone in the room can add a
   * character or a whole campaign by pasting its DND Companion link.
   */
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fade, slide } from 'svelte/transition';
  import { cubicOut, quintOut } from 'svelte/easing';
  import { armorClass, classLine } from '$lib/rules/derived';
  import { vitalStatus } from '$lib/rules/hp';
  import { lookOf } from '$lib/rules/conditions';
  import { resolveImageUrl } from '$lib/rules/imageUrl';
  import { faceFamily, fontFace } from '$lib/rules/fonts';
  import { friendlyDate } from '$lib/rules/dates';
  import { applyMode } from '$lib/stores/mode';
  import { session } from '$lib/stores/session';
  import { signIn, signOut } from '$lib/data/session';
  import { campaignRepo } from '$lib/data/campaigns';
  import { prefersReducedMotion } from '$lib/motion';
  import { addLink, parseLink, removeLink, type RoomLink, type RoomLinks } from '$lib/owlbear/links';
  import { followSheets } from '$lib/owlbear/live';
  import { diceLine, headline, natural, type RollNote } from '$lib/owlbear/rolls';
  import type { Sheet } from '$lib/types';
  import Logo from '../Logo.svelte';
  import ConditionRing from '../ConditionRing.svelte';
  import InfoTip from '../InfoTip.svelte';

  type O = typeof import('$lib/owlbear/obr');
  let obr = $state<O | null>(null);
  let inOwlbear = $state(true);
  let links = $state<RoomLinks>([]);
  let sheets = $state<Sheet[]>([]);
  let loaded = $state(false);
  let rolls = $state<RollNote[]>([]);
  /** Which sheets have a token on the map: sheet id → token ids. */
  let onMap = $state<Record<string, string[]>>({});
  let campaignNames = $state(new Map<string, string>());
  let draft = $state('');
  let error = $state<string | null>(null);
  let busy = $state<string | null>(null);
  let role = $state<'GM' | 'PLAYER'>('PLAYER');

  const ease = () => ({ duration: prefersReducedMotion() ? 0 : 240, easing: cubicOut });

  onMount(() => {
    const stops: (() => void)[] = [];
    let stopFollow = () => {};
    let followKey = '';
    const follow = (l: RoomLinks) => {
      const f = { sheets: l.filter((x) => x.kind === 'sheet').map((x) => x.id), campaigns: l.filter((x) => x.kind === 'campaign').map((x) => x.id) };
      const key = JSON.stringify(f);
      if (key === followKey) return;
      followKey = key;
      stopFollow();
      stopFollow = followSheets(f, (s) => {
        sheets = s;
        loaded = true;
      }, () => {
        error = 'The characters wouldn’t load! Check your connection and try again.';
        loaded = true;
      });
      if (f.campaigns.length) campaignRepo.names(f.campaigns).then((m) => (campaignNames = m)).catch(() => {});
    };
    void (async () => {
      const m = await import('$lib/owlbear/obr');
      if (!m.OBR.isAvailable) {
        inOwlbear = false;
        loaded = true;
        return;
      }
      await m.ready();
      obr = m;
      stops.push(await m.followTheme(applyMode));
      role = await m.OBR.player.getRole();
      links = await m.getLinks();
      follow(links);
      rolls = await m.getRolls();
      stops.push(m.onLinks((l) => { links = l; follow(l); }));
      stops.push(m.onRolls((r) => (rolls = r)));
      const readMap = (items: { id: string; metadata: Record<string, unknown> }[]) => {
        const next: Record<string, string[]> = {};
        for (const i of items) {
          const link = m.linkOf(i as never);
          if (link) (next[link.id] ??= []).push(i.id);
        }
        onMap = next;
      };
      if (await m.OBR.scene.isReady()) readMap(await m.OBR.scene.items.getItems());
      stops.push(m.OBR.scene.items.onChange(readMap));
      stops.push(m.OBR.scene.onReadyChange(async (ok) => readMap(ok ? await m.OBR.scene.items.getItems() : [])));
    })();
    return () => {
      stopFollow();
      stops.forEach((s) => s());
    };
  });

  async function add() {
    const link = parseLink(draft);
    if (!link) {
      error = 'That’s not a DND Companion link! Paste the address of a character’s sheet or a campaign page.';
      return;
    }
    error = null;
    draft = '';
    if (!obr) return;
    const next = addLink(links, link);
    links = next;
    await obr.setLinks(next).catch(() => (error = 'The room wouldn’t take that! Try again in a moment.'));
  }
  async function unlink(link: RoomLink) {
    if (!obr) return;
    const next = removeLink(links, link);
    links = next;
    await obr.setLinks(next).catch(() => (error = 'That one held on! Try again in a moment.'));
  }
  async function place(s: Sheet) {
    if (!obr) return;
    busy = s.id;
    error = null;
    try {
      await obr.placeToken(s);
    } catch (e) {
      error = e instanceof Error ? e.message : 'The token slipped off the table! Try again.';
    } finally {
      busy = null;
    }
  }
  async function find(s: Sheet) {
    if (!obr) return;
    const ids = onMap[s.id] ?? [];
    if (!ids.length) return;
    await obr.OBR.player.select(ids, true);
    const box = await obr.OBR.scene.items.getItemBounds(ids).catch(() => null);
    if (box) await obr.OBR.viewport.animateToBounds({ ...box, min: { x: box.min.x - box.width, y: box.min.y - box.height }, max: { x: box.max.x + box.width, y: box.max.y + box.height }, width: box.width * 3, height: box.height * 3 });
  }

  /** Characters grouped: linked one by one, then each campaign's. */
  const groups = $derived.by(() => {
    const direct = new Set(links.filter((l) => l.kind === 'sheet').map((l) => l.id));
    const out: { link: RoomLink | null; title: string; sheets: Sheet[] }[] = [];
    const solo = sheets.filter((s) => direct.has(s.id));
    if (solo.length) out.push({ link: null, title: '', sheets: solo });
    for (const l of links.filter((x) => x.kind === 'campaign')) {
      out.push({ link: l, title: campaignNames.get(l.id) ?? 'Campaign', sheets: sheets.filter((s) => s.campaign_id === l.id && !direct.has(s.id)) });
    }
    return out;
  });
  const directLink = (s: Sheet) => links.find((l) => l.kind === 'sheet' && l.id === s.id) ?? null;
  const faces = $derived([...new Set(sheets.map((s) => fontFace(s.definition?.identity?.nameFont)?.href).filter(Boolean) as string[])]);

  // ── Signing in, here inside Owlbear (it keeps its own sign-in) ──
  let signing = $state(false);
  let email = $state('');
  let password = $state('');
  let authError = $state<string | null>(null);
  let authBusy = $state(false);
  async function doSignIn(e: SubmitEvent) {
    e.preventDefault();
    authBusy = true;
    authError = null;
    try {
      await signIn(email.trim(), password);
      signing = false;
      password = '';
    } catch (err) {
      authError = err instanceof Error ? err.message : 'That didn’t work! Check your email and password.';
    } finally {
      authBusy = false;
    }
  }

  const ago = (at: number, _tick = 0) => {
    const s = Math.round((Date.now() - at) / 1000);
    if (s < 50) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    return friendlyDate(new Date(at).toISOString());
  };
  let tickNow = $state(0);
  onMount(() => {
    const t = setInterval(() => (tickNow += 1), 30000);
    return () => clearInterval(t);
  });
</script>

<svelte:head>
  <title>DND Companion</title>
  {#each faces as href (href)}<link rel="stylesheet" {href} />{/each}
</svelte:head>

<main class="panel">
  <header>
    <Logo size={22} />
    <span class="brandname">DND Companion</span>
  </header>

  {#if !inOwlbear}
    <p class="note">This page is the DND Companion extension for Owlbear Rodeo. Add it in Owlbear (Extensions → Add custom extension) with this address:
      <code>{location.origin}{location.pathname.replace(/panel\/?$/, 'manifest.json')}</code></p>
  {:else}
    <form class="add" onsubmit={(e) => { e.preventDefault(); void add(); }}>
      <input bind:value={draft} placeholder="Paste a character’s or campaign’s link" aria-label="A DND Companion link" />
      <button class="go" disabled={!draft.trim()}>Add</button>
      <InfoTip label="About adding characters">
        Copy the link of a character’s sheet, or of a campaign page for all its characters, from DND Companion and
        paste it here. Everyone in the room sees them, live.
      </InfoTip>
    </form>
    {#if error}<p class="err" role="alert" transition:slide={ease()}>{error}</p>{/if}

    {#if !loaded}
      <p class="note">Gathering the party…</p>
    {:else if !links.length}
      <p class="note">No characters here yet. Paste a link above to bring one to the table.</p>
    {/if}

    {#each groups as g (g.link?.id ?? 'solo')}
      <section class="group" transition:slide={ease()}>
        {#if g.link}
          <h2>
            <span class="gname">{g.title}</span><span class="tag">Campaign</span>
            <button class="x" title="Take this campaign out of the room" aria-label="Take {g.title} out of the room" onclick={() => unlink(g.link!)}>×</button>
          </h2>
          {#if !g.sheets.length}<p class="note">No characters in this campaign yet.</p>{/if}
        {/if}
        <ul class="chars">
          {#each g.sheets as s (s.id)}
            {@const def = s.definition}
            {@const max = Number(def?.combat?.hpMax) || 0}
            {@const cur = Number(s.state?.hpCurrent) || 0}
            {@const temp = Number(s.state?.hpTemp) || 0}
            {@const v = vitalStatus(cur, max, s.state?.deathSaves)}
            {@const portrait = resolveImageUrl(def?.identity?.portraitUrl).url}
            {@const conds = s.state?.conditions ?? []}
            {@const ring = conds.flatMap((c) => { const color = lookOf(c, def?.conditionLooks ?? {})?.color; return color ? [{ key: c.toLowerCase(), color }] : []; })}
            {@const face = fontFace(def?.identity?.nameFont)}
            <li class="char {v.vital}" animate:flip={{ duration: 280, easing: quintOut }} in:fade={{ duration: 180 }}>
              <div class="top">
                <span class="portrait" class:ringed={ring.length > 0}>
                  {#if portrait}<img src={portrait} alt="" />{/if}
                  <ConditionRing bands={ring} />
                </span>
                <span class="who">
                  <strong style:font-family={faceFamily(face)}>{obr?.nameOf(s) ?? s.name}</strong>
                  <span class="sub">{classLine(def) || 'No class yet'}</span>
                </span>
                <span class="ac" title="Armour Class"><b>{def ? armorClass(def).total : '—'}</b><small>AC</small></span>
                {#if directLink(s)}
                  <button class="x" title="Take out of the room" aria-label="Take {obr?.nameOf(s)} out of the room" onclick={() => unlink(directLink(s)!)}>×</button>
                {/if}
              </div>
              {#if max > 0}
                <div class="hp" title="{v.label}">
                  <span class="bar"><span class="fill" style:width="{Math.min(100, (cur / max) * 100)}%"></span>
                    {#if temp > 0}<span class="temp" style:width="{Math.min(100, (temp / max) * 100)}%"></span>{/if}</span>
                  <span class="nums"><b>{cur}</b> / {max}{#if temp > 0}<span class="t"> +{temp}</span>{/if}</span>
                </div>
              {/if}
              {#if conds.length}
                <ul class="conds" aria-label="Conditions">
                  {#each conds as c (c)}
                    {@const look = lookOf(c, def?.conditionLooks ?? {})}
                    <li style:--cc={look?.color} class:plain={!look} transition:fade={{ duration: 160 }}><span class="dot"></span>{c}</li>
                  {/each}
                </ul>
              {/if}
              <div class="acts">
                <a class="btn" href={obr?.sheetUrl(s.id)} target="_blank" rel="noopener noreferrer">Open sheet ↗</a>
                {#if onMap[s.id]?.length}
                  <button class="btn" onclick={() => find(s)}>Find token</button>
                {/if}
                <button class="btn" disabled={busy === s.id} onclick={() => place(s)}>{busy === s.id ? 'Placing…' : onMap[s.id]?.length ? 'Another token' : 'Place token'}</button>
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/each}

    <section class="rolls">
      <h2>Rolls
        <InfoTip label="About rolls">Rolls made in a character’s dice tray on their sheet show up here and pop up for everyone in the room.</InfoTip>
      </h2>
      {#if rolls.length}
        <ol>
          {#each rolls as r (r.sheet + r.at)}
            {@const nat = natural(r)}
            <li class:crit={nat === 'crit'} class:fumble={nat === 'fumble'} animate:flip={{ duration: 260, easing: quintOut }} in:slide={ease()}>
              <span class="head">{headline(r)}</span>
              <span class="dice">{diceLine(r)} · {ago(r.at, tickNow)}</span>
            </li>
          {/each}
        </ol>
      {:else}
        <p class="note">No rolls yet. Roll in a sheet’s dice tray and it lands here.</p>
      {/if}
    </section>

    <footer>
      {#if $session.user}
        <span>Signed in as {$session.user.email}. Hit points can be changed from a token’s menu.</span>
        <button class="link" onclick={() => signOut()}>Sign out</button>
      {:else if !signing}
        <span>{role === 'GM' ? 'Sign in to change your players’ hit points from their tokens.' : 'Sign in to change your hit points from your token.'}</span>
        <button class="link" onclick={() => (signing = true)}>Sign in</button>
      {:else}
        <form class="signin" onsubmit={doSignIn} transition:slide={ease()}>
          <input type="email" bind:value={email} placeholder="Email" autocomplete="email" aria-label="Email" required />
          <input type="password" bind:value={password} placeholder="Password" autocomplete="current-password" aria-label="Password" required />
          <div class="row">
            <button class="go" disabled={authBusy}>{authBusy ? 'Signing in…' : 'Sign in'}</button>
            <button type="button" class="link" onclick={() => (signing = false)}>Cancel</button>
          </div>
          {#if authError}<p class="err" role="alert">{authError}</p>{/if}
          <p class="fine">Owlbear keeps its own sign-in. Signed up with Google? Set a password on your DND Companion account page first.</p>
        </form>
      {/if}
    </footer>
  {/if}
</main>

<style>
  :global(html.in-owlbear), :global(html.in-owlbear body) { background: var(--bg); }
  .panel { padding: 0.875rem 0.875rem 1.25rem; font-size: 0.875rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.75rem; }
  header { display: flex; align-items: center; gap: 0.5rem; color: var(--text); }
  header .brandname { font-size: 1.0625rem; }
  .note { margin: 0; color: var(--dim); font-size: 0.8125rem; line-height: 1.45; }
  .note code { display: block; margin-top: 0.375rem; word-break: break-all; color: var(--text); }
  .err { margin: 0; color: var(--bad); font-size: 0.8125rem; line-height: 1.4; }

  .add { display: flex; gap: 0.375rem; align-items: center; }
  input {
    flex: 1; min-width: 0; font: inherit; font-size: 0.8125rem; padding: 0.4375rem 0.625rem; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--surface);
    transition: border-color 0.15s ease;
  }
  input:hover { border-color: var(--a-edge); }
  input:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  button, .btn { font: inherit; cursor: pointer; }
  .go, .btn {
    border: 1px solid var(--line); background: var(--raised); color: var(--text); border-radius: var(--r-sm);
    padding: 0.375rem 0.625rem; font-size: 0.8125rem; text-decoration: none; white-space: nowrap;
    transition: border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
  }
  .go:hover:not(:disabled), .btn:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  .go:active:not(:disabled), .btn:active:not(:disabled) { transform: translateY(1px); }
  .go:focus-visible, .btn:focus-visible, .x:focus-visible, .link:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  .go:disabled, .btn:disabled { opacity: 0.5; cursor: default; }
  .x {
    margin-left: auto; width: 1.5rem; height: 1.5rem; border: 0; background: none; color: var(--faint); border-radius: 50%;
    font-size: 1rem; line-height: 1; padding: 0; display: grid; place-items: center; transition: color 0.15s ease, background-color 0.15s ease;
  }
  .x:hover { color: var(--danger, var(--bad)); background: var(--raised); }
  .x:active { transform: translateY(1px); }

  .group { display: grid; gap: 0.5rem; }
  h2 {
    margin: 0.25rem 0 0; display: flex; align-items: center; gap: 0.375rem; font-size: 0.6875rem; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--label); font-weight: 600;
  }
  .gname { color: var(--text); letter-spacing: 0.06em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tag { font-size: 0.5625rem; border: 1px solid var(--line); border-radius: 999px; padding: 0.0625rem 0.375rem; color: var(--dim); }
  .chars { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
  .char {
    --hurt-red: oklch(66% 0.22 25);
    border: 1px solid var(--line-soft); border-radius: var(--r); background: var(--surface); padding: 0.625rem 0.6875rem;
    display: grid; gap: 0.5rem; transition: border-color 0.3s ease;
  }
  .char:hover { border-color: var(--a-edge); }
  .char.bloodied { border-color: color-mix(in oklch, var(--hurt-red) 45%, var(--line-soft)); }
  .char.critical, .char.down { border-color: color-mix(in oklch, var(--hurt-red) 80%, transparent); }
  .char.dead { opacity: 0.7; }
  .top { display: flex; align-items: center; gap: 0.625rem; min-width: 0; }
  .portrait {
    position: relative; flex: none; width: 2.75rem; height: 2.75rem; border-radius: var(--r-sm);
    border: 1px solid var(--a-edge); background: linear-gradient(150deg, var(--portrait-from, var(--raised)), var(--portrait-to, var(--surface)));
    transition: border-color 0.35s ease;
  }
  .portrait.ringed { border-color: transparent; }
  .portrait img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
  .who { display: grid; min-width: 0; flex: 1; }
  .who strong { font-size: 0.9375rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { font-size: 0.75rem; color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ac { display: grid; justify-items: center; line-height: 1.05; padding: 0.25rem 0.4375rem; border: 1px solid var(--line-soft); border-radius: var(--r-sm); background: var(--raised); }
  .ac b { font-size: 0.9375rem; font-variant-numeric: tabular-nums; }
  .ac small { font-size: 0.5rem; letter-spacing: 0.1em; color: var(--label); }

  .hp { display: flex; align-items: center; gap: 0.5rem; }
  .bar { position: relative; flex: 1; height: 0.4375rem; border-radius: 999px; background: var(--raised); overflow: hidden; }
  .fill { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: oklch(70% 0.17 150); transition: width 0.5s cubic-bezier(0.2, 0.8, 0.25, 1), background-color 0.4s ease; }
  .bloodied .fill { background: oklch(78% 0.15 80); }
  .critical .fill { background: var(--hurt-red); }
  .temp { position: absolute; inset: 0 auto auto 0; height: 35%; background: oklch(72% 0.13 245); transition: width 0.5s cubic-bezier(0.2, 0.8, 0.25, 1); }
  .nums { font-size: 0.8125rem; color: var(--dim); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .nums b { color: var(--text); }
  .nums .t { color: oklch(72% 0.13 245); }

  .conds { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .conds li {
    display: inline-flex; align-items: center; gap: 0.3125rem; font-size: 0.75rem; padding: 0.0625rem 0.5rem;
    border-radius: 999px; border: 1px solid color-mix(in oklch, var(--cc, var(--line)) 55%, transparent);
    background: color-mix(in oklch, var(--cc, var(--raised)) 14%, transparent);
  }
  .conds .dot { width: 0.4375rem; height: 0.4375rem; border-radius: 50%; background: var(--cc, var(--faint)); }
  .conds .plain .dot { background: none; border: 1px solid var(--faint); }
  .acts { display: flex; gap: 0.375rem; flex-wrap: wrap; }
  .acts .btn { padding: 0.3125rem 0.5625rem; font-size: 0.75rem; }

  .rolls ol { list-style: none; margin: 0.5rem 0 0; padding: 0; display: grid; gap: 0.375rem; }
  .rolls li { display: grid; gap: 0.0625rem; padding: 0.375rem 0.5rem; border-radius: var(--r-sm); background: var(--surface); border: 1px solid var(--line-soft); }
  .rolls li.crit { border-color: color-mix(in oklch, oklch(78% 0.15 80) 70%, transparent); }
  .rolls li.fumble { border-color: color-mix(in oklch, var(--bad) 60%, transparent); }
  .head { font-size: 0.8125rem; }
  .dice { font-size: 0.6875rem; color: var(--faint); }

  footer { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.5rem; font-size: 0.75rem; color: var(--dim); border-top: 1px solid var(--line-soft); padding-top: 0.625rem; }
  .link { border: 0; background: none; color: var(--a); padding: 0; font-size: 0.75rem; text-decoration: underline; text-underline-offset: 2px; border-radius: 2px; }
  .link:hover { color: var(--text); }
  .signin { display: grid; gap: 0.375rem; width: 100%; }
  .signin .row { display: flex; gap: 0.625rem; align-items: center; }
  .fine { margin: 0; font-size: 0.6875rem; color: var(--faint); line-height: 1.4; }
</style>
