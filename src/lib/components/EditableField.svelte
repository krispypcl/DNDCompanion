<script lang="ts">
  let {
    value,
    display,
    editable,
    type = 'text',
    placeholder = '—',
    label,
    onchange
  }: {
    value: string | number | undefined;
    /** What to show when not editing, if it differs from the raw value. */
    display?: string;
    editable: boolean;
    type?: 'text' | 'number' | 'textarea';
    placeholder?: string;
    label?: string;
    onchange: (next: string | number) => void;
  } = $props();

  const empty = $derived(value === '' || value === undefined);

  function commit(event: Event) {
    const el = event.target as HTMLInputElement | HTMLTextAreaElement;
    // An emptied number field reports '' rather than 0: Number('') is 0, which
    // would make "cleared" indistinguishable from "set to zero". Callers that
    // want a number still wrap in Number(), which maps '' to 0 as before.
    if (type === 'number') {
      onchange(el.value === '' ? '' : Number(el.value));
      return;
    }
    onchange(el.value);
  }
</script>

<!-- Both states carry `.field`, so one rule in a caller sizes the readout and
     the input together and toggling edit cannot shift the layout. -->
{#if !editable}
  <span class="field readout" class:empty>{empty ? placeholder : (display ?? value)}</span>
{:else if type === 'textarea'}
  <textarea class="field" aria-label={label} value={String(value ?? '')} onchange={commit} rows="6"
  ></textarea>
{:else}
  <input class="field" {type} aria-label={label} value={value ?? ''} onchange={commit} />
{/if}

<style>
  /* One box for both states: same font, same padding, same 1px border — the
     read-only one just has nothing to show for it. */
  .field {
    /* An input takes its height from the font's own metrics, not line-height,
       so it comes out taller than a span with the same rules. Deriving an
       explicit height from these two variables makes both states agree; a
       caller that changes the padding or leading overrides the variables and
       the height follows. */
    --fld-leading: 1.4;
    --fld-pad-y: 0.15rem;
    font: inherit;
    font-size: inherit;
    letter-spacing: inherit;
    font-variant-numeric: inherit;
    -webkit-font-smoothing: antialiased;
    line-height: var(--fld-leading);
    padding: var(--fld-pad-y) 0.3rem;
    height: calc(var(--fld-leading) * 1em + var(--fld-pad-y) * 2 + 2px);
    border: 1px solid transparent;
    border-radius: 4px;
    min-width: 0;
    text-align: inherit;
    color: var(--text);
    background: none;
    box-sizing: border-box;
    transition: border-color 0.18s ease, background-color 0.18s ease;
  }
  .readout { display: inline-block; }
  .empty { color: var(--dim); }
  input.field, textarea.field {
    background: var(--bg);
    border-color: var(--line);
    /* Sizes to its content, so an inline input occupies the box the readout
       did. It overrides an explicit width AND height, so any caller that sets
       its own size turns it back to `fixed`. */
    field-sizing: content;
    min-width: 2.5rem;
  }
  input.field:focus-visible,
  textarea.field:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  textarea.field { resize: vertical; line-height: 1.5; display: block; height: auto; }
  /* Spinners would make a number input wider than its readout. */
  input[type='number'] { -moz-appearance: textfield; appearance: textfield; }
  input[type='number']::-webkit-outer-spin-button,
  input[type='number']::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
</style>
