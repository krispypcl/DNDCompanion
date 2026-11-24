<script lang="ts">
  /**
   * The way back to the page before: the word on a computer, an arrow alone
   * on a phone (where it sits in a row of icon buttons).
   */
  import { phone } from '#lib/stores/phone.svelte.ts';

  let { href, title = 'Back' }: { href: string; title?: string } = $props();
</script>

<a class="backlink" class:icon={phone.current} {href} {title} aria-label={phone.current ? title : undefined}>
  {#if phone.current}
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M19 12H5.5M11 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  {:else}
    Back
  {/if}
</a>

<style>
  .backlink {
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); padding: 0.375rem 0.875rem; font-size: 0.8125rem;
    text-decoration: none; flex: none; line-height: 1.5; min-height: var(--btn-h, 0px); box-sizing: border-box;
    display: inline-flex; align-items: center; justify-content: center; user-select: none; -webkit-user-select: none;
    transition: border-color 0.15s var(--ease-out), color 0.15s var(--ease-out), background-color 0.15s var(--ease-out), transform 0.08s var(--ease-out);
  }
  .backlink:hover { border-color: var(--a-edge); color: var(--a); }
  .backlink:active { transform: translateY(1px); }
  .backlink:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
  /* A phone: a square, as tall as the icon buttons beside it. */
  .backlink.icon { width: 2.25rem; height: 2.25rem; padding: 0; }
  .backlink svg { display: block; transition: transform 0.3s cubic-bezier(0.33, 1, 0.68, 1); }
  /* The arrow leans the way it points. */
  .backlink:hover svg { transform: translateX(-2px); }
  @media (prefers-reduced-motion: reduce) { .backlink svg { transition: none; } }
</style>
