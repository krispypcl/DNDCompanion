<script lang="ts">
  let {
    value,
    editable,
    type = 'text',
    placeholder = '—',
    label,
    onchange
  }: {
    value: string | number | undefined;
    editable: boolean;
    type?: 'text' | 'number' | 'textarea';
    placeholder?: string;
    label?: string;
    onchange: (next: string | number) => void;
  } = $props();

  function commit(event: Event) {
    const el = event.target as HTMLInputElement | HTMLTextAreaElement;
    onchange(type === 'number' ? Number(el.value) : el.value);
  }
</script>

{#if !editable}
  <span class="readout" class:empty={value === '' || value === undefined}>
    {value === '' || value === undefined ? placeholder : value}
  </span>
{:else if type === 'textarea'}
  <textarea aria-label={label} value={String(value ?? '')} onchange={commit} rows="6"></textarea>
{:else}
  <input {type} aria-label={label} value={value ?? ''} onchange={commit} />
{/if}

<style>
  /* The two states occupy the same box so toggling edit never reflows the page. */
  .readout,
  input,
  textarea {
    font: inherit;
    padding: 0.15rem 0.3rem;
    border-radius: 4px;
    min-width: 0;
  }
  .readout {
    display: inline-block;
    border: 1px solid transparent;
  }
  .empty { color: var(--dim); }
  input,
  textarea {
    background: var(--bg);
    border: 1px solid var(--line);
    color: var(--text);
    width: 100%;
  }
  input:focus-visible,
  textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  textarea { resize: vertical; line-height: 1.5; }
</style>
