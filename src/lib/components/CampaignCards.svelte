<script lang="ts">
  import { nameFont } from '$lib/rules/fonts';
  /**
   * The campaign's character cards: hit points, AC, passive Perception and
   * Insight, and conditions, each tinted as it tints the player's own
   * screen. The DM can also put the cards in an order of their own by
   * dragging (everyone sees it), give or take away conditions, and, while
   * editing, take a character out of the campaign.
   */
  import { fade, scale, slide } from 'svelte/transition';
  import { backOut, cubicOut, quintOut } from 'svelte/easing';
  import { flip } from 'svelte/animate';
  import { reorder } from '$lib/reorder';
  import { base } from '$app/paths';
  import { armorClass, characterLevel, classLine, passiveScore } from '$lib/rules/derived';
  import { vitalStatus } from '$lib/rules/hp';
  import { resolveImageUrl } from '$lib/rules/imageUrl';
  import { STANDARD_CONDITIONS, cleanName, defaultLook, isStandard, lookKey, lookOf } from '$lib/rules/conditions';
  import ConditionLookPicker from './ConditionLookPicker.svelte';
  import { themeStyle } from '$lib/theme';
  import { followHeight, glideTo, prefersReducedMotion } from '$lib/motion';
  import CardHp from './CardHp.svelte';
  import ConditionRing from './ConditionRing.svelte';
  import type { ConditionLook, Sheet } from '$lib/types';

  let {
    sheets,
    order = [],
    isDm,
    editing,
    ended,
    onorder,
    onremove,
    onconditions,
    onlook
  }: {
    sheets: Sheet[];
    order?: string[];
    isDm: boolean;
    editing: boolean;
    ended: boolean;
    onorder: (ids: string[]) => void;
    onremove: (id: string) => Promise<void> | void;
    onconditions: (id: string, conditions: string[]) => Promise<void> | void;
    /** The DM sets how a condition of the player's own looks (null clears it). */
    onlook?: (id: string, key: string, look: ConditionLook | null) => void;
  } = $props();

  const nameOf = (s: Sheet) => s.definition?.identity?.name || s.name || '';
  /** The conditions' colours round the portrait, a band each; none for conditions without a colour. */
  const ringOf = (conds: string[], looks: Record<string, { color?: string }>) =>
    conds.flatMap((c) => {
      const color = lookOf(c, looks as never)?.color;
      return color ? [{ key: c.toLowerCase(), color }] : [];
    });
  /** A character's chosen name font, if any (rules/fonts.ts). */
  const faceOf = (s: Sheet) => {
    const f = nameFont(s.definition?.identity?.nameFont);
    return f && f !== 'bad' ? f : null;
  };
  /** Each font the table's names use, loaded once. */
  const faces = $derived([...new Set(sheets.map((s) => faceOf(s)?.href).filter(Boolean) as string[])]);
  /** The DM's order first; anyone not in it yet follows by name. */
  const cards = $derived.by(() => {
    const at = new Map(order.map((id, i) => [id, i]));
    return [...sheets].sort((a, b) => {
      const ia = at.get(a.id) ?? Infinity;
      const ib = at.get(b.id) ?? Infinity;
      return ia !== ib ? ia - ib : nameOf(a).localeCompare(nameOf(b));
    });
  });

  const hpOf = (s: Sheet) => {
    const max = Number(s.definition?.combat?.hpMax) || 0;
    const cur = Number(s.state?.hpCurrent) || 0;
    return { max, cur, temp: Number(s.state?.hpTemp) || 0 };
  };
  const unfold = () => ({ duration: prefersReducedMotion() ? 0 : 260, easing: cubicOut });

  // ── Reordering, by the grip: the card follows the pointer and the others
  //    make room in the grid. ──
  const els: Record<string, HTMLElement> = {};
  let drag = $state<{
    id: string; from: number; to: number; dx: number; dy: number;
    x0: number; y0: number; slots: { x: number; y: number; w: number; h: number }[]; ids: string[]; pointer: number;
  } | null>(null);
  function grab(event: PointerEvent, id: string) {
    if (cards.length < 2) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const ids = cards.map((c) => c.id);
    const slots = ids.map((i) => {
      const r = els[i].getBoundingClientRect();
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
    });
    const from = ids.indexOf(id);
    drag = { id, from, to: from, dx: 0, dy: 0, x0: event.clientX + window.scrollX, y0: event.clientY + window.scrollY, slots, ids, pointer: event.pointerId };
  }
  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const px = event.clientX + window.scrollX;
    const py = event.clientY + window.scrollY;
    drag.dx = px - drag.x0;
    drag.dy = py - drag.y0;
    // The slot under the dragged card's centre, or the nearest one.
    const me = drag.slots[drag.from];
    const cx = me.x + me.w / 2 + drag.dx;
    const cy = me.y + me.h / 2 + drag.dy;
    let best = drag.to;
    let bestD = Infinity;
    drag.slots.forEach((s, i) => {
      const d = Math.hypot(s.x + s.w / 2 - cx, s.y + s.h / 2 - cy);
      if (d < bestD) (bestD = d), (best = i);
    });
    drag.to = best;
  }
  function drop(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const { from, to, ids } = drag;
    drag = null;
    if (from === to) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onorder(next);
  }
  function shift(id: string): string | undefined {
    if (!drag) return undefined;
    if (id === drag.id) return `translate(${drag.dx}px, ${drag.dy}px)`;
    const next = drag.ids.filter((i) => i !== drag!.id);
    next.splice(drag.to, 0, drag.id);
    const was = drag.ids.indexOf(id);
    const now = next.indexOf(id);
    if (was === now) return 'translate(0, 0)';
    const a = drag.slots[was];
    const b = drag.slots[now];
    return `translate(${b.x - a.x}px, ${b.y - a.y}px)`;
  }

  // ── Conditions, from the DM ──
  /** While the DM moves a condition, the order it would land in, by sheet. */
  let previews = $state<Record<string, string[] | null>>({});
  let picking = $state<string | null>(null);
  let custom = $state('');
  const has = (list: string[], name: string) => list.some((c) => c.toLowerCase() === name.toLowerCase());
  function toggle(s: Sheet, name: string) {
    const list = s.state?.conditions ?? [];
    const next = has(list, name) ? list.filter((c) => c.toLowerCase() !== name.toLowerCase()) : [...list, name];
    void onconditions(s.id, next);
  }
  function addCustom(s: Sheet) {
    const name = cleanName(custom);
    custom = '';
    if (!name || has(s.state?.conditions ?? [], name)) return;
    void onconditions(s.id, [...(s.state?.conditions ?? []), name]);
    // One of the DM's own, with no look yet: ask what it looks like.
    if (onlook && !isStandard(name)) {
      if (!(lookKey(name) in (s.definition?.conditionLooks ?? {}))) onlook(s.id, lookKey(name), defaultLook());
      tinting = { sheet: s.id, name };
    }
  }
  /** The condition whose look the DM is choosing, on which card. */
  let tinting = $state<{ sheet: string; name: string } | null>(null);
  const lookFor = (s: Sheet, name: string): ConditionLook =>
    s.definition?.conditionLooks?.[lookKey(name)] ?? { color: '', motion: 'pulse' };
  function setLook(s: Sheet, name: string, patch: Partial<ConditionLook>) {
    onlook?.(s.id, lookKey(name), { ...lookFor(s, name), ...patch });
  }
  let removing = $state<string | null>(null);
  $effect(() => {
    if (!editing) removing = null;
  });
</script>

<svelte:head>
  {#each faces as href (href)}<link rel="stylesheet" {href} />{/each}
</svelte:head>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') picking = null; }} />

<ul class="cards" class:dragging={drag}>
  {#each cards as s (s.id)}
    {@const def = s.definition}
    {@const hp = hpOf(s)}
    {@const v = vitalStatus(hp.cur, hp.max, s.state?.deathSaves)}
    {@const portrait = resolveImageUrl(def?.identity?.portraitUrl).url}
    {@const conds = previews[s.id] ?? s.state?.conditions ?? []}
    {@const ring = ringOf(conds, def?.conditionLooks ?? {})}
    <li class="card themed {v.vital}" class:lifted={drag?.id === s.id} bind:this={els[s.id]}
        style={themeStyle(def?.identity?.theme)} style:transform={shift(s.id)}
        animate:glideTo in:fade={{ duration: 200 }}>
      <a class="open" href="{base}/s/{s.id}{s.campaign_id ? `?from=${s.campaign_id}` : ''}">
        <!-- Conditions ring the portrait in their colours (the card's own edge
             is kept for being hurt), a band for each, all the way round. -->
        <span class="portrait" class:ringed={ring.length > 0}
              title={conds.length ? conds.map(cleanName).join(', ') : undefined}>
          {#if portrait}<img src={portrait} alt="" />{/if}
          <ConditionRing bands={ring} />
          <span class="lvl">LV {characterLevel(def)}</span>
        </span>
        <span class="who">
          <strong style:font-family={faceOf(s) ? `'${faceOf(s)!.family}', system-ui, sans-serif` : undefined}>{nameOf(s)}</strong>
          <span class="sub">{classLine(def) || 'No class yet'}</span>
        </span>
      </a>
      <CardHp cur={hp.cur} max={hp.max} temp={hp.temp} vital={v.vital} label={v.label} />
      <dl class="stats">
        <div><dt>AC</dt><dd>{def ? armorClass(def).total : '—'}</dd></div>
        <!-- In full where the box has room, shortened where it does not. -->
        <div class="perc"><dt><span class="long">Passive Perception</span><span class="short">Passive Perc.</span></dt><dd>{passiveScore(def, 'perception')}</dd></div>
        <div class="ins"><dt><span class="long">Passive Insight</span><span class="short">Passive Ins.</span></dt><dd>{passiveScore(def, 'insight')}</dd></div>
      </dl>
      <!-- Conditions, in their own colours; the card eases to its new height. -->
      <div class="condbox" use:followHeight>
        <!-- The DM moves a condition by picking it up (lib/reorder.ts). -->
        <ul class="conds" aria-label="Conditions" class:can-reorder={isDm && !ended && conds.length > 1}
            use:reorder={{ enabled: isDm && !ended, keys: s.state?.conditions ?? [],
                           onpreview: (k) => (previews[s.id] = k),
                           oncommit: (k) => void onconditions(s.id, k) }}>
          {#each conds as c (c)}
            {@const look = lookOf(c, def?.conditionLooks ?? {})}
            <li class:plain={!look} style:--cc={look?.color} data-key={c}
                animate:flip={{ duration: 300, easing: quintOut }}
                transition:scale={{ start: 0.6, duration: 220, easing: backOut }}>
              {#if isDm && !ended && onlook && !isStandard(c)}
                <!-- One of their own: the DM chooses its colour and motion. -->
                <button class="dot tint" class:none={!look} aria-label="Choose how {c} looks" title="Colour and motion"
                        aria-expanded={tinting?.sheet === s.id && tinting.name === c}
                        onclick={() => (tinting = tinting?.sheet === s.id && tinting.name === c ? null : { sheet: s.id, name: c })}></button>
              {:else}
                <span class="dot" aria-hidden="true"></span>
              {/if}{c}
              {#if isDm && !ended}
                <button class="cx" aria-label="Take {c} away from {nameOf(s)}" title="Take away" onclick={() => toggle(s, c)}>×</button>
              {/if}
            </li>
          {/each}
          {#if isDm && !ended}
            <li class="add">
              <button class="plus" aria-expanded={picking === s.id} aria-label="Give {nameOf(s)} a condition"
                      title="Give a condition" onclick={() => (picking = picking === s.id ? null : s.id)}>+</button>
            </li>
          {/if}
        </ul>
        {#if tinting?.sheet === s.id && has(s.state?.conditions ?? [], tinting.name)}
          <ConditionLookPicker name={tinting.name} look={lookFor(s, tinting.name)} who={nameOf(s)}
                               onchange={(patch) => setLook(s, tinting!.name, patch)} ondone={() => (tinting = null)} />
        {/if}
        {#if picking === s.id}
          <div class="picker" transition:slide={unfold()} role="group" aria-label="Conditions for {nameOf(s)}">
            <div class="grid">
              {#each STANDARD_CONDITIONS as name (name)}
                {@const look = lookOf(name)}
                <button class="opt" class:on={has(conds, name)} aria-pressed={has(conds, name)} style:--cc={look?.color}
                        onclick={() => toggle(s, name)}><span class="dot" aria-hidden="true"></span>{name}</button>
              {/each}
            </div>
            <div class="own">
              <input bind:value={custom} placeholder="Something else, e.g. Bless" aria-label="Another condition"
                     onkeydown={(e) => { if (e.key === 'Enter') addCustom(s); }} />
              <button class="give" onclick={() => addCustom(s)} disabled={!custom.trim()}>Give</button>
              <button class="done" onclick={() => (picking = null)}>Done</button>
            </div>
          </div>
        {/if}
      </div>

      {#if isDm && cards.length > 1}
        <button class="grip" aria-label="Drag to move {nameOf(s)}" title="Drag to move"
                onpointerdown={(e) => grab(e, s.id)} onpointermove={move} onpointerup={drop}
                onpointercancel={() => (drag = null)}>
          <svg viewBox="0 0 10 16" width="9" height="14" aria-hidden="true"><g fill="currentColor">
            <circle cx="2.5" cy="3" r="1.3" /><circle cx="7.5" cy="3" r="1.3" /><circle cx="2.5" cy="8" r="1.3" />
            <circle cx="7.5" cy="8" r="1.3" /><circle cx="2.5" cy="13" r="1.3" /><circle cx="7.5" cy="13" r="1.3" />
          </g></svg>
        </button>
      {/if}
      {#if isDm && !ended && editing}
        {#if removing === s.id}
          <div class="confirm" role="group" aria-label="Remove {nameOf(s)}" transition:slide={unfold()}>
            <span>Take out of the campaign?</span>
            <button class="danger" onclick={async () => { await onremove(s.id); removing = null; }}>Remove</button>
            <button class="ghost" onclick={() => (removing = null)}>Keep</button>
          </div>
        {:else}
          <button class="x" aria-label="Remove {nameOf(s)} from the campaign"
                  title="Remove from the campaign" onclick={() => (removing = s.id)}
                  transition:fade={{ duration: 180 }}>×</button>
        {/if}
      {/if}
    </li>
  {/each}
</ul>

<style>
  .cards {
    list-style: none; padding: 0; margin: 1.5rem 0 0;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: 0.875rem;
  }
  /* A fixed red for hurt, as on the sheet's hit points: the theme's own
     danger colour follows its hue, and a blue "Critical" reads as nothing. */
  .card { --hurt-red: oklch(66% 0.22 25); }
  :global([data-mode='light']) .card { --hurt-red: oklch(56% 0.21 25); }
  .card {
    position: relative; border: 1px solid var(--line-soft); border-radius: var(--r); background: var(--surface);
    padding: 0.875rem; display: flex; flex-direction: column;
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
  }
  .card:hover { border-color: var(--a-edge); }
  /* Hurt shows on the card's edge, redder the worse it is. */
  .card.bloodied { border-color: color-mix(in oklch, var(--hurt-red) 45%, var(--line-soft)); }
  .card.critical, .card.down {
    border-color: color-mix(in oklch, var(--hurt-red) 80%, transparent);
    box-shadow: 0 0 0 1px color-mix(in oklch, var(--hurt-red) 25%, transparent);
  }
  .card.dead { opacity: 0.7; border-color: color-mix(in oklch, var(--hurt-red) 60%, var(--line-soft)); }

  /* Dragging: the others slide to make room; the lifted one rides above. */
  .dragging .card { transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.3, 1), border-color 0.3s ease; }
  .dragging .card.lifted {
    transition: none; z-index: 3; cursor: grabbing; border-color: var(--a-edge);
    box-shadow: 0 18px 40px -14px rgb(0 0 0 / 0.65);
  }
  .grip {
    position: absolute; top: 0.5rem; right: 0.5rem; width: 1.625rem; height: 1.625rem; padding: 0;
    display: grid; place-items: center; border: 0; border-radius: var(--r-sm); background: none;
    color: var(--faint); cursor: grab; touch-action: none; opacity: 0; transition: opacity 0.15s ease, color 0.15s ease;
  }
  .card:hover .grip, .grip:focus-visible, .lifted .grip { opacity: 1; }
  .grip:hover { color: var(--a); }
  @media (hover: none) { .grip { opacity: 0.8; } }

  .open { display: flex; gap: 0.75rem; align-items: center; color: inherit; text-decoration: none; min-width: 0; padding-right: 3.25rem; }
  .portrait {
    position: relative; flex: none; width: 3.25rem; height: 3.25rem; border-radius: var(--r-sm);
    border: 1px solid var(--a-edge); background: linear-gradient(150deg, var(--portrait-from), var(--portrait-to));
  }
  .portrait img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
  /* Ringed by conditions (ConditionRing), its own edge steps aside. */
  .portrait { transition: border-color 0.35s ease; }
  .portrait.ringed { border-color: transparent; }
  .lvl {
    position: absolute; left: 50%; bottom: -0.4375rem; transform: translateX(-50%); white-space: nowrap;
    font-size: 0.5625rem; font-weight: 700; letter-spacing: 0.06em; padding: 0.0625rem 0.3125rem;
    border-radius: 999px; background: var(--surface); border: 1px solid var(--a-edge); color: var(--a);
  }
  .who { display: grid; min-width: 0; }
  .who strong { font-size: 1.0625rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { font-size: 0.8125rem; color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.375rem; margin: 0; }
  .stats div { background: var(--raised); border: 1px solid var(--line-soft); border-radius: var(--r-sm); padding: 0.375rem 0.25rem; text-align: center; container-type: inline-size; }
  .stats dt { font-size: 0.5625rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--label); white-space: nowrap; }
  .stats dd { margin: 0.125rem 0 0; font-size: 1.0625rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  .stats .long { display: none; }
  /* Each in full once its box (less its padding) holds the whole label. */
  @container (min-width: 5.5rem) {
    .ins .long { display: inline; }
    .ins .short { display: none; }
  }
  @container (min-width: 7rem) {
    .perc .long { display: inline; }
    .perc .short { display: none; }
  }
  /* Spaced by margins rather than a gap, so the conditions' space can be
     their own: an empty list takes none, and it eases in with the first. */
  .card > :global(*) + :global(*) { margin-top: 0.75rem; }
  .card > .condbox, .card > .x, .card > .grip { margin-top: 0; }
  .conds { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.3125rem; align-items: center; }
  .conds:has(li) { padding-top: 0.75rem; }

  /* A condition's chip in its own colour (the tint it gives the player's screen). */
  .conds li:not(.add) {
    --cc: var(--dim);
    display: inline-flex; align-items: center; gap: 0.3125rem;
    font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 999px; color: var(--text);
    border: 1px solid color-mix(in oklch, var(--cc) 60%, var(--line));
    background: color-mix(in oklch, var(--cc) 18%, var(--raised));
  }
  /* Light mode: the colours were chosen against a dark page. On a light one
     a dark colour (Blinded, Unconscious) turned the chip into a grey slab
     and a pale one (Invisible) all but vanished, so the wash is lighter, the
     edge carries the colour, and the dot gets a darker rim. */
  :global([data-mode='light']) .conds li:not(.add) {
    background: color-mix(in oklch, var(--cc) 9%, var(--surface));
    border-color: color-mix(in oklch, var(--cc) 55%, var(--line));
  }
  :global([data-mode='light']) .opt.on {
    background: color-mix(in oklch, var(--cc) 12%, var(--surface));
    border-color: color-mix(in oklch, var(--cc) 60%, var(--line));
  }
  :global([data-mode='light']) .dot { box-shadow: 0 0 0 1px color-mix(in oklch, var(--text) 40%, transparent); }
  .dot {
    flex: none; width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--cc, var(--dim));
    box-shadow: 0 0 0 1px color-mix(in oklch, var(--text) 25%, transparent);
  }
  .dot.tint {
    width: 0.6875rem; height: 0.6875rem; padding: 0; border: 0; cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .dot.tint:hover, .dot.tint[aria-expanded='true'] { transform: scale(1.15); box-shadow: 0 0 0 1.5px var(--a); }
  .dot.tint:active { transform: scale(1.15) translateY(1px); }
  .dot.tint:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
  .dot.tint.none { background: none; box-shadow: inset 0 0 0 1px var(--dim); }
  .condbox :global(.ask) { margin: 0.625rem 0 0; }
  .cx {
    margin: 0 -0.25rem 0 0; padding: 0 0.125rem; border: 0; background: none; color: var(--dim);
    font-size: 0.875rem; line-height: 1; cursor: pointer;
  }
  .cx:hover { color: var(--bad); }
  .plus {
    width: 1.375rem; height: 1.375rem; padding: 0; display: grid; place-items: center; border-radius: 999px;
    border: 1px dashed var(--line); background: none; color: var(--dim); font-size: 0.9375rem; line-height: 1; cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease, transform 0.2s ease;
  }
  .plus:hover { color: var(--a); border-color: var(--a-edge); }
  .plus[aria-expanded='true'] { color: var(--a); border-color: var(--a-edge); transform: rotate(45deg); }

  .picker { margin-top: 0.625rem; padding: 0.625rem; border-radius: var(--r-sm); background: var(--raised); border: 1px solid var(--line-soft); }
  .grid { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .opt {
    --cc: var(--dim);
    display: inline-flex; align-items: center; gap: 0.3125rem; font: inherit; font-size: 0.75rem; cursor: pointer;
    padding: 0.1875rem 0.5rem; border-radius: 999px; color: var(--dim);
    border: 1px solid var(--line-soft); background: var(--surface);
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .opt:hover { color: var(--text); border-color: color-mix(in oklch, var(--cc) 50%, var(--line)); }
  .opt.on { color: var(--text); border-color: color-mix(in oklch, var(--cc) 65%, var(--line)); background: color-mix(in oklch, var(--cc) 22%, var(--raised)); }
  .own { display: flex; gap: 0.375rem; margin-top: 0.5rem; }
  .own input {
    flex: 1; min-width: 0; font: inherit; font-size: 0.8125rem; padding: 0.3125rem 0.5rem; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  .own input:focus { outline: none; border-color: var(--a-edge); }
  .own button {
    font: inherit; font-size: 0.8125rem; cursor: pointer; border-radius: var(--r-sm); padding: 0.3125rem 0.625rem;
    border: 1px solid var(--a-edge); background: var(--a-wash); color: var(--a);
  }
  .own .done { border-color: var(--line); background: var(--surface); color: var(--text); }
  .own button:disabled { opacity: 0.5; cursor: default; }

  .x {
    position: absolute; top: 0.5rem; right: 2.25rem; width: 1.625rem; height: 1.625rem; padding: 0;
    display: grid; place-items: center; border: 0; background: none; color: var(--dim); font-size: 1.1rem; cursor: pointer;
    opacity: 0; transition: opacity 0.15s ease, color 0.15s ease;
  }
  .card:hover .x, .x:focus-visible { opacity: 1; }
  .x:hover { color: var(--bad); }
  @media (hover: none) { .x { opacity: 1; } }
  .confirm { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: 0.8125rem; color: var(--dim); }
  .confirm button {
    font: inherit; font-size: 0.8125rem; cursor: pointer; border-radius: var(--r-sm); padding: 0.25rem 0.625rem;
    border: 1px solid var(--line); background: var(--surface); color: var(--text);
  }
  .confirm .danger { border-color: var(--bad); background: none; color: var(--bad); }
</style>
