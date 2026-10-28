<script lang="ts">
  import type { FullAutoFill } from 'svelte/elements';

  type Field = { id: string; label: string; type: string; autocomplete: FullAutoFill };

  let {
    title,
    name,
    lede,
    fields,
    submitLabel,
    onsubmit,
    busyLabel = 'Working…',
    standalone = true,
    children
  }: {
    /** Omitted where the submit button already says what the form does. The
        form keeps the name as an aria-label, so it is still announced. */
    title?: string;
    /** What the form is, for assistive tech, when there is no visible title. */
    name: string;
    lede?: string;
    fields: Field[];
    submitLabel: string;
    onsubmit: (values: Record<string, string>) => Promise<string | void>;
    busyLabel?: string;
    /** A page of its own centres itself; embedded in the landing page it does not. */
    standalone?: boolean;
    children?: import('svelte').Snippet;
  } = $props();

  let values = $state<Record<string, string>>({});
  let error = $state<string | null>(null);
  let notice = $state<string | null>(null);
  let busy = $state(false);

  async function handle(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    notice = null;
    busy = true;
    try {
      const message = await onsubmit(values);
      if (message) notice = message;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<div class="wrap" class:standalone>
  <div class="stack">
    {#if standalone}<p class="brand">DND Companion</p>{/if}

    <section class="card">
      {#if title}<h1>{title}</h1>{/if}
      {#if lede}<p class="lede">{lede}</p>{/if}

      <form onsubmit={handle} aria-label={name} class:bare={!title}>
        {#each fields as field (field.id)}
          <div class="field">
            <label for={field.id}>{field.label}</label>
            <input
              id={field.id}
              type={field.type}
              autocomplete={field.autocomplete}
              bind:value={values[field.id]}
              required
            />
          </div>
        {/each}

        {#if error}<p class="error" role="alert">{error}</p>{/if}
        {#if notice}<p class="notice" role="status">{notice}</p>{/if}

        <button type="submit" disabled={busy}>{busy ? busyLabel : submitLabel}</button>
      </form>

      <nav>{@render children?.()}</nav>
    </section>
  </div>
</div>

<style>
  .wrap { display: flex; justify-content: center; }
  .stack { width: 100%; max-width: 23rem; }
  .brand {
    animation: cardIn 0.32s cubic-bezier(0.2, 0.7, 0.3, 1) backwards;
    margin: 0 0 1rem; text-align: center; font-size: 1.25rem;
    font-weight: 600; letter-spacing: -0.01em;
  }
  /* Its own page centres in the viewport; embedded, it sits in the flow. */
  .standalone { min-height: 100dvh; align-items: center; padding: 1.5rem; }
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(8px) scale(0.995); }
    to { opacity: 1; transform: none; }
  }
  .card {
    animation: cardIn 0.32s cubic-bezier(0.2, 0.7, 0.3, 1) backwards;
    animation-delay: 0.04s;
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-radius: var(--r);
    padding: 1.75rem;
  }
  h1 { font-size: 1.25rem; font-weight: 600; margin: 0; letter-spacing: -0.01em; }
  .lede { margin: 0.5rem 0 0; color: var(--dim); font-size: 0.875rem; line-height: 1.5; }
  form { display: flex; flex-direction: column; gap: 0.875rem; margin-top: 1.5rem; }
  /* With no title above it, the form is the top of the card. */
  form.bare { margin-top: 0; }
  .field { display: flex; flex-direction: column; gap: 0.3125rem; }
  label {
    font-size: 0.6875rem; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--faint); font-weight: 600;
  }
  input {
    background: var(--bg);
    border: 1px solid var(--line);
    color: var(--text);
    border-radius: var(--r-sm);
    padding: 0.625rem 0.75rem;
    font: inherit;
    font-size: 0.9375rem;
    transition: border-color 0.15s ease;
  }
  input:hover { border-color: var(--a-edge); }
  input:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; border-color: var(--a); }
  button {
    margin-top: 0.25rem;
    background: var(--a);
    color: var(--bg);
    border: 0;
    border-radius: var(--r-sm);
    padding: 0.6875rem;
    font: inherit;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.08s ease;
  }
  button:hover:not(:disabled) { filter: brightness(1.08); }
  button:active:not(:disabled) { transform: translateY(1px); }
  button:disabled { opacity: 0.55; cursor: default; }
  .error { color: var(--danger); font-size: 0.85rem; margin: 0; }
  .notice { color: var(--a); font-size: 0.85rem; margin: 0; }
  nav {
    margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--line-soft);
    font-size: 0.85rem; display: flex; gap: 1.25rem; flex-wrap: wrap;
  }
  nav :global(a) { color: var(--dim); text-decoration: none; }
  nav :global(a:hover) { color: var(--a); }
</style>
