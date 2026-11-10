<script lang="ts">
  import InkLayer from './InkLayer.svelte';
  import { fade } from 'svelte/transition';
  import { INKS } from '$lib/palette';
  import { blankInk, joinInk, splitInk, type Ink, type Paper, type Stroke } from '$lib/rules/ink';
  /**
   * One long-form writing (notes, backstory), kept in pages like a book. In
   * edit mode the owner has one switch for it, private or not, beside the
   * page controls. Pages are added and removed in edit mode, and turned by
   * anyone who can read them.
   */
  import FormatBar from './FormatBar.svelte';
  import RichPage from './RichPage.svelte';
  import type { Format, MarkKind } from '$lib/rules/richtext';
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
    peek = false,
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
    /** Private, and this reader is the campaign's DM: shown, with a word that it is private. */
    peek?: boolean;
    onbody: (next: string) => void;
    onpublic: (next: boolean) => void;
  } = $props();

  const pages = $derived(splitPages(value));

  /** The page being written, for the toolbar to act on. */
  let editor: { apply: (f: Format) => void; mark: (k: MarkKind, v: string) => void } | undefined = $state();
  let active = $state<Partial<Record<Format, boolean>>>({});
  let current = $state(0);
  /** This page's writing and its drawing (kept on a last line of the page). */
  const parts = $derived(splitInk(pages[current] ?? ''));
  const writePage = (text: string, ink: Ink | null) => onbody(joinPages(setPage(pages, current, joinInk(text, ink))));

  // ── Drawing over the page ──
  let drawing = $state(false);
  let erasing = $state(false);
  let inkHeight = $state(0);
  let pen = $state({ c: INKS[1].c, w: 4 });
  const ink = $derived(parts.ink ?? blankInk());
  function addStroke(st: Stroke) {
    writePage(parts.text, { ...ink, s: [...ink.s, st] });
  }
  function eraseStroke(i: number) {
    eraseStrokes([i]);
  }
  /** One swipe of the eraser: every line it went over, in one save. */
  function eraseStrokes(gone: number[]) {
    writePage(parts.text, { ...ink, s: ink.s.filter((_, j) => !gone.includes(j)) });
  }
  function setPaper(paper: Paper) {
    writePage(parts.text, { ...ink, paper });
  }
  $effect(() => {
    if (!editable) drawing = false;
  });
  /** Removing a page that has writing on it takes a second press. */
  let confirming = $state(false);
  let clearingInk = $state(false);
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
{#if peek}
  <p class="peek" role="note">
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></g></svg>
    Private. You can read it as their campaign’s DM; nobody else can.
  </p>
{/if}
<div class="book">
  {#key current}
    <div class="page" in:turn style:min-height={inkHeight ? `${inkHeight}px` : undefined}>
      <RichPage
        bind:this={editor}
        value={parts.text}
        {editable}
        label={many ? `${label}, page ${current + 1}` : label}
        placeholder={isBlank(pages) ? 'Nothing written yet.' : 'This page is blank.'}
        onchange={(v) => writePage(v, parts.ink)}
        onstate={(a) => (active = a)}
      />
      <InkLayer ink={parts.ink} {drawing} {pen} {erasing} onstroke={addStroke} onerase={eraseStrokes} bind:minHeight={inkHeight} />
    </div>
  {/key}
</div>

<!-- Always there, even for a single page: Notes and Backstory look the same
     whatever has been written in them. -->
<div class="pagerwrap">
<div class="pager" class:reading={!editable} class:inking={drawing}>
  <!-- Formatting sits to the left of the page arrows, while writing. -->
  {#if editable}
    {#if drawing}
      <!-- Drawing: the pen, the eraser, the paper. -->
      <div class="inkbar" role="toolbar" aria-label="Drawing" transition:fade={{ duration: 150 }}>
        {#each INKS as ink (ink.c)}
          <button class="sw" style:--sw={ink.c} aria-label="{ink.name} pen" title={ink.name} aria-pressed={!erasing && pen.c === ink.c}
                  onclick={() => { pen = { ...pen, c: ink.c }; erasing = false; }}></button>
        {/each}
        <span class="isep" aria-hidden="true"></span>
        {#each [2, 4, 8, 14] as w (w)}
          <button class="thick" aria-label="Thickness {w}" aria-pressed={!erasing && pen.w === w}
                  onclick={() => { pen = { ...pen, w }; erasing = false; }}><i style:--d="{Math.max(3, w / 1.4)}px"></i></button>
        {/each}
        <button class="itool" aria-pressed={erasing} title="Eraser: tap a line, or swipe across lines" onclick={() => (erasing = !erasing)}>Eraser</button>
        <span class="isep" aria-hidden="true"></span>
        <select aria-label="Paper" value={ink.paper} onchange={(e) => setPaper(e.currentTarget.value as Paper)}>
          <option value="plain">Plain paper</option><option value="lines">Lines</option><option value="grid">Grid</option><option value="dots">Dots</option>
        </select>
        {#if ink.s.length}
          <button class="itool" title="Take back the last line" onclick={() => eraseStroke(ink.s.length - 1)}>Undo</button>
          {#if clearingInk}
            <!-- Asked first: a whole page of drawing is a lot to lose to a slip. -->
            <span class="askink" transition:fade={{ duration: 140 }}>Clear the drawing?
              <button class="itool danger" onclick={() => { clearingInk = false; writePage(parts.text, { ...ink, s: [] }); }}>Clear</button>
              <button class="itool" onclick={() => (clearingInk = false)}>Keep</button>
            </span>
          {:else}
            <button class="itool" title="Clear this page's drawing" disabled={!ink.s.length} onclick={() => (clearingInk = true)}>Clear</button>
          {/if}
        {/if}
        <button class="itool done" onclick={() => (drawing = false)}>Done</button>
      </div>
    {:else}
      <FormatBar {active} onformat={(f) => editor?.apply(f)} onmark={(k, v) => editor?.mark(k, v)} />
    {/if}
  {/if}
    <div class="turns">
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
        <button class="pg drawbtn" class:on={drawing} aria-pressed={drawing} onclick={() => { drawing = !drawing; erasing = false; }}
                title="Draw over the page">
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10zM14 7l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
          Draw
        </button>
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
            {confirming ? 'Remove it?' : 'Remove page'}
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>
{/if}

<style>
  .peek {
    display: flex; align-items: center; gap: 0.375rem; margin: 0 0 0.625rem; font-size: 0.75rem; color: var(--dim);
  }
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
  /* Grows with the writing and never shrinks under it: a long page makes the
     module scroll, rather than spilling over the page controls below. */
  .book {
    margin: calc(-0.15rem - 1px) calc(-0.3rem - 1px) 0;
    flex: 1 0 auto; display: flex; flex-direction: column;
  }
  .page { flex: 1 0 auto; display: flex; flex-direction: column; position: relative; }
  .askink { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.8125rem; color: var(--dim); }
  .itool.danger { color: var(--bad); border-color: var(--bad); }
  .inkbar { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; }
  .inkbar .sw { width: 1.125rem; height: 1.125rem; }
  .inkbar .sw {
    width: 1.25rem; height: 1.25rem; padding: 0; border-radius: 50%; cursor: pointer; background: var(--sw);
    border: 2px solid var(--surface); box-shadow: 0 0 0 1px var(--line); transition: transform 0.12s ease, box-shadow 0.12s ease;
  }
  .inkbar .sw[aria-pressed='true'] { box-shadow: 0 0 0 2px var(--a); transform: scale(1.1); }
  .thick { width: 1.75rem; height: 1.75rem; display: grid; place-items: center; padding: 0; border: 1px solid transparent; border-radius: var(--r-sm); background: none; color: var(--text); cursor: pointer; }
  .thick i { display: block; width: var(--d); height: var(--d); border-radius: 50%; background: currentColor; }
  .thick[aria-pressed='true'], .itool[aria-pressed='true'] { border-color: var(--a-edge); background: var(--a-wash); color: var(--a); }
  .isep { width: 1px; height: 1.25rem; background: var(--line); margin: 0 0.25rem; }
  .itool, .inkbar select {
    font: inherit; font-size: 0.8125rem; cursor: pointer; border-radius: var(--r-sm); padding: 0.25rem 0.5rem;
    border: 1px solid var(--line); background: var(--raised); color: var(--text);
  }
  .itool.done { border-color: var(--a-edge); color: var(--a); background: var(--a-wash); }
  /* The drawing tools answer the pointer like every other button on the sheet. */
  .itool, .thick { transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.08s ease; }
  .itool:hover:not(:disabled), .inkbar select:hover, .thick:hover { border-color: var(--a-edge); color: var(--a); }
  .itool.danger:hover { border-color: var(--bad); color: var(--bad); background: color-mix(in oklch, var(--bad) 10%, transparent); }
  .itool:active:not(:disabled), .thick:active, .inkbar .sw:active { transform: translateY(1px); }
  .inkbar .sw:hover { box-shadow: 0 0 0 2px var(--a-edge); transform: scale(1.08); }
  .itool:focus-visible, .thick:focus-visible, .inkbar .sw:focus-visible, .inkbar select:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
  .itool:disabled { opacity: 0.5; cursor: default; }
  .drawbtn { display: inline-flex; align-items: center; gap: 0.3125rem; }
  .drawbtn.on { border-color: var(--a-edge); color: var(--a); background: var(--a-wash); }
  .pager {
    display: flex; align-items: center; gap: 0.75rem;
    flex-wrap: wrap; margin-top: 0.875rem; padding-top: 0.75rem;
    border-top: 1px solid var(--line-soft);
  }
  .turns { display: inline-flex; align-items: center; gap: 0.5rem; }
  /* Reading, the arrows are all there is, so they sit in the middle. */
  .pager.reading { justify-content: center; }
  /* Editing, the arrows stay in the middle too: formatting on their left,
     the page and privacy controls on their right. Where the card is too
     narrow for all three on one line, the arrows take a line of their own,
     still centred, and on a phone everything stacks. */
  /* The page controls stay in sight at the module's foot while a long page
     scrolls under them (in the module on a wide screen, on the page on a
     phone), on the module's own colour with a soft edge above. */
  .pagerwrap {
    container-type: inline-size;
    position: sticky; bottom: 0; z-index: 3;
    margin-top: auto; padding-bottom: 0.5rem;
    background: var(--surface);
    box-shadow: 0 -10px 12px -8px color-mix(in oklch, var(--bg) 85%, transparent);
  }
  .pager:not(.reading) {
    display: grid; align-items: center; column-gap: 0.75rem; row-gap: 0.625rem;
    grid-template-columns: auto 1fr;
    grid-template-areas: 'bar edits' 'turns turns';
  }
  .pager:not(.reading) :global(.bar), .pager:not(.reading) .inkbar { grid-area: bar; justify-self: start; }
  /* Drawing: the pen's tools get the whole first line; the page controls sit below. */
  .pager.inking:not(.reading) { grid-template-columns: auto 1fr; grid-template-areas: 'bar bar' 'turns edits'; }
  .pager:not(.reading) .turns { grid-area: turns; justify-self: center; }
  .pager:not(.reading) .edits { grid-area: edits; justify-self: end; justify-content: flex-end; margin-left: 0; }
  @container (min-width: 700px) {
    .pager:not(.reading) {
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      grid-template-areas: 'bar turns edits';
    }
    .pager.inking:not(.reading) { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); grid-template-areas: 'bar bar bar' '. turns edits'; }
    .pager:not(.reading) .edits { flex-wrap: nowrap; }
  }
  @container (max-width: 460px) {
    .pager:not(.reading) {
      grid-template-columns: 1fr;
      grid-template-areas: 'bar' 'turns' 'edits';
      justify-items: center;
    }
    .pager:not(.reading) :global(.bar),
    .pager:not(.reading) .edits { justify-self: center; justify-content: center; }
  }
  .count { font-size: 0.78rem; color: var(--dim); font-variant-numeric: tabular-nums; min-width: 5.75rem; text-align: center; white-space: nowrap; }
  .nav {
    display: inline-grid; place-items: center; width: 1.875rem; height: 1.875rem;
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); cursor: pointer; padding: 0;
    transition: border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease, transform 0.08s ease;
  }
  .nav:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  .nav:active:not(:disabled) { transform: translateY(1px); }
  .nav:disabled { opacity: 0.35; cursor: default; }
  .edits { display: inline-flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-left: auto; }
  .edits :global(.switch) { margin-right: 0.25rem; }
  .pg {
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); padding: 0.3125rem 0.625rem; font: inherit; font-size: 0.78rem;
    white-space: nowrap;
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
