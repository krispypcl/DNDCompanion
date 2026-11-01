<script lang="ts">
  /**
   * One long-form writing (notes, backstory), kept in pages like a book. In
   * edit mode the owner has one switch for it, private or not, beside the
   * page controls. Pages are added and removed in edit mode, and turned by
   * anyone who can read them.
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
    locked = false,
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
    /** Private, and this reader is not the owner: say so instead of showing it. */
    locked?: boolean;
    onbody: (next: string) => void;
    onpublic: (next: boolean) => void;
  } = $props();

  const pages = $derived(splitPages(value));
  let current = $state(0);
  /** Removing a page that has writing on it takes a second press. */
  let confirming = $state(false);
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;

  // A page removed elsewhere (or a shorter book loaded) must not leave us past the end.
  $effect(() => {
    if (current > pages.length - 1) current = Math.max(0, pages.length - 1);
  });

  function go(to: number) {
    if (to < 0 || to >= pages.length || to === current) return;
    current = to;
    confirming = false;
  }

  function add() {
    onbody(joinPages(addPage(pages, current)));
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
    current = Math.max(0, current - 1);
  }

  /** A quiet fade as the page changes: the content is what moves, not the page. */
  function turn(_node: Element) {
    return {
      duration: prefersReducedMotion() ? 0 : 180,
      easing: cubicOut,
      css: (t: number) => `opacity: ${t};`
    };
  }

  const many = $derived(pages.length > 1);
  const showNav = $derived(many || editable);
</script>

{#if locked}
  <!-- A visitor cannot read private writing (the database does not send it),
       but should know there is something there, not think it blank. -->
  <div class="locked" role="note">
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </g>
    </svg>
    <p><b>Private</b><span>The player keeps their {label.toLowerCase()} to themselves.</span></p>
  </div>
{:else}
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
  <div class="pager" class:reading={!editable}>
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
        {#if owner && isPublic !== null}
          <Switch
            checked={!isPublic}
            label="Private"
            title={isPublic
              ? 'Anyone with the link can read this. Turn on to keep it to yourself.'
              : 'Only you can read this. Everyone else is told it is private.'}
            onchange={(on) => onpublic(!on)}
          />
        {/if}
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
{/if}

<style>
  .locked {
    flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.5rem; min-height: 10rem; text-align: center; color: var(--dim);
    border: 1px dashed var(--line); border-radius: var(--r); padding: 1.5rem 1rem;
  }
  .locked p { margin: 0; display: grid; gap: 0.125rem; }
  .locked b { color: var(--text); font-weight: 600; }
  .locked span { font-size: 0.8125rem; }

  /* Every other tab starts its content at the panel's edge; the notes field
     insets its text by its own padding and border, so pull the box back by
     exactly that and widen it to match. */
  .book {
    margin: calc(-0.15rem - 1px) calc(-0.3rem - 1px) 0;
    flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0;
  }
  .page { flex: 1 1 auto; display: flex; flex-direction: column; }
  /* Editing, the page is the whole empty card, not six lines of it. */
  .page :global(textarea.field) { flex: 1 1 auto; min-height: 16rem; resize: none; }
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
  /* Reading, the arrows are all there is, so they sit in the middle. */
  .pager.reading { justify-content: center; }
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
  .edits { display: inline-flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .edits :global(.switch) { margin-right: 0.5rem; }
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
