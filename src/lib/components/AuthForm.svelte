<script lang="ts">
  import { base } from '$app/paths';
  import GoogleButton from './GoogleButton.svelte';
  import Logo from './Logo.svelte';
  import { friendlyError } from '$lib/errors';
  import type { FullAutoFill } from 'svelte/elements';
  import { passwordStrength } from '$lib/rules/password';

  type Field = {
    id: string;
    label: string;
    type: string;
    autocomplete: FullAutoFill;
    /** Enforced by the browser as well as by `validate`. */
    minlength?: number;
    /** Show a strength meter under it, judged against the `email` field. */
    strength?: boolean;
  };

  let {
    title,
    name,
    lede,
    fields,
    submitLabel,
    onsubmit,
    validate,
    busyLabel = 'Working…',
    standalone = true,
    children,
    google = false,
    googleNext = '/'
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
    /** A reason the form cannot be sent yet, or nothing. Checked before the
        network is touched, so a typo costs no round trip. */
    validate?: (values: Record<string, string>) => string | null | undefined;
    busyLabel?: string;
    /** A page of its own centres itself; embedded in the landing page it does not. */
    standalone?: boolean;
    children?: import('svelte').Snippet;
    /** Offer "Continue with Google" under the form, returning to `googleNext`. */
    google?: boolean;
    googleNext?: string;
  } = $props();

  let values = $state<Record<string, string>>({});
  let error = $state<string | null>(null);
  let notice = $state<string | null>(null);
  let busy = $state(false);

  async function handle(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    notice = null;
    const problem = validate?.(values);
    if (problem) {
      error = problem;
      return;
    }
    busy = true;
    try {
      const message = await onsubmit(values);
      if (message) notice = message;
    } catch (e) {
      error = friendlyError(e, 'That didn’t work! Give it another go in a moment.');
    } finally {
      busy = false;
    }
  }
</script>

<div class="wrap" class:standalone>
  <div class="stack">
    {#if standalone}
      <!-- The same mark the splash shows, so arriving and signing in are
           plainly the same place. -->
      <div class="brand">
        <Logo size={44} />
        <p>DND Companion</p>
      </div>
    {/if}

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
              minlength={field.minlength}
              aria-describedby={field.strength ? `${field.id}-strength` : undefined}
              required
            />
            {#if field.strength}
              {@const st = passwordStrength(values[field.id] ?? '', values.email ?? '')}
              <div class="meter" id="{field.id}-strength" class:shown={Boolean(values[field.id])} data-score={st.score}
                   aria-live="polite">
                <div class="bars" aria-hidden="true">
                  {#each [1, 2, 3, 4] as n (n)}<i class:lit={st.score >= n || (n === 1 && Boolean(values[field.id]))}></i>{/each}
                </div>
                <p><b>{st.label}</b>{#if st.hint}<span> · {st.hint}</span>{/if}</p>
              </div>
            {/if}
          </div>
        {/each}

        {#if error}<p class="error" role="alert">{error}</p>{/if}
        {#if notice}<p class="notice" role="status">{notice}</p>{/if}

        <button type="submit" disabled={busy}>{busy ? busyLabel : submitLabel}</button>
      </form>

      {#if google}
        <div class="or" aria-hidden="true"><span>or</span></div>
        <GoogleButton next={googleNext} />
      {/if}

      <nav>{@render children?.()}</nav>
    </section>
    {#if standalone}
      <!-- Quietly there for anyone who wants to know what is kept. -->
      <p class="foot"><a class="smallbtn quiet" href="{base}/privacy">Privacy</a></p>
    {/if}
  </div>
</div>

<style>
  .or { display: flex; align-items: center; gap: 0.75rem; margin: 1rem 0 0.75rem; color: var(--dim); font-size: 0.8125rem; }
  .or::before, .or::after { content: ''; flex: 1; height: 1px; background: var(--line-soft); }
  .meter {
    margin-top: 0.4375rem; display: grid; grid-template-rows: 0fr; opacity: 0;
    transition: grid-template-rows 0.25s ease, opacity 0.2s ease;
  }
  .meter > * { min-height: 0; overflow: hidden; }
  .meter.shown { grid-template-rows: auto auto; opacity: 1; }
  .meter:not(.shown) p { display: none; }
  .bars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.25rem; }
  .bars i {
    height: 4px; border-radius: 2px; background: var(--track);
    transition: background-color 0.3s ease, transform 0.3s cubic-bezier(0.3, 1.4, 0.5, 1);
    transform-origin: left center;
  }
  .meter[data-score='0'] .bars i.lit, .meter[data-score='1'] .bars i.lit { background: var(--danger); }
  .meter[data-score='2'] .bars i.lit { background: color-mix(in oklch, var(--danger) 45%, var(--a)); }
  .meter[data-score='3'] .bars i.lit, .meter[data-score='4'] .bars i.lit { background: var(--a); }
  .bars i.lit { animation: fill 0.3s ease; }
  @keyframes fill { from { transform: scaleX(0.3); } }
  .meter p { margin: 0.3125rem 0 0; font-size: 0.78rem; color: var(--dim); line-height: 1.4; }
  .meter b { color: var(--text); font-weight: 600; }
  .wrap { display: flex; justify-content: center; }
  .foot { margin: 1rem 0 0; text-align: center; animation: cardIn 0.32s cubic-bezier(0.2, 0.7, 0.3, 1) 0.08s backwards; }
  .stack { width: 100%; max-width: 23rem; }
  .brand {
    animation: cardIn 0.32s cubic-bezier(0.2, 0.7, 0.3, 1) backwards;
    margin: 0 0 1rem;
    display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  }
  .brand :global(.logo) { color: var(--text); }
  .brand p {
    margin: 0; text-align: center; font-size: 1.375rem;
    font-family: var(--font-brand); font-weight: 700; letter-spacing: 0.01em;
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
    display: flex; justify-content: center; gap: 0.5rem; flex-wrap: wrap;
  }
</style>
