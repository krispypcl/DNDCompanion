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
  import EntryLink from './EntryLink.svelte';
  import InfoTip from './InfoTip.svelte';
  import { tick } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion } from '$lib/motion';
  import type { LookupCategory } from '$lib/rules/lookup';

  type Column = {
    key: string;
    label: string;
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
    /** Values offered as you type. Anything else may still be written. */
    suggest?: readonly string[];
    /** How a value reads when not editing. */
    format?: (value: unknown) => string;
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
    info
  }: {
    items: T[];
    columns: Column[];
    /** A tick in the first column, ahead of the name: prepared spells. */
    check?: { key: string; label: string; short?: string };
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
  } = $props();

  const uid = Math.random().toString(36).slice(2, 8);

  const [nameCol, ...rest] = $derived(columns);

  type Row = { item: T; index: number; key: number; group: string; rank: number; title: string };

  /**
   * A stable key per row, so that removing the second of three rows animates
   * that row away, and a dragged row keeps its identity. The items have no
   * ids of their own; these are kept in step with every change made here,
   * and simply renumbered if the list changes from outside (undo, a reload).
   */
  let keys: number[] = [];
  let nextKey = 0;
  const fresh = () => nextKey++;

  /** What is shown, in order. `index` stays the row's place in `items`, so
      every edit refers to the data and not to the screen. */
  const view = $derived.by<Row[]>(() => {
    if (keys.length !== items.length) keys = items.map(fresh);
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
    Boolean(groupBy) && view.length > 0 && view.some((r) => r.group !== view[0].group)
  );

  const span = $derived(columns.length + (check ? 1 : 0) + (editable ? 1 : 0));

  function patch(index: number, key: string, raw: string, type?: string) {
    const value = type === 'number' ? (raw === '' ? undefined : Number(raw)) : raw;
    onchange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function setFlag(index: number, key: string, value: boolean) {
    onchange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function add() {
    keys = [...keys, fresh()];
    onchange([...items, blank()]);
  }

  function remove(index: number) {
    keys = keys.filter((_, n) => n !== index);
    onchange(items.filter((_, n) => n !== index));
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

  const rowEls: Record<number, HTMLTableRowElement> = {};
  const grips: Record<number, HTMLButtonElement> = {};

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

  /** The grip also answers the arrow keys, one place at a time. */
  async function nudge(event: KeyboardEvent, row: Row) {
    const by = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (!by) return;
    event.preventDefault();
    const rows = groupRows(row.group);
    const from = rows.findIndex((r) => r.key === row.key);
    reorder(row.group, from, from + by);
    await tick();
    grips[row.key]?.focus();
  }

  const canMove = (row: Row) => groupRows(row.group).length > 1;

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
      duration: prefersReducedMotion() ? 0 : 180,
      easing: cubicOut,
      css: (t: number, u: number) => `opacity: ${t}; transform: translateX(${16 * u}px);`
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
  const shown = (col: Column, v: unknown) => (col.format && !isEmpty(v) ? col.format(v) : text(v));
</script>

{#if items.length === 0 && !editable}
  <p class="empty">{emptyText}</p>
{:else}
  <div class="scroller">
    <table class:editing={editable} class:headed={showHeadings} class:dragging={drag !== null} class:landing>
      <colgroup>
        {#if check}<col style:width="2.5rem" />{/if}
        {#each columns as col (col.key)}<col style:width={col.width} />{/each}
        {#if editable}<col style:width="4.25rem" />{/if}
      </colgroup>
      <thead>
        <tr>
          {#if check}<th class="tick" title={check.label}>{check.short ?? check.label}</th>{/if}
          {#each columns as col (col.key)}
            <th title={col.short ? col.label : undefined}>
              {col.short ?? col.label}
            </th>
          {/each}
          {#if editable}<th><span class="sr">Order and remove</span></th>{/if}
        </tr>
      </thead>
      <tbody>
        {#each view as row, pos (row.key)}
          {@const { item, index } = row}
          {@const title = heading(pos)}
          {#if title !== null}
            <tr class="group"><th colspan={span} scope="colgroup">{title}</th></tr>
          {/if}
          <tr bind:this={rowEls[row.key]} in:arrive out:leave
              class:lifted={drag?.key === row.key}
              style:transform={drag ? `translateY(${offset(row.key)}px)` : undefined}>
            {#if check}
              <td class="tick" data-label={check.label} data-empty={!editable && !item[check.key] ? '' : undefined}>
                {#if editable}
                  <input
                    type="checkbox"
                    checked={Boolean(item[check.key])}
                    aria-label="{nameOf(item) || `Row ${index + 1}`} {check.label.toLowerCase()}"
                    onchange={(e) => setFlag(index, check.key, e.currentTarget.checked)}
                  />
                {:else}
                  <span class="yes" aria-label={check.label}>{item[check.key] ? '✓' : ''}</span>
                {/if}
              </td>
            {/if}
            <td class="name" data-label={nameCol.label}>
              {#if editable}
                <input
                  value={nameOf(item)}
                  placeholder={nameCol.placeholder ?? ''}
                  aria-label="{nameCol.label} {index + 1}"
                  onchange={(e) => patch(index, nameCol.key, e.currentTarget.value)}
                />
              {:else}
                <span class="nm">{text(item[nameCol.key])}</span>
                <EntryLink
                  name={nameOf(item)}
                  source={item.source as string | undefined}
                  {category}
                  override={item.lookupUrl as string | undefined}
                />
              {/if}
            </td>

            {#each rest as col (col.key)}
              <td data-label={col.label} class:muted={col.muted} class:numeric={col.numeric}
                  class:wide={col.wide} class:grouped={groupBy?.key === col.key}
                  data-empty={!editable && isEmpty(item[col.key]) ? '' : undefined}>
                {#if editable && col.options}
                  <select
                    value={String(item[col.key] ?? col.options[0])}
                    aria-label="{nameOf(item) || `Row ${index + 1}`} {col.label}"
                    onchange={(e) => patch(index, col.key, e.currentTarget.value)}
                  >
                    {#each col.options as option (option)}<option>{option}</option>{/each}
                  </select>
                {:else if editable}
                  <input
                    type={col.type === 'number' ? 'number' : 'text'}
                    value={col.format && !isEmpty(item[col.key]) ? col.format(item[col.key]) : (item[col.key] ?? '')}
                    list={col.suggest ? `${uid}-${col.key}` : undefined}
                    placeholder={col.placeholder ?? ''}
                    aria-label="{nameOf(item) || `Row ${index + 1}`} {col.label}"
                    onchange={(e) => patch(index, col.key, e.currentTarget.value, col.type)}
                  />
                {:else}{shown(col, item[col.key])}{/if}
              </td>
            {/each}

            {#if editable}
              <td class="rm">
                <button
                  bind:this={grips[row.key]}
                  class="grip"
                  disabled={!canMove(row)}
                  aria-label="Reorder {nameOf(item) || `row ${index + 1}`}. Drag, or use the arrow keys."
                  title="Drag to reorder"
                  onpointerdown={(e) => grab(e, row)}
                  onpointermove={move}
                  onpointerup={drop}
                  onpointercancel={cancel}
                  onkeydown={(e) => nudge(e, row)}
                >
                  <svg viewBox="0 0 12 18" width="10" height="15" aria-hidden="true">
                    {#each [3, 9, 15] as y (y)}
                      <circle cx="3" cy={y} r="1.5" fill="currentColor" /><circle cx="9" cy={y} r="1.5" fill="currentColor" />
                    {/each}
                  </svg>
                </button>
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
  {#each columns.filter((c) => c.suggest) as col (col.key)}
    <datalist id="{uid}-{col.key}">
      {#each col.suggest ?? [] as option (option)}<option value={option}></option>{/each}
    </datalist>
  {/each}
  <div class="addrow">
    <button class="add" onclick={add}>{addLabel}</button>
    {#if info}<InfoTip label="About {addLabel.toLowerCase().replace(/^add /, '')}">{@render info()}</InfoTip>{/if}
  </div>
{/if}

<style>
  .scroller { overflow-x: auto; }
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
    /* Fixed columns do not grow for a long heading, so it wraps rather than
       running into the next one. */
    overflow-wrap: anywhere;
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--label);
    font-weight: 600;
    padding: 0 0.5rem 0.35rem 0;
    border-bottom: 1px solid var(--line);
  }
  td {
    padding: 0.4rem 0.5rem 0.4rem 0;
    border-bottom: 1px solid var(--line-soft);
    vertical-align: top;
    overflow-wrap: anywhere;
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
  .nm { overflow-wrap: anywhere; }
  .muted { color: var(--dim); font-size: 0.85rem; }
  .numeric { font-variant-numeric: tabular-nums; }
  /* Centred on the row rather than aligned with the first line of text. */
  .rm { padding-right: 0; vertical-align: middle; }
  input, select {
    background: var(--bg); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); padding: 0.2rem 0.35rem; font: inherit;
    font-size: 0.875rem; width: 100%; min-width: 0; box-sizing: border-box;
    transition: border-color 0.15s ease;
  }
  input:hover, select:hover { border-color: var(--a-edge); }
  input::placeholder { color: var(--dim); opacity: 0.6; }
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
  input::-webkit-calendar-picker-indicator { display: none !important; }
  input::-webkit-list-button { display: none !important; }
  /* The tick column is the width of the mark and nothing more. */
  .tick { text-align: center; vertical-align: middle; }
  th.tick { color: var(--label); }
  .tick span.yes { color: var(--a); font-weight: 600; }
  .tick input {
    width: 1rem; height: 1rem; accent-color: var(--a); cursor: pointer;
    display: block; margin: 0 auto;
  }
  .addrow { display: flex; align-items: center; gap: 0.375rem; margin-top: 0.75rem; }
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
    table.editing td.rm { justify-content: space-between; }
    /* The tick reads as a field of its own here, label and all. */
    table.editing td.tick { text-align: left; }
    /* Under 16px, a phone zooms in when a field takes focus. */
    table.editing input, table.editing select { font-size: 16px; padding: 0.4rem 0.5rem; }
  }
</style>
