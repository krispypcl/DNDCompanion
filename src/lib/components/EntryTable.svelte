<script lang="ts" generics="T extends Record<string, unknown>">
  /**
   * One table for attacks, spells, equipment and features. They were four
   * different shapes — a table, a read-only table, a list and a separate
   * editor — which is why they behaved differently from each other.
   *
   * The layout is fixed and the widths declared, so the columns do not resize
   * when the first row is added to an empty list.
   */
  import EntryLink from './EntryLink.svelte';
  import type { LookupCategory } from '$lib/rules/lookup';

  type Column = {
    key: string;
    label: string;
    /** Required: fixed layout is what stops the headers moving. */
    width: string;
    type?: 'text' | 'number';
    /** A fixed set of values renders as a select rather than a text box. */
    options?: readonly string[];
    placeholder?: string;
    numeric?: boolean;
    /** Reads as secondary, and folds under the name on a narrow screen. */
    muted?: boolean;
  };

  let {
    items,
    columns,
    editable,
    blank,
    onchange,
    category,
    emptyText,
    addLabel
  }: {
    items: T[];
    columns: Column[];
    editable: boolean;
    blank: () => T;
    onchange: (next: T[]) => void;
    /** 5e.tools category for the name column's lookup link. */
    category: LookupCategory;
    emptyText: string;
    addLabel: string;
  } = $props();

  const [nameCol, ...rest] = $derived(columns);
  const folded = $derived(rest.find((c) => c.muted));

  function patch(index: number, key: string, raw: string, type?: string) {
    const value = type === 'number' ? (raw === '' ? undefined : Number(raw)) : raw;
    onchange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  const text = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : String(v));
  const nameOf = (item: T) => String(item[nameCol.key] ?? '');
</script>

{#if items.length === 0 && !editable}
  <p class="empty">{emptyText}</p>
{:else}
  <div class="scroller">
    <table class:editing={editable}>
      <colgroup>
        {#each columns as col (col.key)}<col style:width={col.width} />{/each}
        {#if editable}<col style:width="2.25rem" />{/if}
      </colgroup>
      <thead>
        <tr>
          {#each columns as col (col.key)}
            <th class:fold={col.muted}>{col.label}</th>
          {/each}
          {#if editable}<th><span class="sr">Remove</span></th>{/if}
        </tr>
      </thead>
      <tbody>
        {#each items as item, i (i)}
          <tr>
            <td class="name" data-label={nameCol.label}>
              {#if editable}
                <input
                  value={nameOf(item)}
                  placeholder={nameCol.placeholder ?? ''}
                  aria-label="{nameCol.label} {i + 1}"
                  onchange={(e) => patch(i, nameCol.key, e.currentTarget.value)}
                />
              {:else}
                <span class="nm">{text(item[nameCol.key])}</span>
                <EntryLink
                  name={nameOf(item)}
                  source={item.source as string | undefined}
                  {category}
                  override={item.lookupUrl as string | undefined}
                />
                {#if folded && item[folded.key]}
                  <span class="fold-under">{item[folded.key]}</span>
                {/if}
              {/if}
            </td>

            {#each rest as col (col.key)}
              <td data-label={col.label} class:muted={col.muted} class:numeric={col.numeric}
                  class:fold={col.muted}>
                {#if editable && col.options}
                  <select
                    value={String(item[col.key] ?? col.options[0])}
                    aria-label="{nameOf(item) || `Row ${i + 1}`} {col.label}"
                    onchange={(e) => patch(i, col.key, e.currentTarget.value)}
                  >
                    {#each col.options as option (option)}<option>{option}</option>{/each}
                  </select>
                {:else if editable}
                  <input
                    type={col.type === 'number' ? 'number' : 'text'}
                    value={item[col.key] ?? ''}
                    placeholder={col.placeholder ?? ''}
                    aria-label="{nameOf(item) || `Row ${i + 1}`} {col.label}"
                    onchange={(e) => patch(i, col.key, e.currentTarget.value, col.type)}
                  />
                {:else}{text(item[col.key])}{/if}
              </td>
            {/each}

            {#if editable}
              <td class="rm">
                <button class="x" aria-label="Remove {nameOf(item) || `row ${i + 1}`}"
                        onclick={() => onchange(items.filter((_, n) => n !== i))}>×</button>
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
  .x {
    background: none; border: 0; color: var(--dim); cursor: pointer;
    font-size: 1rem; padding: 0 0.2rem; line-height: 1;
  }
  .x:hover { color: var(--danger); }
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
  .fold-under { display: none; font-size: 0.78rem; color: var(--dim); font-weight: 400; }
  @media (max-width: 700px) {
    /* Read-only, the secondary column folds under the name. */
    table:not(.editing) { min-width: 0; }
    table:not(.editing) .fold { display: none; }
    table:not(.editing) .fold-under { display: block; margin-top: 0.15rem; }

    /* Editing, the table stops being a table. Six columns of inputs in 390px
       is what made the whole page shrink to fit: the browser zooms out rather
       than scroll, and the sheet arrives misaligned. Each entry becomes a
       card instead, one labelled field per line, nothing wider than the
       screen. */
    table.editing,
    table.editing tbody,
    table.editing tr,
    table.editing td { display: block; width: auto; min-width: 0; }
    table.editing { border-collapse: separate; }
    table.editing thead,
    table.editing colgroup { display: none; }
    table.editing tr {
      position: relative;
      border: 1px solid var(--line-soft);
      border-radius: var(--r);
      padding: 0.625rem 2.25rem 0.75rem 0.75rem;
      margin-bottom: 0.625rem;
    }
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
    /* The remove button sits in the card's corner rather than in a column. */
    table.editing td.rm { position: absolute; top: 0.375rem; right: 0.25rem; padding: 0; }
    table.editing td.rm::before { content: none; }
    table.editing .x { font-size: 1.25rem; padding: 0.25rem 0.5rem; }
    /* Under 16px, a phone zooms in when a field takes focus. */
    table.editing input, table.editing select { font-size: 16px; padding: 0.4rem 0.5rem; }
  }
</style>
