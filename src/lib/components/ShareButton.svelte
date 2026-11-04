<script lang="ts">
  /** Copies a page's link (a sheet's, or a campaign's), for pasting to the rest of the table. */
  import { base } from '$app/paths';
  import { copyText } from '$lib/clipboard';
  import { sheetLink } from '$lib/rules/share';

  let {
    id,
    link,
    label = 'Copy link to this sheet',
    oncopied
  }: {
    /** A sheet's id: its link is made from it. */
    id?: string;
    /** Or the link itself, for anything else. */
    link?: string;
    label?: string;
    oncopied: (ok: boolean) => void;
  } = $props();

  let done = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function share() {
    const ok = await copyText(link ?? sheetLink(location.origin, base, id ?? ''));
    done = ok;
    clearTimeout(timer);
    timer = setTimeout(() => (done = false), 1600);
    oncopied(ok);
  }
</script>

<button class="share" class:done onclick={share} aria-label={label} title={label}>
  {#if done}
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  {:else}
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />
      </g>
    </svg>
  {/if}
</button>

<style>
  .share {
    display: inline-grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    flex: none;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    color: var(--text);
    cursor: pointer;
    padding: 0;
    transition: border-color 0.18s ease, color 0.18s ease, background-color 0.18s ease, transform 0.08s ease;
  }
  .share:hover { border-color: var(--a-edge); color: var(--a); }
  .share:active { transform: translateY(1px); }
  .share.done { border-color: var(--a-edge); color: var(--a); background: var(--a-wash); }
  .share svg { display: block; }
  /* The links of the chain rock against each other once. */
  .share:hover:not(.done) svg { animation: rock 0.5s cubic-bezier(0.3, 0.7, 0.4, 1); }
  @keyframes rock {
    0%, 100% { transform: rotate(0); }
    35% { transform: rotate(-14deg); }
    70% { transform: rotate(6deg); }
  }
  @media (prefers-reduced-motion: reduce) { .share:hover svg { animation: none; } }
</style>
