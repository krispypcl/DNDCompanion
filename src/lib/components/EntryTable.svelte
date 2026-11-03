<script lang="ts" generics="T extends Record<string, unknown>">
  /**
   * One table for attacks, spells, equipment and features. They were four
   * different shapes — a table, a read-only table, a list and a separate
   * editor — which is why they behaved differently from each other.
   *
   * The layout is fixed and the widths declared, so the columns do not resize
   * when the first row is added to an empty list.
   *
   * On a phone the table stops being a table: each entry is a card, whether
   * reading or editing, so nothing is ever wider than the screen.
   */
  import { flipKey } from '$lib/flip';
  import EntryLink from './EntryLink.svelte';
  import InfoTip from './InfoTip.svelte';
  import { tick, untrack } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion } from '$lib/motion';
  import type { LookupCategory } from '$lib/rules/lookup';

  type Column = {
    key: string;
    label: string;
    /** Shown only while editing. A Source column always is. */
    editOnly?: boolean;
    /** A heading for a column too narrow for its name. The name is still what
        the field is called, and still what a screen reader announces. */
    short?: string;
    /** Required: fixed layout is what stops the headers moving. */
    width: string;
    type?: 'text' | 'number';
    /** A fixed set of values renders as a select rather than a text box. */
    options?: readonly string[];
    placeholder?: string;
    numeric?: boolean;
    /** Reads as secondary. */
    muted?: boolean;
    /** Long prose (notes, a description): takes a full line of its card. */
    wide?: boolean;
    /** When reading, the value is a button if this says it can be pressed
        (an attack's hit or damage, which rolls it). */
    canPress?: (value: unknown) => boolean;
    /** What pressing it does, for the button's accessible name. */
    pressVerb?: string;
    /** How the value reads when not editing ("spell" as "+7"). */
    show?: (value: unknown) => string;
  };

  /** Keep rows in groups, in a fixed order of groups. Within a group the
      list's own order stands, so a row can still be placed by hand. */
  type Grouping<R> = {
    /** The column the groups come from. Its cell is redundant on a card. */
    key: string;
    /** Groups are ordered by rank, then by title; equal rank and title is one group. */
    rank: (item: R) => number;
    title: (item: R) => string;
  };

  let {
    items,
    columns,
    check,
    editable,
    blank,
    onchange,
    category,
    emptyText,
    addLabel,
    groupBy,
    info,
    extra,
    links = true,
    linkOf,
    onpress,
    lit = null,
    spot = null
  }: {
    items: T[];
    columns: Column[];
    /** A tick in the first column, ahead of the name: prepared spells,
        attuned items. With a limit, no more than that many can be ticked. */
    check?: { key: string; label: string; short?: string; limit?: number; full?: string; inline?: boolean };
    editable: boolean;
    blank: () => T;
    onchange: (next: T[]) => void;
    /** 5e.tools category for the name column's lookup link. */
    category: LookupCategory;
    emptyText: string;
    addLabel: string;
    groupBy?: Grouping<T>;
    /** Help for whoever is editing, behind an (i) beside the add button. */
    info?: import('svelte').Snippet;
    /** More controls between the add button and its (i). */
    extra?: import('svelte').Snippet;
    /** 5e.tools links on the names. */
    links?: boolean;
    /** The 5e.tools link for a row, worked out by the list itself (a feature
        from the species links to the species); an override typed on the row wins. */
    linkOf?: (item: T) => string | null;
    /** A row to bring into view and flash: the index of an item, pressed
        somewhere else (a feature picked on the Combat tab). */
    spot?: number | null;
    /** A pressable cell was pressed. */
    onpress?: (key: string, item: T) => void;
    /** A group heading to light up for a moment: a spell level just cast at. */
    lit?: string | null;
  } = $props();

  /** Keys for gliding between reading and editing; see $lib/flip. */
  const tk = flipKey('t');
  const fk = (row: { key: unknown }, col: string) => `${tk}:${String(row.key)}:${col}`;


  /**
   * The column the rows are grouped by is only a column while editing: when
   * reading, the headings already say it. A list grouped by one of its own
   * columns always has headings, reading or editing, even for one group;
   * rows only ever move within their own group.
   */
  const groupedColumn = $derived(Boolean(groupBy && columns.some((c) => c.key === groupBy.key)));
  /** Only while editing: the grouped column, and the book a row comes from
      (reading, the 5e.tools link beside the name already uses it). */
  const editOnly = (c: Column) => c.key === groupBy?.key || c.key === 'source' || Boolean(c.editOnly);
  const shownColumns = $derived(editable ? columns : columns.filter((c) => !editOnly(c)));

  const [nameCol, ...rest] = $derived(shownColumns);

  type Row = { item: T; index: number; key: number; group: string; rank: number; title: string };

  /**
   * A stable key per row, so that removing the second of three rows animates
   * that row away, and a dragged row keeps its identity. The items have no
   * ids of their own; these are kept in step with every change made here,
   * and simply renumbered if the list changes from outside (undo, a reload).
   */
  let keys: number[] = [];
  /** For rows that carry an id: the same key for as long as the row lives. */
  const idKeys = new Map<string, number>();
  let nextKey = 0;
  const fresh = () => nextKey++;

  /** What is shown, in order. `index` stays the row's place in `items`, so
      every edit refers to the data and not to the screen. */
  const view = $derived.by<Row[]>(() => {
    if (keys.length !== items.length) {
      // Changed from outside (a ready-made tracker added or taken away, an
      // undo). Rows with an id keep their key, so only the rows that really
      // came or went animate; without ids, added rows are taken to be new
      // ones at the end.
      const hasIds = items.every((it) => typeof it.id === 'string' && it.id);
      if (hasIds) {
        keys = items.map((it) => {
          const id = it.id as string;
          if (!idKeys.has(id)) idKeys.set(id, fresh());
          return idKeys.get(id)!;
        });
      } else if (items.length > keys.length) {
        keys = [...keys, ...items.slice(keys.length).map(fresh)];
      } else {
        keys = items.map(fresh);
      }
    }
    const rows = items.map((item, index) => {
      const rank = groupBy ? groupBy.rank(item) : 0;
      const title = groupBy ? groupBy.title(item) : '';
      return { item, index, key: keys[index], rank, title, group: `${rank}\u0000${title.toLowerCase()}` };
    });
    if (!groupBy) return rows;
    // Array sort is stable, so within a group the placed order stands.
    return [...rows].sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title));
  });

  /** One group on its own is just a list; headings only mean something when
      there is more than one to tell apart. */
  const showHeadings = $derived(
    Boolean(groupBy) &&
      view.length > 0 &&
      (view.some((r) => r.group !== view[0].group) || groupedColumn)
  );

  /**
   * Columns hidden while reading leave their share to the others, the notes
   * taking a double helping, rather than to the narrow tick column.
   */
  const pct = (w: string) => (/^[\d.]+%$/.test(w) ? parseFloat(w) : null);
  const spare = $derived.by(() => {
    if (editable) return 0;
    const ws = shownColumns.map((c) => pct(c.width));
    if (ws.some((w) => w === null)) return 0;
    return Math.max(0, 100 - ws.reduce<number>((a, w) => a + (w ?? 0), 0));
  });
  const spareTo = $derived(shownColumns.find((c) => c.key === 'notes')?.key ?? null);
  function widthOf(col: Column): string {
    const w = pct(col.width);
    if (!spare || w === null) return col.width;
    const notes = spareTo ? (pct(shownColumns.find((c) => c.key === spareTo)!.width) ?? 0) : 0;
    const weight = col.key === spareTo ? 2 * w : w;
    return `${w + (spare * weight) / (100 - spare + notes)}%`;
  }

  /** An inline tick lives in the name cell, as a toggle, not in a column. */
  const tickColumn = $derived(Boolean(check && !check.inline));
  const span = $derived(shownColumns.length + (tickColumn ? 1 : 0) + (editable ? 2 : 0));

  function patch(index: number, key: string, raw: string, type?: string) {
    const value = type === 'number' ? (raw === '' ? undefined : Number(raw)) : raw;
    onchange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  const ticked = $derived(check ? items.filter((it) => Boolean(it[check.key])).length : 0);
  const full = $derived(check?.limit != null && ticked >= check.limit);

  function setFlag(index: number, key: string, value: boolean) {
    onchange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  async function add() {
    const row = blank();
    const key = fresh();
    if (typeof row.id === 'string' && row.id) idKeys.set(row.id, key);
    const height = scrollBox?.getBoundingClientRect().height;
    keys = [...keys, key];
    onchange([...items, row]);
    // The table eases open to take the new row, so the add button below it
    // slides down rather than jumping.
    await tick();
    easeHeight(height);
  }

  function easeHeight(from: number | undefined) {
    if (!scrollBox || from === undefined || prefersReducedMotion()) return;
    const to = scrollBox.getBoundingClientRect().height;
    if (Math.abs(to - from) < 1) return;
    scrollBox.animate([{ height: `${from}px`, overflow: 'hidden' }, { height: `${to}px`, overflow: 'hidden' }], {
      duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)'
    });
  }

  /**
   * Removing a row by its button: the row (and its group's heading, when it
   * was the last of the group) fades as a copy over where it stood while the
   * rows below glide up into the gap and the table eases to its new height.
   * Left in place to fade, the row held its room and everything under it
   * jumped up when it went.
   */
  let scrollBox = $state<HTMLElement>();
  let quick = false;
  async function remove(index: number) {
    const body = scrollBox?.querySelector('tbody');
    const tableEl = scrollBox?.querySelector('table');
    if (!scrollBox || !body || !tableEl || prefersReducedMotion()) {
      keys = keys.filter((_, n) => n !== index);
      onchange(items.filter((_, n) => n !== index));
      return;
    }
    const rows = Array.from(body.querySelectorAll<HTMLTableRowElement>(':scope > tr'));
    const before = new Map(rows.map((tr) => [tr, tr.getBoundingClientRect()]));
    const height = scrollBox.getBoundingClientRect().height;
    const box = scrollBox.getBoundingClientRect();
    quick = true;
    keys = keys.filter((_, n) => n !== index);
    onchange(items.filter((_, n) => n !== index));
    await tick();
    quick = false;
    const left = new Set(body.querySelectorAll(':scope > tr'));
    for (const tr of rows) {
      if (left.has(tr)) continue;
      const r = before.get(tr)!;
      // A one-row table of the same build, so the copy keeps its columns.
      const copy = tableEl.cloneNode(false) as HTMLTableElement;
      const cols = tableEl.querySelector('colgroup');
      if (cols) copy.appendChild(cols.cloneNode(true));
      const tb = body.cloneNode(false) as HTMLElement;
      tb.appendChild(tr.cloneNode(true));
      copy.appendChild(tb);
      Object.assign(copy.style, {
        position: 'absolute', left: `${r.left - box.left + scrollBox.scrollLeft}px`,
        top: `${r.top - box.top}px`, width: `${tableEl.getBoundingClientRect().width}px`,
        margin: '0', pointerEvents: 'none', minWidth: '0'
      });
      copy.setAttribute('aria-hidden', 'true');
      scrollBox.appendChild(copy);
      const fade = copy.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(0.985)' }], {
        duration: 200, easing: 'cubic-bezier(0.4, 0, 0.7, 0.2)', fill: 'forwards'
      });
      fade.onfinish = () => copy.remove();
    }
    for (const tr of left as Set<HTMLTableRowElement>) {
      const was = before.get(tr);
      if (!was) continue;
      const dy = was.top - tr.getBoundingClientRect().top;
      if (Math.abs(dy) < 0.5) continue;
      tr.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
        duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)'
      });
    }
    easeHeight(height);
  }

  /** The rows of one group, in screen order. */
  const groupRows = (group: string) => view.filter((r) => r.group === group);

  /**
   * Puts the row at `from` (a place within its group) at `to`. The group's
   * slots in the list stay where they are; only who fills them changes, so
   * other groups — and the rail, which reads the same list — are untouched.
   */
  function reorder(group: string, from: number, to: number) {
    const rows = groupRows(group);
    if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return;
    const moved = [...rows];
    const [row] = moved.splice(from, 1);
    moved.splice(to, 0, row);
    const slots = rows.map((r) => r.index).sort((a, b) => a - b);
    const next = [...items];
    const nextKeys = [...keys];
    slots.forEach((slot, i) => {
      next[slot] = moved[i].item;
      nextKeys[slot] = moved[i].key;
    });
    keys = nextKeys;
    onchange(next);
  }

  // ── Dragging ──────────────────────────────────────────────────────────────

  const rowEls: Record<number, HTMLTableRowElement> = $state({});
  const grips: Record<number, HTMLButtonElement> = $state({});

  type Drag = {
    key: number;
    group: string;
    from: number;
    to: number;
    dy: number;
    height: number;
    /** Each row's middle, in page coordinates, in group order. */
    middles: number[];
    keys: number[];
    startY: number;
    pointerId: number;
    clientY: number;
  };
  let drag = $state<Drag | null>(null);
  /** Set for one frame after a drop, so rows land in place without gliding. */
  let landing = $state(false);
  let scroller = 0;

  function grab(event: PointerEvent, row: Row) {
    if (event.button !== 0 || !editable) return;
    const rows = groupRows(row.group);
    if (rows.length < 2) return;
    event.preventDefault();
    const scrollY = window.scrollY;
    const middles = rows.map((r) => {
      const rect = rowEls[r.key]?.getBoundingClientRect();
      return rect ? rect.top + scrollY + rect.height / 2 : 0;
    });
    const from = rows.findIndex((r) => r.key === row.key);
    const rect = rowEls[row.key]?.getBoundingClientRect();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    drag = {
      key: row.key,
      group: row.group,
      from,
      to: from,
      dy: 0,
      height: rect?.height ?? 0,
      middles,
      keys: rows.map((r) => r.key),
      startY: event.clientY + scrollY,
      pointerId: event.pointerId,
      clientY: event.clientY
    };
    cancelAnimationFrame(scroller);
    scroller = requestAnimationFrame(autoscroll);
  }

  function follow(clientY: number) {
    if (!drag) return;
    const dy = clientY + window.scrollY - drag.startY;
    const centre = drag.middles[drag.from] + dy;
    let to = 0;
    drag.middles.forEach((m, i) => {
      if (i !== drag!.from && m < centre) to += 1;
    });
    drag.dy = dy;
    drag.to = to;
    drag.clientY = clientY;
  }

  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    follow(event.clientY);
  }

  /** Near the top or bottom of the window the page scrolls under the row. */
  function autoscroll() {
    if (!drag) return;
    const edge = 72;
    const y = drag.clientY;
    const speed = y < edge ? -(edge - y) / 4 : y > window.innerHeight - edge ? (y - (window.innerHeight - edge)) / 4 : 0;
    if (speed !== 0) {
      window.scrollBy(0, speed);
      follow(y);
    }
    scroller = requestAnimationFrame(autoscroll);
  }

  async function drop(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    cancelAnimationFrame(scroller);
    const { group, from, to } = drag;
    landing = true;
    drag = null;
    reorder(group, from, to);
    await tick();
    requestAnimationFrame(() => (landing = false));
  }

  function cancel() {
    cancelAnimationFrame(scroller);
    drag = null;
  }

  /** How far a row is pushed to make room while another is dragged over it. */
  function offset(key: number): number {
    if (!drag) return 0;
    if (key === drag.key) return drag.dy;
    const i = drag.keys.indexOf(key);
    if (i === -1) return 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.height;
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return drag.height;
    return 0;
  }

  const canMove = (row: Row) => groupRows(row.group).length > 1;

  /** The add button and its (i) open out with edit mode and fold away after it. */
  function unfold(node: HTMLElement) {
    const h = node.offsetHeight;
    const style = getComputedStyle(node);
    const mt = parseFloat(style.marginTop) || 0;
    return {
      duration: prefersReducedMotion() ? 0 : 300,
      easing: cubicOut,
      css: (t: number) =>
        `opacity: ${t}; height: ${t * h}px; margin-top: ${t * mt}px; overflow: hidden; transform: translateY(${(1 - t) * -6}px);`
    };
  }

  /** A text box as tall as what is written in it, growing as it is typed. */
  function autosize(node: HTMLTextAreaElement) {
    const fit = () => {
      node.style.height = 'auto';
      node.style.height = `${node.scrollHeight + 2}px`;
    };
    // At once, so a mode switch measures the row at its real height, and again
    // after layout in case the column was still settling.
    fit();
    requestAnimationFrame(fit);
    node.addEventListener('input', fit);
    // Refit when the column changes width (a mode switch, a phone turning),
    // not when the height it sets itself changes.
    let width = 0;
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(([entry]) => {
            const w = Math.round(entry.contentRect.width);
            if (w !== width) {
              width = w;
              fit();
            }
          })
        : null;
    ro?.observe(node);
    return {
      destroy() {
        node.removeEventListener('input', fit);
        ro?.disconnect();
      }
    };
  }

  // ── A row asked for from elsewhere ────────────────────────────────────────
  let spotted = $state<number | null>(null);
  let spotTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const index = spot;
    if (index === null || index === undefined) return;
    const row = untrack(() => view.find((r) => r.index === index));
    if (!row) return;
    tick().then(() => {
      // The page itself is scrolled, to put the row mid-screen: the row's own
      // scrollIntoView also tried the table's sideways scroller and, on a
      // phone, went nowhere.
      const toRow = () => {
        const el = rowEls[row.key];
        if (!el) return;
        const r = el.getBoundingClientRect();
        // Already comfortably on screen: leave the page where it is.
        if (r.top >= 80 && r.bottom <= window.innerHeight - 40) return;
        const top = window.scrollY + r.top - Math.max(0, (window.innerHeight - r.height) / 2);
        window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      };
      toRow();
      // Again once the tab has finished changing, in case the page was still
      // settling (the old tab fading out, the table growing in) the first time.
      setTimeout(toRow, 420);
      spotted = null;
      requestAnimationFrame(() => (spotted = row.key));
      clearTimeout(spotTimer);
      spotTimer = setTimeout(() => (spotted = null), 1800);
    });
    return () => clearTimeout(spotTimer);
  });

  // ── Rows arriving and leaving ─────────────────────────────────────────────

  function arrive(_node: Element) {
    return {
      duration: prefersReducedMotion() ? 0 : 260,
      easing: cubicOut,
      css: (t: number, u: number) => `opacity: ${t}; transform: translateY(${-8 * u}px);`
    };
  }
  function leave(_node: Element) {
    return {
      // Removed by its button, a copy does the fading (see remove()).
      duration: quick || prefersReducedMotion() ? 0 : 180,
      easing: cubicOut,
      // Fades and settles in place. Moving sideways pushed the row past the
      // table's edge for a moment, and the scroller showed a scrollbar.
      css: (t: number) => `opacity: ${t}; transform: scale(${0.985 + 0.015 * t});`
    };
  }

  const isEmpty = (v: unknown) => v === undefined || v === null || v === '';
  const text = (v: unknown) => (isEmpty(v) ? '—' : String(v));
  const nameOf = (item: T) => String(item[nameCol.key] ?? '');
  const heading = (pos: number): string | null => {
    if (!groupBy || !showHeadings) return null;
    const here = view[pos];
    if (pos > 0 && view[pos - 1].group === here.group) return null;
    return here.title;
  };

</script>

{#if items.length === 0 && !editable}
  <p class="empty">{emptyText}</p>
{:else}
  <div class="scroller" data-flip-size={tk} bind:this={scrollBox}>
    <table class:editing={editable} class:headed={showHeadings} class:dragging={drag !== null} class:landing>
      <colgroup>
        {#if editable}<col style:width="1.75rem" />{/if}
        {#if tickColumn}<col style:width="2rem" />{/if}
        {#each shownColumns as col (col.key)}<col style:width={widthOf(col)} />{/each}
        {#if editable}<col style:width="2rem" />{/if}
      </colgroup>
      <thead>
        <tr>
          {#if editable}<th><span class="sr">Order</span></th>{/if}
          {#if check && tickColumn}<th class="tick" title={check.label}>{check.short ?? check.label}</th>{/if}
          {#each shownColumns as col (col.key)}
            <th title={col.short ? col.label : undefined}
                data-flip-ghost={editOnly(col) ? `${tk}:th:${col.key}` : undefined}>
              <span class="hd" data-flip="{tk}:h:{col.key}">{col.short ?? col.label}</span>
            </th>
          {/each}
          {#if editable}<th><span class="sr">Remove</span></th>{/if}
        </tr>
      </thead>
      <tbody>
        {#each view as row, pos (row.key)}
          {@const { item, index } = row}
          {@const title = heading(pos)}
          {#if title !== null}
            <tr class="group" class:lit={lit === title} in:arrive out:leave><th colspan={span} scope="colgroup"><span data-flip="{tk}:g:{title}">{title}</span></th></tr>
          {/if}
          <tr bind:this={rowEls[row.key]} in:arrive out:leave class:spotted={spotted === row.key}
              class:lifted={drag?.key === row.key}
              style:transform={drag ? `translateY(${offset(row.key)}px)` : undefined}>
            <!-- The handle leads the row: the remove button holds the other end. -->
            {#if editable}
              <td class="gripcell">
                <button
                  bind:this={grips[row.key]}
                  class="grip"
                  disabled={!canMove(row)}
                  aria-label="Drag to reorder {nameOf(item) || `row ${index + 1}`}"
                  title="Drag to reorder"
                  onpointerdown={(e) => grab(e, row)}
                  onpointermove={move}
                  onpointerup={drop}
                  onpointercancel={cancel}
                >
                  <svg viewBox="0 0 12 18" width="10" height="15" aria-hidden="true">
                    {#each [3, 9, 15] as y (y)}
                      <circle cx="3" cy={y} r="1.5" fill="currentColor" /><circle cx="9" cy={y} r="1.5" fill="currentColor" />
                    {/each}
                  </svg>
                </button>
              </td>
            {/if}
            {#if check && tickColumn}
              <td class="tick" data-label={check.label} data-empty={!editable && !item[check.key] ? '' : undefined}>
                {#if editable}
                  <input
                    type="checkbox"
                    data-flip={fk(row, '?')}
                    checked={Boolean(item[check.key])}
                    disabled={full && !item[check.key]}
                    title={full && !item[check.key] ? check.full : undefined}
                    aria-label="{nameOf(item) || `Row ${index + 1}`} {check.label.toLowerCase()}"
                    onchange={(e) => setFlag(index, check.key, e.currentTarget.checked)}
                  />
                {:else}
                  <span class="yes" data-flip={fk(row, '?')} aria-label={check.label}>{item[check.key] ? '✓' : ''}</span>
                {/if}
              </td>
            {/if}
            <td class="name" data-label={nameCol.label}>
              {#if editable}
                <div class="nameedit">
                  <input
                    data-flip={fk(row, nameCol.key)}
                    value={nameOf(item)}
                    placeholder={nameCol.placeholder ?? ''}
                    aria-label="{nameCol.label} {index + 1}"
                    onchange={(e) => patch(index, nameCol.key, e.currentTarget.value)}
                  />
                  {#if check?.inline}
                    {@const on = Boolean(item[check.key])}
                    <button class="toggle" class:on aria-pressed={on}
                            disabled={full && !on}
                            aria-label="{nameOf(item) || `Row ${index + 1}`} {check.label.toLowerCase()}"
                            title={full && !on ? check.full : on ? `${check.label} · press to undo` : check.label}
                            onclick={() => setFlag(index, check.key, !on)}>
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                        <path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z"
                              stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
                      </svg>
                    </button>
                  {/if}
                </div>
              {:else}
                <span class="nm" data-flip={fk(row, nameCol.key)}>{text(item[nameCol.key])}</span>
                {#if links}<EntryLink
                  name={nameOf(item)}
                  source={item.source as string | undefined}
                  {category}
                  override={(item.lookupUrl as string | undefined) || linkOf?.(item) || undefined}
                />{/if}
              {/if}
            </td>

            {#each rest as col (col.key)}
              <td data-label={col.label} class:muted={col.muted} class:numeric={col.numeric}
                  data-flip-ghost={editOnly(col) ? fk(row, `g:${col.key}`) : undefined}
                  class:wide={col.wide} class:grouped={groupBy?.key === col.key}
                  data-empty={!editable && isEmpty(item[col.key]) ? '' : undefined}>
                {#if editable && col.options}
                  <select
                    data-flip={fk(row, col.key)}
                    value={String(item[col.key] ?? col.options[0])}
                    aria-label="{nameOf(item) || `Row ${index + 1}`} {col.label}"
                    onchange={(e) => patch(index, col.key, e.currentTarget.value)}
                  >
                    {#each col.options as option (option)}<option>{option}</option>{/each}
                  </select>
                {:else if editable && col.wide}
                  <!-- Long writing (a description, notes): grows to show all of it,
                       and the row grows with it. -->
                  <textarea
                    data-flip={fk(row, col.key)}
                    rows="1"
                    use:autosize
                    value={String(item[col.key] ?? '')}
                    placeholder={col.placeholder ?? ''}
                    aria-label="{nameOf(item) || `Row ${index + 1}`} {col.label}"
                    onchange={(e) => patch(index, col.key, e.currentTarget.value, col.type)}
                  ></textarea>
                {:else if editable}
                  <input
                    data-flip={fk(row, col.key)}
                    type={col.type === 'number' ? 'number' : 'text'}
                    value={item[col.key] ?? ''}
                    placeholder={col.placeholder ?? ''}
                    aria-label="{nameOf(item) || `Row ${index + 1}`} {col.label}"
                    onchange={(e) => patch(index, col.key, e.currentTarget.value, col.type)}
                  />
                {:else if onpress && col.canPress?.(item[col.key])}
                  <button class="press" data-flip={fk(row, col.key)} onclick={() => onpress(col.key, item)}
                          aria-label="{col.pressVerb ?? 'Use'} {nameOf(item)} {col.label.toLowerCase()} {text(item[col.key])}"
                          title="{col.pressVerb ?? 'Use'} {text(item[col.key])}">{col.show ? col.show(item[col.key]) : text(item[col.key])}</button>
                {:else}<span class="cell" data-flip={fk(row, col.key)}>{col.show && item[col.key] ? col.show(item[col.key]) : text(item[col.key])}</span>{/if}
              </td>
            {/each}

            {#if editable}
              <td class="rm">
                <button class="x" aria-label="Remove {nameOf(item) || `row ${index + 1}`}"
                        onclick={() => remove(index)}>×</button>
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

{#if editable}
  <div class="addrow" transition:unfold>
    <button class="add" onclick={add}>{addLabel}</button>
    {@render extra?.()}
    {#if info}<InfoTip label="About {addLabel.toLowerCase().replace(/^add /, '')}">{@render info()}</InfoTip>{/if}
  </div>
{/if}

<style>
  .scroller { overflow-x: auto; position: relative; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
    /* Columns keep their declared width whether or not there are rows. */
    table-layout: fixed;
    min-width: 34rem;
  }
  th {
    text-align: left;
    /* Fixed columns do not grow for a long heading, so it wraps — between
       words, never inside one ("RANG E"). */
    overflow-wrap: normal; word-break: keep-all;
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--label);
    font-weight: 600;
    padding: 0 0.5rem 0.35rem 0;
    border-bottom: 1px solid var(--line);
  }
  /* Inline boxes cannot be moved, so the words that glide are blocks. */
  .cell, .nm, .hd, tr.group th > span { display: inline-block; max-width: 100%; }
  td {
    padding: 0.4rem 0.5rem 0.4rem 0;
    border-bottom: 1px solid var(--line-soft);
    vertical-align: top;
    overflow-wrap: anywhere;
    /* A squeezed column breaks a word with a hyphen, not mid-letter. */
    hyphens: auto;
  }
  tr:last-child td { border-bottom: 0; }
  /* A heading for the rows under it: spells by level. Quiet, and accent
     coloured so the eye finds the breaks without a rule between them. */
  tr.group th {
    padding: 0.875rem 0 0.3125rem;
    color: var(--a);
    letter-spacing: 0.12em;
    border-bottom: 1px solid var(--a-edge);
  }
  tr.group:first-child th { padding-top: 0.25rem; }
  .name { font-weight: 600; }
  /* A value that rolls: it reads as the number, with a hint of a button. */
  .press {
    font: inherit; color: inherit; background: none; cursor: pointer;
    border: 1px dashed transparent; border-radius: var(--r-sm);
    padding: 0 0.3rem; margin: 0 -0.3rem; text-align: inherit;
    transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
  }
  .press:hover { border-color: var(--a-edge); color: var(--a); background: var(--a-wash); }
  .press:active { transform: translateY(1px); }
  @media (hover: none) { .press { border-color: var(--line); } }
  .nm { overflow-wrap: anywhere; }
  /* A slot of this level was just spent: the heading flares. */
  tr.group.lit th { animation: castFlare 1.5s ease-out; }
  /* A row brought here from elsewhere: a wash of the accent that fades. */
  tr.spotted > td { animation: spotted 1.8s ease-out; }
  @keyframes spotted {
    0%, 25% { background-color: var(--a-wash); box-shadow: inset 0 0 0 9999px color-mix(in oklch, var(--a) 8%, transparent); }
    100% { background-color: transparent; box-shadow: none; }
  }
  /* On a phone a row is a card: the card's edge lights as well. */
  tr.spotted { animation: spotRing 1.8s ease-out; }
  @keyframes spotRing {
    0%, 25% { outline: 2px solid var(--a-edge); outline-offset: 2px; }
    100% { outline: 2px solid transparent; outline-offset: 2px; }
  }
  @media (prefers-reduced-motion: reduce) { tr.spotted > td, tr.spotted { animation-duration: 0.01s; } }
  @keyframes castFlare {
    0% { color: var(--label); text-shadow: none; }
    18% { color: var(--a-hi); text-shadow: 0 0 12px color-mix(in oklch, var(--a) 70%, transparent); }
    100% { color: var(--label); text-shadow: none; }
  }
  .nameedit { display: flex; align-items: center; gap: 0.25rem; }
  .nameedit input { flex: 1 1 auto; min-width: 0; }
  /* The inline tick: a small sparkle that fills when on. */
  .toggle {
    flex: none; width: 1.75rem; height: 1.75rem; padding: 0; display: grid; place-items: center;
    background: none; border: 1px solid var(--line); border-radius: var(--r-sm); color: var(--faint);
    cursor: pointer; transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease;
  }
  .toggle svg { fill: none; transition: fill 0.2s ease, transform 0.25s cubic-bezier(0.3, 1.6, 0.5, 1); }
  .toggle:hover:not(:disabled) { color: var(--a); border-color: var(--a-edge); }
  .toggle.on { color: var(--a); border-color: var(--a-edge); background: var(--a-wash); }
  .toggle.on svg { fill: currentColor; transform: rotate(45deg); }
  .toggle:disabled { opacity: 0.35; cursor: not-allowed; }
  .muted { color: var(--dim); font-size: 0.85rem; }
  .numeric { font-variant-numeric: tabular-nums; }
  /* Centred on the row rather than aligned with the first line of text. */
  .rm { padding-right: 0; vertical-align: middle; }
  input, select, textarea {
    background: var(--bg); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); padding: 0.2rem 0.35rem; font: inherit;
    font-size: 0.875rem; width: 100%; min-width: 0; box-sizing: border-box;
    transition: border-color 0.15s ease;
  }
  textarea { display: block; resize: none; overflow: hidden; line-height: 1.4; }
  /* Long writing keeps the lines it was written in. */
  td.wide .cell { white-space: pre-line; }
  input:hover, select:hover, textarea:hover { border-color: var(--a-edge); }
  .editing input:not([type='checkbox']), .editing select, .editing textarea { animation: fieldIn 0.32s ease; }
  @keyframes fieldIn {
    from { border-color: transparent; background-color: transparent; }
  }
  input::placeholder, textarea::placeholder { color: var(--dim); opacity: 0.6; }
  input[type='number'] { -moz-appearance: textfield; appearance: textfield; }
  input[type='number']::-webkit-outer-spin-button,
  input[type='number']::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .x, .grip {
    background: none; border: 0; color: var(--dim); cursor: pointer;
    font-size: 1rem; padding: 0.125rem 0.3rem; line-height: 1; border-radius: var(--r-sm);
    transition: color 0.15s ease, background-color 0.15s ease;
  }
  .x:hover { color: var(--danger); }
  /* The handle: grabbed, not clicked, so the page must not scroll under a
     finger dragging it. */
  .gripcell { padding-right: 0.25rem; vertical-align: middle; }
  .grip { cursor: grab; touch-action: none; display: inline-grid; place-items: center; vertical-align: middle; }
  .grip:hover:not(:disabled) { color: var(--a); background: var(--a-wash); }
  .grip:disabled { opacity: 0.3; cursor: default; }
  .dragging, .dragging * { cursor: grabbing !important; user-select: none; }
  /* While one row is dragged, the others glide aside to make room. */
  .dragging tbody tr:not(.lifted) { transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.3, 1); }
  .landing tbody tr { transition: none !important; }
  tr.lifted {
    position: relative; z-index: 2;
    background: var(--raised);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.3), 0 0 0 1px var(--a-edge);
  }

  /* The tick column is the width of the mark and nothing more. */
  .tick { text-align: left; vertical-align: middle; }
  th.tick { color: var(--label); }
  .tick span.yes { color: var(--a); font-weight: 600; }
  .tick input {
    width: 1rem; height: 1rem; accent-color: var(--a); cursor: pointer;
    display: block; margin: 0 auto;
  }
  .addrow { display: flex; align-items: center; gap: 0.375rem; margin-top: 0.75rem; }
  /* The handles and remove buttons come in with edit mode rather than popping. */
  .grip, .x, .toggle { animation: handleIn 0.32s cubic-bezier(0.2, 0.8, 0.3, 1) backwards; }
  @keyframes handleIn { from { opacity: 0; transform: scale(0.6); } }
  .add { background: none; border: 1px dashed var(--line);
    color: var(--dim); border-radius: var(--r-sm); padding: 0.4rem 0.9rem;
    font: inherit; font-size: 0.85rem; cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .add:hover { border-color: var(--a-edge); color: var(--a); }
  .empty { color: var(--dim); margin: 0; }
  .sr {
    position: absolute; width: 1px; height: 1px; overflow: hidden;
    clip-path: inset(50%); white-space: nowrap;
  }

  @media (max-width: 700px) {
    /* Reading, an entry is a card: the name on top, the facts under it in a
       grid with their labels, the prose on a line of its own. Anything blank
       is left out rather than shown as a dash. */
    table:not(.editing) { min-width: 0; }

    table:not(.editing),
    table:not(.editing) tbody,
    table:not(.editing) tr,
    table:not(.editing) td,
    table:not(.editing) tr.group th { display: block; width: auto; min-width: 0; }
    table:not(.editing) { border-collapse: separate; }
    table:not(.editing) thead,
    table:not(.editing) colgroup { display: none; }

    table:not(.editing) tr:not(.group) {
      position: relative;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(5.25rem, 1fr));
      gap: 0.4375rem 0.75rem;
      border: 1px solid var(--line-soft);
      background: var(--raised);
      border-radius: var(--r);
      padding: 0.6875rem 0.8125rem 0.75rem;
      margin-bottom: 0.5rem;
    }
    table:not(.editing) td { border: 0; padding: 0; }
    table:not(.editing) td[data-empty],
    table.headed:not(.editing) td.grouped { display: none; }
    table:not(.editing) td.name,
    table:not(.editing) td.wide { grid-column: 1 / -1; }
    table:not(.editing) td.name {
      font-size: 1rem;
      display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap;
      /* Room for the badge in the corner. */
      padding-right: 4.5rem;
    }
    table:not(.editing) td.name::before { content: none; }
    table:not(.editing) td::before {
      content: attr(data-label);
      display: block;
      font-size: 0.5875rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--label);
      font-weight: 600;
      margin-bottom: 0.0625rem;
    }
    table:not(.editing) td.wide { color: var(--dim); font-size: 0.875rem; line-height: 1.5; }
    table:not(.editing) td.wide.muted { font-size: 0.875rem; }
    /* The tick becomes a badge in the card's corner. */
    table:not(.editing) td.tick {
      position: absolute; top: 0.6875rem; right: 0.8125rem; text-align: right;
    }
    table:not(.editing) td.tick::before { content: none; }
    table:not(.editing) td.tick .yes::after {
      content: ' Prepared';
      font-size: 0.625rem; letter-spacing: 0.08em; text-transform: uppercase;
    }
    /* Always visible on a touch screen, where there is no hover to find it. */
    table:not(.editing) tr.group { margin: 0.75rem 0 0.5rem; }
    table:not(.editing) tr.group:first-child { margin-top: 0; }
    table:not(.editing) tr.group th { padding: 0 0 0.25rem; }

    /* Editing, the table stops being a table. Six columns of inputs in 390px
       is what made the whole page shrink to fit: the browser zooms out rather
       than scroll, and the sheet arrives misaligned. Each entry becomes a
       card instead, one labelled field per line, nothing wider than the
       screen. */
    table.editing,
    table.editing tbody,
    table.editing tr,
    table.editing td,
    table.editing tr.group th { display: block; width: auto; min-width: 0; }
    table.editing { border-collapse: separate; }
    table.editing thead,
    table.editing colgroup { display: none; }
    table.editing tr:not(.group) {
      border: 1px solid var(--line-soft);
      border-radius: var(--r);
      padding: 0.625rem 0.75rem 0.5rem;
      margin-bottom: 0.625rem;
    }
    table.editing tr.group { margin: 0.75rem 0 0.5rem; }
    table.editing tr.group:first-child { margin-top: 0; }
    table.editing tr.group th { padding: 0 0 0.25rem; }
    table.editing td { border: 0; padding: 0.3125rem 0 0; }
    table.editing td::before {
      content: attr(data-label);
      display: block;
      font-size: 0.625rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--label);
      font-weight: 600;
      margin-bottom: 0.1875rem;
    }
    table.editing td.name { padding-top: 0; }
    /* Order and remove sit together at the foot of the card, where three
       buttons fit without crowding the first field. */
    table.editing td.rm {
      display: flex;
      justify-content: flex-end;
      gap: 0.25rem;
      padding-top: 0.5rem;
      margin-top: 0.375rem;
      border-top: 1px solid var(--line-soft);
    }
    table.editing td.rm::before { content: none; }
    table.editing .x, table.editing .grip { font-size: 1.125rem; padding: 0.375rem 0.75rem; }
    /* On a card the handle sits in the footer's left corner, across from
       remove in the right. */
    table.editing tr:not(.group) { position: relative; }
    table.editing td.gripcell {
      position: absolute; left: 0.25rem; bottom: 0.5rem; padding: 0;
    }
    table.editing td.gripcell::before { content: none; }
    /* The tick reads as a field of its own here, label and all. */
    table.editing td.tick { text-align: left; }
    /* Under 16px, a phone zooms in when a field takes focus. */
    table.editing input, table.editing select { font-size: 16px; padding: 0.4rem 0.5rem; }
  }
</style>
