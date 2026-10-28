<script lang="ts">
  import type { FullAutoFill } from 'svelte/elements';

  type Field = { id: string; label: string; type: string; autocomplete: FullAutoFill };

  let {
    title,
    fields,
    submitLabel,
    onsubmit,
    busyLabel = 'Working…',
    children
  }: {
    title: string;
    fields: Field[];
    submitLabel: string;
    onsubmit: (values: Record<string, string>) => Promise<string | void>;
    busyLabel?: string;
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

<main>
  <h1>{title}</h1>

  <form onsubmit={handle}>
    {#each fields as field (field.id)}
      <label for={field.id}>{field.label}</label>
      <input
        id={field.id}
        type={field.type}
        autocomplete={field.autocomplete}
        bind:value={values[field.id]}
        required
      />
    {/each}

    {#if error}<p class="error" role="alert">{error}</p>{/if}
    {#if notice}<p class="notice" role="status">{notice}</p>{/if}

    <button type="submit" disabled={busy}>{busy ? busyLabel : submitLabel}</button>
  </form>

  <nav>{@render children?.()}</nav>
</main>

<style>
  main {
    max-width: 22rem;
    margin: 0 auto;
    padding: 3rem 1rem;
  }
  h1 {
    font-size: 1.4rem;
    margin: 0 0 1.5rem;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  label {
    font-size: 0.8rem;
    color: var(--dim);
  }
  input {
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--text);
    border-radius: 6px;
    padding: 0.6rem 0.7rem;
    font: inherit;
    margin-bottom: 0.6rem;
  }
  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  button {
    margin-top: 0.6rem;
    background: var(--accent);
    color: #1a1a18;
    border: 0;
    border-radius: 6px;
    padding: 0.65rem;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .error {
    color: var(--bad);
    font-size: 0.875rem;
    margin: 0.2rem 0;
  }
  .notice {
    color: var(--good);
    font-size: 0.875rem;
    margin: 0.2rem 0;
  }
  nav {
    margin-top: 1.5rem;
    font-size: 0.875rem;
    display: flex;
    gap: 1rem;
  }
  nav :global(a) {
    color: var(--dim);
  }
</style>
