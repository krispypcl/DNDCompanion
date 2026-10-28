<script lang="ts" generics="T extends Record<string, unknown>">
  /**
   * One editor for every list of named things on the sheet — spells, features,
   * trackers. Columns are declared by the caller; the add/remove/patch
   * machinery is shared so each list does not reinvent it.
   */
  type Column = {
    key: string;
    label: string;
    type?: 'text' | 'number' | 'select';
    options?: string[];
    width?: string;
  };

  let {
    title,
    items,
    columns,
    blank,
    onchange
  }: {
    title: string;
    items: T[];
    columns: Column[];
    blank: () => T;
    onchange: (next: T[]) => void;
  } = $props();

  function patch(index: number, key: string, value: string, type?: string) {
    onchange(
      items.map((item, i) =>
        i === index ? { ...item, [key]: type === 'number' ? Number(value) : value } : item
      )
    );
  }
</script>

<h3>{title}</h3>
<div class="scroller">
  <table>
    <thead>
      <tr>{#each columns as col (col.key)}<th style:width={col.width}>{col.label}</th>{/each}<th></th></tr>
    </thead>
    <tbody>
      {#each items as item, i (i)}
        <tr>
          {#each columns as col (col.key)}
            <td>
              {#if col.type === 'select'}
                <select
                  value={String(item[col.key] ?? col.options?.[0] ?? '')}
                  aria-label="{title} {i + 1} {col.label}"
                  onchange={(e) => patch(i, col.key, e.currentTarget.value)}
                >
                  {#each col.options ?? [] as option (option)}<option>{option}</option>{/each}
                </select>
              {:else}
                <input
                  type={col.type === 'number' ? 'number' : 'text'}
                  value={String(item[col.key] ?? '')}
                  aria-label="{title} {i + 1} {col.label}"
                  onchange={(e) => patch(i, col.key, e.currentTarget.value, col.type)}
                />
              {/if}
            </td>
          {/each}
          <td>
            <button class="x" aria-label="Remove {title} {i + 1}"
                    onclick={() => onchange(items.filter((_, n) => n !== i))}>×</button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
<button class="add" onclick={() => onchange([...items, blank()])}>Add</button>

<style>
  h3 { font-size: 0.72rem; letter-spacing: 0.09em; text-transform: uppercase; color: var(--dim); margin: 1.25rem 0 0.4rem; }
  .scroller { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; min-width: 28rem; }
  th {
    text-align: left; font-size: 0.6rem; letter-spacing: 0.07em; text-transform: uppercase;
    color: var(--dim); font-weight: 500; padding: 0 0.4rem 0.25rem 0;
  }
  td { padding: 0.15rem 0.4rem 0.15rem 0; }
  input, select {
    background: var(--bg); border: 1px solid var(--line); color: var(--text);
    border-radius: 4px; padding: 0.2rem 0.35rem; font: inherit; font-size: 0.85rem; width: 100%;
  }
  .x { background: none; border: 0; color: var(--dim); cursor: pointer; font-size: 1rem; padding: 0 0.3rem; }
  .x:hover { color: var(--bad); }
  .add {
    margin-top: 0.4rem; background: none; border: 1px dashed var(--line); color: var(--dim);
    border-radius: 6px; padding: 0.3rem 0.8rem; font: inherit; font-size: 0.82rem; cursor: pointer;
  }
  .add:hover { border-color: var(--accent); color: var(--accent); }
</style>
