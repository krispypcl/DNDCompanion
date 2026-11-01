<script lang="ts">
  /**
   * One long-form writing (notes, backstory), kept in pages like a book. The
   * owner has one switch for it: private or not. Pages are added and removed
   * in edit mode, and turned by anyone.
   */
  import EditableField from './EditableField.svelte';
  import Switch from './Switch.svelte';
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion } from '$lib/motion';
  import { addPage, isBlank, joinPages, removePage, setPage, splitPages } from '$lib/rules/pages';

  let {
    label,
    value,
    editable,
    owner,
    isPublic,
    onbody,
    onpublic
  }: {
    label: string;
    value: string;
    /** Edit mode: the words, and the pages, can change. */
    editable: boolean;
    /** The owner sees the private switch, in either mode. */
    owner: boolean;
    /** Null when the database cannot keep private text; there is no switch then. */
    isPublic: boolean | null;
    onbody: (next: string) => void;
    onpublic: (next: boolean) => void;
  } = $props();

  const pages = $derived(splitPages(value));
  let current = $state(0);
  /** Which way the last turn went, so the new page comes in from that side. */
  let direction = $state(1);
  /** Removing a page that has writing on it takes a second press. */
  let confirming = $state(false);
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;

  // A page removed elsewhere (or a shorter book loaded) must not leave us past the end.
  $effect(() => {
    if (current > pages.length - 1) current = Math.max(0, pages.length - 1);
  });

  function go(to: number) {
    if (to < 0 || to >= pages.length || to === current) return;
    direction = to > current ? 1 : -1;
    current = to;
    confirming = false;
  }

  function add() {
    onbody(joinPages(addPage(pages, current)));
    direction = 1;
    current += 1;
  }

  function remove() {
    if (pages[current].trim() !== '' && !confirming) {
      confirming = true;
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => (confirming = false), 3000);
      return;
    }
    confirming = false;
    onbody(joinPages(removePage(pages, current)));
    direction = -1;
    current = Math.max(0, current - 1);
  }

  /** A page turning on its spine: the left edge going forward, the right going back. */
  function turn(_node: Element) {
    const span = prefersReducedMotion() ? 0 : 340;
    const forward = direction > 0;
    return {
      duration: span,
      easing: cubicOut,
      css: (t: number, u: number) =>
        `transform-origin: ${forward ? 'left' : 'right'} center;` +
        `transform: perspective(1200px) rotateY(${(forward ? -1 : 1) * u * 32}deg) translateX(${(forward ? 1 : -1) * u * 10}px);` +
        `opacity: ${t};`
    };
  }

  const many = $derived(pages.length > 1);
  const showNav = $derived(many || editable);
</script>

{#if owner && isPublic !== null}
  <div class="options">
    <Switch
      checked={!isPublic}
      label="Private"
      title={isPublic
        ? 'Anyone with the link can read this. Turn on to keep it to yourself.'
        : 'Only you can read this. Everyone else sees it as empty.'}
      onchange={(on) => onpublic(!on)}
    />
  </div>
{/if}

<div class="book">
  {#key current}
    <div class="page" in:turn>
      <EditableField
        value={pages[current] ?? ''}
        {editable}
        type="textarea"
        label={many ? `${label}, page ${current + 1}` : label}
        placeholder={isBlank(pages) ? 'Nothing written yet.' : 'This page is blank.'}
        onchange={(v) => onbody(joinPages(setPage(pages, current, String(v))))}
      />
    </div>
  {/key}
</div>

{#if showNav}
  <div class="pager">
    <div class="turns" class:hidden={!many}>
      <button class="nav" aria-label="Previous page" disabled={current === 0} onclick={() => go(current - 1)}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m14.5 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <span class="count" aria-live="polite">Page {current + 1} of {pages.length}</span>
      <button class="nav" aria-label="Next page" disabled={current >= pages.length - 1} onclick={() => go(current + 1)}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m9.5 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
    </div>
    {#if editable}
      <div class="edits">
        <button class="pg" onclick={add}>Add page</button>
        {#if many || pages[current].trim() !== ''}
          <button class="pg remove" class:confirming onclick={remove}>
            {confirming ? 'Remove this page?' : 'Remove page'}
          </button>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .options { display: flex; align-items: center; margin: 0 0 0.75rem; }

  /* Every other tab starts its content at the panel's edge; the notes field
     insets its text by its own padding and border, so pull the box back by
     exactly that and widen it to match. */
  .book { margin: calc(-0.15rem - 1px) calc(-0.3rem - 1px) 0; perspective: 1200px; }
  .page { backface-visibility: hidden; }
  .book :global(.field) {
    field-sizing: fixed;
    width: 100%;
    white-space: pre-wrap; overflow-wrap: anywhere;
  }

  .pager {
    display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
    flex-wrap: wrap; margin-top: 0.875rem; padding-top: 0.75rem;
    border-top: 1px solid var(--line-soft);
  }
  .turns { display: inline-flex; align-items: center; gap: 0.5rem; }
  .turns.hidden { visibility: hidden; }
  .count { font-size: 0.78rem; color: var(--dim); font-variant-numeric: tabular-nums; min-width: 6.5rem; text-align: center; }
  .nav {
    display: inline-grid; place-items: center; width: 1.875rem; height: 1.875rem;
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); cursor: pointer; padding: 0;
    transition: border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease, transform 0.08s ease;
  }
  .nav:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  .nav:active:not(:disabled) { transform: translateY(1px); }
  .nav:disabled { opacity: 0.35; cursor: default; }
  .edits { display: inline-flex; gap: 0.5rem; }
  .pg {
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); padding: 0.3125rem 0.75rem; font: inherit; font-size: 0.78rem;
    cursor: pointer; transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
  }
  .pg:hover { border-color: var(--a-edge); color: var(--a); }
  .pg.remove:hover, .pg.confirming { border-color: var(--danger); color: var(--danger); }
  .pg.confirming { background: var(--danger-wash); }
  @media (max-width: 700px) {
    .nav { width: 2.25rem; height: 2.25rem; }
    .pg { padding: 0.4375rem 0.875rem; font-size: 0.8125rem; }
  }
</style>
