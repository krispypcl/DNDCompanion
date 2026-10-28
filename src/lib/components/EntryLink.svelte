<script lang="ts">
  import { isHomebrew, lookupUrl, type LookupCategory } from '$lib/rules/lookup';

  let {
    name,
    source,
    category,
    override
  }: {
    name: string;
    source?: string;
    category: LookupCategory;
    override?: string;
  } = $props();

  const href = $derived(lookupUrl(name, source, category, override));
  const homebrew = $derived(!href && isHomebrew(source));
</script>

{#if href}
  <a
    class="lookup"
    {href}
    target="_blank"
    rel="noopener noreferrer"
    title="Look up {name} on 5e.tools"
    aria-label="Look up {name} on 5e.tools"
  >
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M6 3h7v7M13 3 7 9M11 10v3H3V5h3"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </a>
{:else if homebrew}
  <span class="homebrew">Homebrew</span>
{/if}

<style>
  /* Quiet on desktop until hover; faintly present on touch, where there is no hover. */
  .lookup {
    color: var(--dim);
    opacity: 0;
    transition: opacity 0.15s ease, color 0.15s ease;
    display: inline-flex;
    align-items: center;
    padding: 0.1rem;
  }
  :global(*:hover) > .lookup,
  .lookup:focus-visible {
    opacity: 1;
  }
  .lookup:hover { color: var(--accent); }
  @media (hover: none) {
    .lookup { opacity: 0.45; }
  }
  .homebrew {
    font-size: 0.6rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--dim);
    border: 1px solid var(--line);
    border-radius: 3px;
    padding: 0.05rem 0.3rem;
    white-space: nowrap;
  }
</style>
