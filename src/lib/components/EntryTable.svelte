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
  };

  /** Keep rows in groups, in a fixed order of groups. Within a group the
      list's own order stands, so a row can still be placed by hand. */
  type Grouping<R> = {
    /** The column the groups come from. Its cell is redundant on a card. */
    key: string;
    rank: (item: R) => number;
    title: (rank: number) => string;
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
    groupBy
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
  } = $props();

  const [nameCol, ...rest] = $derived(columns);

  type Row = { item: T; index: number; rank: number };

  /** What is shown, in order. `index` stays the row's place in `items`, so
      every edit and every key refers to the data and not to the screen. */
  const view = $derived.by<Row[]>(() => {
    const rows = items.map((item, index) => ({ item, index, rank: groupBy ? groupBy.rank(item) : 0 }));
    // Array sort is stable, so equal ranks keep the order they were placed in.
    return groupBy ? [...rows].sort((a, b) => a.rank - b.rank) : rows;
  });

  /** One group on its own is just a list; headings only mean something when
      there is more than one to tell apart. */
  const showHeadings = $derived(
    Boolean(groupBy) && view.length > 0 && view.some((r) => r.rank !== view[0].rank)
  );

  const span = $derived(columns.length + (check ? 1 : 0) + (editable ? 1 : 0));

  function patch(index: number, key: string, raw: string, type?: string) {
    const value = type === 'number' ? (raw === '' ? undefined : Number(raw)) : raw;
    onchange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function setFlag(index: number, key: string, value: boolean) {
    onchange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  /** The neighbour a row would trade places with: next on screen, and in the
      same group, since groups are not the reader's to rearrange. */
  function neighbour(pos: number, by: number): Row | null {
    const other = view[pos + by];
    if (!other) return null;
    return !groupBy || other.rank === view[pos].rank ? other : null;
  }

  /** Order is the list's own order, so moving a row is a swap. The rail reads
      the same array, which is why a tracker moves there too. */
  function move(pos: number, by: number) {
    const other = neighbour(pos, by);
    if (!other) return;
    const next = [...items];
    const here = view[pos].index;
    [next[here], next[other.index]] = [next[other.index], next[here]];
    onchange(next);
  }

  const isEmpty = (v: unknown) => v === undefined || v === null || v === '';
  const text = (v: unknown) => (isEmpty(v) ? '—' : String(v));
  const nameOf = (item: T) => String(item[nameCol.key] ?? '');
  const heading = (pos: number): string | null => {
    if (!groupBy || !showHeadings) return null;
    const here = view[pos];
    if (pos > 0 && view[pos - 1].rank === here.rank) return null;
    return groupBy.title(here.rank);
  };
</script>

{#if items.length === 0 && !editable}
  <p class="empty">{emptyText}</p>
{:else}
  <div class="scroller">
    <table class:editing={editable} class:headed={showHeadings}>
      <colgroup>
        {#if check}<col style:width="2.5rem" />{/if}
        {#each columns as col (col.key)}<col style:width={col.width} />{/each}
        {#if editable}<col style:width="5rem" />{/if}
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
        {#each view as { item, index }, pos (index)}
          {@const title = heading(pos)}
          {#if title !== null}
            <tr class="group"><th colspan={span} scope="colgroup">{title}</th></tr>
          {/if}
          <tr>
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
                    value={item[col.key] ?? ''}
                    placeholder={col.placeholder ?? ''}
                    aria-label="{nameOf(item) || `Row ${index + 1}`} {col.label}"
                    onchange={(e) => patch(index, col.key, e.currentTarget.value, col.type)}
                  />
                {:else}{text(item[col.key])}{/if}
              </td>
            {/each}

            {#if editable}
              <td class="rm">
                <button
                  class="mv"
                  disabled={!neighbour(pos, -1)}
                  aria-label="Move {nameOf(item) || `row ${index + 1}`} up"
                  onclick={() => move(pos, -1)}>↑</button
                >
                <button
                  class="mv"
                  disabled={!neighbour(pos, 1)}
                  aria-label="Move {nameOf(item) || `row ${index + 1}`} down"
                  onclick={() => move(pos, 1)}>↓</button
                >
                <button class="x" aria-label="Remove {nameOf(item) || `row ${index + 1}`}"
                        onclick={() => onchange(items.filter((_, n) => n !== index))}>×</button>
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

{#if editable}
  <button class="add" onclick={() => onchange([...items, blank()])}>{addLabel}</button>
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
  .x, .mv {
    background: none; border: 0; color: var(--dim); cursor: pointer;
    font-size: 1rem; padding: 0 0.2rem; line-height: 1;
  }
  .x:hover { color: var(--danger); }
  .mv { font-size: 0.8125rem; }
  .mv:hover:not(:disabled) { color: var(--a); }
  .mv:disabled { opacity: 0.3; cursor: default; }
  /* The tick column is the width of the mark and nothing more. */
  .tick { text-align: center; vertical-align: middle; }
  th.tick { color: var(--label); }
  .tick span.yes { color: var(--a); font-weight: 600; }
  .tick input {
    width: 1rem; height: 1rem; accent-color: var(--a); cursor: pointer;
    display: block; margin: 0 auto;
  }
  .add {
    margin-top: 0.75rem; background: none; border: 1px dashed var(--line);
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
    table.editing .x, table.editing .mv { font-size: 1.125rem; padding: 0.25rem 0.625rem; }
    /* The tick reads as a field of its own here, label and all. */
    table.editing td.tick { text-align: left; }
    /* Under 16px, a phone zooms in when a field takes focus. */
    table.editing input, table.editing select { font-size: 16px; padding: 0.4rem 0.5rem; }
  }
</style>
