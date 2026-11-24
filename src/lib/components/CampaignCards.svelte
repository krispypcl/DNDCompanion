<script lang="ts">
  import { nameFont } from '#lib/rules/fonts.ts';
  /**
   * The campaign's character cards: hit points, AC, passive Perception and
   * Insight, and conditions, each tinted as it tints the player's own
   * screen. The DM can also put the cards in an order of their own by
   * dragging (everyone sees it), give or take away conditions, and, while
   * editing, take a character out of the campaign. One's own character (a
   * player's, or the DM's) has a heart beside its name: Damage, Heal, and Temp
   * for a quick change, over the card's head so the card keeps its size.
   */
  import { scale, slide } from 'svelte/transition';
  import { fade, followHeight, glideTo, prefersReducedMotion } from '#lib/motion.ts';
  import { cubicOut, quintOut } from 'svelte/easing';
  import { flip } from 'svelte/animate';
  import { reorder } from '#lib/reorder.ts';
  import { base } from '#lib/base.ts';
  import { armorClass, characterLevel, classLine, mainClass, passiveScore } from '#lib/rules/derived.ts';
  import ClassIcon from './ClassIcon.svelte';
  import { vitalStatus, type HpChange } from '#lib/rules/hp.ts';
  import { resolveImageUrl } from '#lib/rules/imageUrl.ts';
  import { cleanName, defaultLook, isStandard, lookKey, lookOf } from '#lib/rules/conditions.ts';
  import ConditionLookPicker from './ConditionLookPicker.svelte';
  import DimModal from './DimModal.svelte';
  import ConfirmModal from './ConfirmModal.svelte';
  import { phone } from '#lib/stores/phone.svelte.ts';
  import ConditionGiver from './ConditionGiver.svelte';
  import { themeStyle } from '#lib/theme.ts';
  import CardHp from './CardHp.svelte';
  import { cue } from '#lib/sound.ts';
  import { feel } from '#lib/haptics.ts';
  import ConditionRing from './ConditionRing.svelte';
  import Lightbox from './Lightbox.svelte';
  import type { ConditionLook, Sheet } from '#lib/types.ts';

  let {
    sheets,
    order = [],
    isDm,
    ended,
    onorder,
    onremove,
    onconditions,
    onlook,
    me = null,
    onvitals,
    here = new Set<string>()
  }: {
    /** Who is looking (an account id): their own characters' cards carry the quick hit point buttons. */
    me?: string | null;
    /** A quick change to one's own character's hit points. */
    onvitals?: (id: string, kind: HpChange, amount: number) => void;
    /** Who has the campaign's page open (account ids): their cards say so. */
    here?: Set<string>;
    sheets: Sheet[];
    order?: string[];
    isDm: boolean;
    ended: boolean;
    onorder: (ids: string[]) => void;
    onremove: (id: string) => Promise<void> | void;
    onconditions: (id: string, conditions: string[]) => Promise<void> | void;
    /** The DM sets how a condition of the player's own looks (null clears it). */
    onlook?: (id: string, key: string, look: ConditionLook | null) => void;
  } = $props();


  const nameOf = (s: Sheet) => s.definition?.identity?.name || s.name || '';
  /** The conditions' colors round the portrait, a band each; none for conditions without a color. */
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
  /** The amount typed on each own card, spent by its buttons; the card whose buttons are open. */
  let amounts = $state<Record<string, number | string>>({});
  let quickOpen = $state<string | null>(null);
  /** Open, the amount is ready to type; Esc or a press anywhere else closes it (its heart toggles it itself). */
  function quickPane(node: HTMLElement) {
    queueMicrotask(() => node.querySelector('input')?.focus());
    const away = (e: PointerEvent) => {
      const at = e.target as Element | null;
      if (at && !node.contains(at) && !at.closest('.hpkey')) quickOpen = null;
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') quickOpen = null; };
    document.addEventListener('pointerdown', away, true);
    node.addEventListener('keydown', esc);
    return { destroy: () => document.removeEventListener('pointerdown', away, true) };
  }
  function quick(s: Sheet, kind: HpChange) {
    const n = Math.floor(Number(amounts[s.id]));
    if (!Number.isFinite(n) || n <= 0) return;
    amounts[s.id] = '';
    feel(kind === 'damage' ? 'hit' : kind === 'temp' ? 'shield' : 'heal');
    onvitals?.(s.id, kind, n);
  }
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
    cue('pickUp');
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
    // The slot under the dragged card's center, or the nearest one.
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
    cue('drop');
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
  /** A portrait full screen, grown out of the card. */
  let viewing = $state<{ src: string; alt: string; from: Element | null } | null>(null);
  const has = (list: string[], name: string) => list.some((c) => c.toLowerCase() === name.toLowerCase());
  function toggle(s: Sheet, name: string) {
    const list = s.state?.conditions ?? [];
    const next = has(list, name) ? list.filter((c) => c.toLowerCase() !== name.toLowerCase()) : [...list, name];
    void onconditions(s.id, next);
  }
  function addCustom(s: Sheet, written: string) {
    const name = cleanName(written);
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
</script>

<svelte:head>
  {#each faces as href (href)}<link rel="stylesheet" {href} />{/each}
</svelte:head>


<ul class="cards" class:dragging={drag}>
  {#each cards as s (s.id)}
    {@const def = s.definition}
    {@const hp = hpOf(s)}
    {@const v = vitalStatus(hp.cur, hp.max, s.state?.deathSaves)}
    {@const portrait = resolveImageUrl(def?.identity?.portraitUrl).url}
    {@const conds = previews[s.id] ?? s.state?.conditions ?? []}
    {@const ring = ringOf(conds, def?.conditionLooks ?? {})}
    {@const mine = Boolean(onvitals && me && s.owner_id === me && !ended && hp.max > 0)}
    <li class="card hurtcard themed {v.vital}" class:managed={isDm && !ended} class:lifted={drag?.id === s.id} class:present={here.has(s.owner_id)} class:sortable={isDm && cards.length > 1} bind:this={els[s.id]}
        style={themeStyle(def?.identity?.theme)} style:transform={shift(s.id)}
        animate:glideTo>
      <div class="cardhead" class:mine>
        <!-- Conditions ring the portrait in their colors (the card's own edge
             is kept for being hurt), a band for each, all the way round. A
             picture opens full screen; the name opens the sheet. -->
        {#snippet likeness()}
          <!-- No portrait yet: the main class, drawn; a picture covers it. -->
          {#if def}<ClassIcon cls={mainClass(def)} />{/if}
          {#if portrait}<img src={portrait} alt="" />{/if}
          <ConditionRing bands={ring} />
          <span class="lvl">LV {characterLevel(def)}</span>
          {#if here.has(s.owner_id)}
            <!-- Their player has the campaign open right now: a light on the portrait's corner, so nothing else moves. -->
            <span class="herebadge" role="img" aria-label="{nameOf(s)}’s player is here" title="{nameOf(s)}’s player is here" transition:fade={{ duration: 200 }}><i class="here-dot"></i></span>
          {/if}
        {/snippet}
        {#if portrait}
          <button class="portrait" class:ringed={ring.length > 0} aria-label="See {nameOf(s)}’s portrait"
                  title={conds.length ? conds.map(cleanName).join(', ') : 'See it full screen'}
                  onclick={(e) => (viewing = { src: portrait, alt: `Portrait of ${nameOf(s)}`, from: e.currentTarget })}>{@render likeness()}</button>
        {:else}
          <span class="portrait" class:ringed={ring.length > 0} title={conds.length ? conds.map(cleanName).join(', ') : undefined}>{@render likeness()}</span>
        {/if}
        <a class="open" href="{base}/s/{s.id}{s.campaign_id ? `?from=${s.campaign_id}` : ''}">
          <span class="who">
            <strong style:font-family={faceOf(s) ? `'${faceOf(s)!.family}', system-ui, sans-serif` : undefined}>{nameOf(s)}</strong>
            <span class="sub">{classLine(def) || 'No class yet'}</span>
          </span>
        </a>
        {#if mine}
          <!-- Their own character: a quick change, as the sheet's own buttons make it (Enter is damage). -->
          <button class="hpkey" class:on={quickOpen === s.id} aria-expanded={quickOpen === s.id}
                  aria-label="Change {nameOf(s)}’s hit points" title="Damage, Heal, or Temp"
                  onclick={() => (quickOpen = quickOpen === s.id ? null : s.id)}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 20s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.6 12 20 12 20Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" /></svg>
          </button>
          {#if quickOpen === s.id}
            <div class="quickhp" role="group" aria-label="Change {nameOf(s)}’s hit points" use:quickPane transition:fade={{ duration: 160 }}>
              <!-- No click: the card's own sound follows as its hit points change. -->
              <button class="smallbtn hurt" data-sound="none" onclick={() => quick(s, 'damage')}>Damage</button>
              <input class="numfield" type="number" inputmode="numeric" min="1" placeholder="0" aria-label="Amount for {nameOf(s)}"
                     bind:value={amounts[s.id]} onkeydown={(e) => { if (e.key === 'Enter') quick(s, 'damage'); }} />
              <button class="smallbtn" data-sound="none" onclick={() => quick(s, 'heal')}>Heal</button>
              <button class="smallbtn" data-sound="none" onclick={() => quick(s, 'temp')}>Temp</button>
              <button class="closex" aria-label="Close" onclick={() => (quickOpen = null)}>×</button>
            </div>
          {/if}
        {/if}
      </div>
      <CardHp cur={hp.cur} max={hp.max} temp={hp.temp} vital={v.vital} label={v.label} sounds={def?.sounds ?? {}} />
      <dl class="stats">
        <div><dt>AC</dt><dd>{def ? armorClass(def).total : '—'}</dd></div>
        <!-- In full where the box has room, shortened where it does not. -->
        <div class="perc"><dt><span class="long">Passive Perception</span><span class="short">Passive Perc.</span></dt><dd>{passiveScore(def, 'perception')}</dd></div>
        <div class="ins"><dt><span class="long">Passive Insight</span><span class="short">Passive Ins.</span></dt><dd>{passiveScore(def, 'insight')}</dd></div>
      </dl>
      <!-- Conditions, in their own colors; the card eases to its new height. -->
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
                transition:scale={{ start: 0.8, duration: 220, easing: cubicOut }}>
              {#if isDm && !ended && onlook && !isStandard(c)}
                <!-- One of their own: the DM chooses its color and motion. -->
                <button class="dot tint" class:none={!look} aria-label="Choose how {c} looks" title="Color and motion"
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
                      title="Give a condition" onclick={() => (picking = picking === s.id ? null : s.id)}>
                <!-- Drawn, not typed: a "+" in the font sits above the middle. -->
                <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M6 1.5v9M1.5 6h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
              </button>
            </li>
          {/if}
        </ul>
        {#if picking === s.id}
          <!-- Giving conditions, in a window over the dimmed page so the card
               keeps its size; a new one's color and motion are asked in the
               same window. -->
          <DimModal id="give-{s.id}" title="Conditions for {nameOf(s)}" closer fixed onclose={() => { picking = null; tinting = null; }}>
            <ConditionGiver given={conds} ontoggle={(name) => toggle(s, name)} onadd={(name) => addCustom(s, name)} />
            {#if tinting?.sheet === s.id && has(s.state?.conditions ?? [], tinting.name)}
              <div class="lookin">
                <ConditionLookPicker name={tinting.name} look={lookFor(s, tinting.name)} who={nameOf(s)}
                                     onchange={(patch) => setLook(s, tinting!.name, patch)} ondone={() => (tinting = null)} />
              </div>
            {/if}
          </DimModal>
        {:else if tinting?.sheet === s.id && has(s.state?.conditions ?? [], tinting.name)}
          <!-- A given condition's color and motion, from its dot on the card. -->
          <DimModal id="look-{s.id}" title="{tinting.name} on {nameOf(s)}" onclose={() => (tinting = null)}>
            <ConditionLookPicker name={tinting.name} look={lookFor(s, tinting.name)} who={nameOf(s)}
                                 onchange={(patch) => setLook(s, tinting!.name, patch)} ondone={() => (tinting = null)} />
          </DimModal>
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
      {#if isDm && !ended}
        {#if removing === s.id && !phone.current}
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

<!-- A phone's card has no room for the question beside its buttons: it comes up in a window. -->
{#if phone.current && removing}
  {@const s = cards.find((x) => x.id === removing)}
  {#if s}
    <ConfirmModal title="Take {nameOf(s)} out of the campaign?" message="The character stays with their player, out of any campaign." yes="Remove"
                  onyes={async () => { await onremove(s.id); removing = null; }} onclose={() => (removing = null)} />
  {/if}
{/if}

{#if viewing}
  <Lightbox src={viewing.src} alt={viewing.alt} from={viewing.from} onclose={() => (viewing = null)} />
{/if}

<style>
  .cards {
    list-style: none; padding: 0; margin: 0;
    /* Wide enough for each stat's whole name (Passive Perception). */
    display: grid; grid-template-columns: repeat(auto-fill, minmax(min(25rem, 100%), 1fr)); gap: 0.875rem;
  }
  .card {
    position: relative; border: 1px solid var(--line-soft); border-radius: var(--r); background: var(--surface);
    padding: 0.875rem; display: flex; flex-direction: column;
    transition: border-color 0.3s var(--ease-out), box-shadow 0.3s var(--ease-out);
  }
  .card:hover { border-color: var(--a-edge); }
  /* Hurt shows on the card's edge (app.css .hurtcard); pointed at, a hurt card still shows its own color round it. */
  .card:is(.bloodied, .critical, .down, .dead):hover { border-color: var(--a-edge); }

  /* Dragging: the others slide to make room; the lifted one rides above. */
  .dragging .card { transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.3, 1), border-color 0.3s var(--ease-out); }
  .dragging .card.lifted {
    transition: none; z-index: 3; cursor: grabbing; border-color: var(--a-edge);
    box-shadow: 0 18px 40px -14px rgb(0 0 0 / 0.65);
  }
  .grip {
    position: absolute; top: 0.5rem; right: 0.5rem; width: 1.625rem; height: 1.625rem; padding: 0;
    display: grid; place-items: center; border: 0; border-radius: var(--r-sm); background: none;
    color: var(--faint); cursor: grab; touch-action: none; opacity: 0;
    transition: opacity 0.15s var(--ease-out), color 0.15s var(--ease-out), right 0.2s cubic-bezier(0.33, 1, 0.68, 1);
  }
  .card:hover .grip, .grip:focus-visible, .lifted .grip { opacity: 1; }
  /* Here: a small green light on the portrait's top right corner, ringed in
     the card's color, so nothing in the card moves when it comes and goes. */
  .herebadge {
    position: absolute; top: -0.3125rem; right: -0.3125rem; z-index: 2;
    display: grid; place-items: center; width: 1rem; height: 1rem; border-radius: 50%; background: var(--surface);
  }
  .grip:hover { color: var(--a); }
  @media (hover: none) { .grip { opacity: 0.8; } }

  .cardhead { display: flex; gap: 0.75rem; align-items: center; min-width: 0; padding-right: 3.25rem; }
  .card.sortable .cardhead { padding-right: 4rem; }
  .open { flex: 1; min-width: 0; color: inherit; text-decoration: none; border-radius: var(--r-sm); }
  /* A color swipe: hovered, the character's color runs through the name
     from the left (the text painted with a two-color band that slides). */
  .who strong {
    justify-self: start; color: transparent;
    background-image: linear-gradient(90deg, var(--a) 0 50%, var(--text) 50% 100%);
    background-size: 200% 100%; background-position: 100% 0;
    -webkit-background-clip: text; background-clip: text;
    -webkit-box-decoration-break: clone; box-decoration-break: clone;
    transition: background-position 0.5s cubic-bezier(0.33, 1, 0.68, 1);
  }
  .open:hover strong, .open:focus-visible strong { background-position: 0 0; }
  :global(html[data-motion='reduce']) .who strong { transition: none; }
  .open:focus-visible { outline: 2px solid var(--a); outline-offset: 3px; }
  button.portrait { padding: 0; font: inherit; color: inherit; cursor: zoom-in; transition: border-color 0.35s var(--ease-out), transform 0.15s var(--ease-out); }
  button.portrait:hover { transform: scale(1.04); }
  button.portrait:active { transform: scale(0.98); }
  button.portrait:focus-visible { outline: 2px solid var(--a); outline-offset: 3px; }
  .portrait {
    position: relative; flex: none; width: 3.25rem; height: 3.25rem; border-radius: var(--r-sm);
    border: 1px solid var(--a-edge); background: linear-gradient(150deg, var(--portrait-from), var(--portrait-to));
  }
  .portrait img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
  /* Ringed by conditions (ConditionRing), its own edge steps aside. */
  .portrait { transition: border-color 0.35s var(--ease-out); }
  .portrait.ringed { border-color: transparent; }
  .lvl {
    position: absolute; left: 50%; bottom: -0.4375rem; transform: translateX(-50%); white-space: nowrap;
    font-size: 0.5625rem; font-weight: 700; letter-spacing: 0.06em; padding: 0.0625rem 0.3125rem;
    border-radius: 999px; background: var(--surface); border: 1px solid var(--a-edge); color: var(--a);
  }
  .who { display: grid; min-width: 0; }
  .who strong { font-size: 1.0625rem; overflow-wrap: anywhere; }
  .sub { font-size: 0.8125rem; color: var(--dim); overflow-wrap: anywhere; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.375rem; margin: 0; }
  /* One's own character: a heart at the head's right (left of the DM's × and grip), and the quick
     change it opens over the head itself, the amount between Damage and Heal as on a monster's card,
     so the card keeps its size and its gauge stays in sight. */
  .cardhead { position: relative; }
  .cardhead.mine { padding-right: 0; }
  .card.managed .cardhead.mine { padding-right: 4rem; }
  .hpkey {
    flex: none; width: 2rem; height: 2rem; display: grid; place-items: center; padding: 0; cursor: pointer;
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--raised); color: var(--dim);
    transition: border-color 0.15s var(--ease-out), color 0.15s var(--ease-out), transform 0.08s var(--ease-out);
  }
  .hpkey:hover, .hpkey.on { border-color: var(--a-edge); color: var(--a); }
  .hpkey:active { transform: translateY(1px); }
  .hpkey:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  .quickhp {
    /* Over everything the head shows, past its edges too: the conditions' ring round the portrait
       and the here light on its corner (out to the top and left), and the level badge hanging below.
       The padding keeps the buttons on the head's own line. */
    position: absolute; inset: -0.4375rem -0.4375rem -0.625rem; padding: 0.4375rem 0.4375rem 0.625rem; z-index: 3;
    background: var(--surface); border-radius: var(--r-sm);
    display: grid; grid-template-columns: 1fr 4rem 1fr 1fr auto; gap: 0.375rem; align-items: center;
  }
  .quickhp input {
    min-width: 0; font: inherit; font-size: 0.875rem; padding: 0.3125rem 0.5rem; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  .quickhp input:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; border-color: var(--a-edge); }
  .quickhp .hurt:hover { border-color: color-mix(in oklch, var(--bad) 55%, transparent); color: var(--bad); }
  .stats div { background: var(--raised); border: 1px solid var(--line-soft); border-radius: var(--r-sm); padding: 0.375rem 0.25rem; text-align: center; container-type: inline-size; }
  .stats dt { font-size: 0.5625rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--label); white-space: nowrap; }
  .stats dd { margin: 0.125rem 0 0; font-size: 1.0625rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  /* Pointed at, a stat box lights as the sheet's own boxes do, and its number grows a touch in the
     character's color. */
  .stats div { transition: border-color 0.2s var(--ease-out), background-color 0.2s var(--ease-out); }
  .stats dt, .stats dd { transition: color 0.2s var(--ease-out), transform 0.22s cubic-bezier(0.33, 1, 0.68, 1); }
  .stats div:hover { border-color: var(--a-edge); background: color-mix(in oklab, var(--a) 7%, var(--raised)); }
  .stats div:hover dt { color: var(--a); }
  .stats div:hover dd { color: var(--a-hi, var(--a)); transform: scale(1.08); }
  :global(html[data-motion='reduce']) .stats div:hover dd { transform: none; }
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

  /* A condition's chip in its own color (the tint it gives the player's screen). */
  .conds li:not(.add) {
    --cc: var(--dim);
    display: inline-flex; align-items: center; gap: 0.3125rem;
    font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 999px; color: var(--text);
    border: 1px solid color-mix(in oklab, var(--cc) 60%, var(--line));
    background: color-mix(in oklab, var(--cc) 18%, var(--raised));
  }
  /* Light mode: the same chips in the condition's own color as in dark
     mode; only the dot's ring is a little darker, to show on a light page. */
  :global([data-mode='light']) .dot { box-shadow: 0 0 0 1px color-mix(in oklch, var(--text) 35%, transparent); }
  .dot {
    flex: none; width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--cc, var(--dim));
    box-shadow: 0 0 0 1px color-mix(in oklch, var(--text) 25%, transparent);
  }
  .dot.tint {
    width: 0.6875rem; height: 0.6875rem; padding: 0; border: 0; cursor: pointer;
    transition: transform 0.15s var(--ease-out), box-shadow 0.15s var(--ease-out);
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
    transition: color 0.15s var(--ease-out), border-color 0.15s var(--ease-out), transform 0.2s var(--ease-out);
  }
  .plus:hover { color: var(--a); border-color: var(--a-edge); }
  .plus[aria-expanded='true'] { color: var(--a); border-color: var(--a-edge); transform: rotate(45deg); }

  .lookin { margin-top: 1rem; }
  .lookin :global(.ask) { margin: 0; }

  .x {
    position: absolute; top: 0.5rem; right: 2.25rem; width: 1.625rem; height: 1.625rem; padding: 0;
    display: grid; place-items: center; border: 0; background: none; color: var(--dim); font-size: 1.1rem; cursor: pointer;
    opacity: 0; transition: opacity 0.15s var(--ease-out), color 0.15s var(--ease-out);
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
