<script lang="ts">
  /**
   * One page of notes or backstory: shown formatted when reading, and edited
   * formatted (bold looks bold) when editing. The text underneath stays the
   * readable marks in `$lib/rules/richtext`, which is what is saved.
   *
   * The toolbar lives elsewhere (beside the page arrows) and calls `apply`.
   */
  import { onMount } from 'svelte';
  import { fromHtml, isEmptyText, toHtml, type Format } from '$lib/rules/richtext';

  let {
    value,
    editable,
    label,
    placeholder,
    onchange,
    onstate
  }: {
    value: string;
    editable: boolean;
    label: string;
    placeholder: string;
    onchange: (next: string) => void;
    /** Which formats the caret is in, for the toolbar to light up. */
    onstate?: (active: Record<Format, boolean>) => void;
  } = $props();

  let box: HTMLDivElement | undefined = $state();
  /** The text this editor last reported, so its own saves never reload it. */
  let said = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let blank = $state(true);

  function load(text: string) {
    if (!box) return;
    box.innerHTML = isEmptyText(text) ? '' : toHtml(text);
    said = text;
    blank = isEmptyText(text);
  }

  // Filled when it appears, and again only if the text changes from outside
  // (an undo, another tab) — never from its own typing, which would throw
  // the caret to the start.
  $effect(() => {
    if (!editable || !box) return;
    if (value !== said) load(value);
  });

  function report() {
    if (!box) return;
    clearTimeout(timer);
    const text = fromHtml(box);
    blank = isEmptyText(box.textContent ?? '') && !box.querySelector('li');
    if (text === said) return;
    said = text;
    onchange(text);
  }

  function oninput() {
    blank = isEmptyText(box?.textContent ?? '') && !box?.querySelector('li');
    clearTimeout(timer);
    timer = setTimeout(report, 700);
    sense();
  }

  /** What the caret is in now. */
  function sense() {
    if (!onstate || typeof document === 'undefined' || !box) return;
    const sel = document.getSelection();
    if (!sel || !sel.anchorNode || !box.contains(sel.anchorNode)) return;
    const q = (cmd: string) => {
      try {
        return document.queryCommandState(cmd);
      } catch {
        return false;
      }
    };
    let block = '';
    try {
      block = String(document.queryCommandValue('formatBlock') ?? '').toLowerCase();
    } catch {
      /* not supported */
    }
    onstate({
      bold: q('bold'),
      italic: q('italic'),
      underline: q('underline'),
      strike: q('strikeThrough'),
      heading: /h[1-6]/.test(block),
      bullets: q('insertUnorderedList'),
      numbers: q('insertOrderedList')
    });
  }

  onMount(() => {
    const onSel = () => sense();
    document.addEventListener('selectionchange', onSel);
    return () => {
      document.removeEventListener('selectionchange', onSel);
      // Leaving the page (or the tab) keeps what was typed.
      if (timer) report();
    };
  });

  /** Applies a format to the selection, from the toolbar or a shortcut. */
  export function apply(format: Format) {
    if (!box || typeof document === 'undefined') return;
    if (!box.contains(document.activeElement) && document.activeElement !== box) box.focus();
    try {
      document.execCommand('styleWithCSS', false, 'false');
    } catch {
      /* older engines */
    }
    if (format === 'heading') {
      let block = '';
      try {
        block = String(document.queryCommandValue('formatBlock') ?? '').toLowerCase();
      } catch {
        /* not supported */
      }
      document.execCommand('formatBlock', false, /h[1-6]/.test(block) ? 'div' : 'h3');
    } else {
      const cmd = {
        bold: 'bold',
        italic: 'italic',
        underline: 'underline',
        strike: 'strikeThrough',
        bullets: 'insertUnorderedList',
        numbers: 'insertOrderedList'
      }[format];
      document.execCommand(cmd);
    }
    oninput();
  }

  function onkeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    // Bold, italic and underline are the browser's own; these three are not.
    if (e.shiftKey && key === 'x') {
      e.preventDefault();
      apply('strike');
    } else if (e.shiftKey && (key === '8' || key === '*')) {
      e.preventDefault();
      apply('bullets');
    } else if (e.shiftKey && (key === '7' || key === '&')) {
      e.preventDefault();
      apply('numbers');
    } else if (e.altKey && key === '2') {
      e.preventDefault();
      apply('heading');
    }
  }

  /** Pasted text arrives as text: formatting from another site would carry
      styles the sheet cannot keep. */
  function onpaste(e: ClipboardEvent) {
    const text = e.clipboardData?.getData('text/plain');
    if (text == null) return;
    e.preventDefault();
    document.execCommand('insertText', false, text);
  }
</script>

{#if editable}
  <div
    bind:this={box}
    class="rich editing"
    class:blank
    contenteditable="true"
    role="textbox"
    aria-multiline="true"
    aria-label={label}
    tabindex="0"
    data-placeholder={placeholder}
    {oninput}
    {onkeydown}
    {onpaste}
    onblur={report}
  ></div>
{:else if isEmptyText(value)}
  <p class="rich empty">{placeholder}</p>
{:else}
  <!-- Safe: toHtml escapes everything typed before reading any mark. -->
  <div class="rich">{@html toHtml(value)}</div>
{/if}

<style>
  .rich {
    font-size: inherit; line-height: 1.55; color: var(--text);
    overflow-wrap: anywhere; padding: calc(0.15rem + 1px) calc(0.3rem + 1px);
  }
  .empty { color: var(--dim); margin: 0; }
  .editing {
    flex: 1 1 auto; min-height: 16rem; outline: none; cursor: text;
    background: var(--bg); border: 1px solid var(--line); border-radius: 4px;
    padding: 0.15rem 0.3rem; position: relative;
    transition: border-color 0.18s ease;
  }
  .editing:focus-visible, .editing:focus { border-color: var(--a-edge); }
  .editing.blank::before {
    content: attr(data-placeholder); color: var(--dim); opacity: 0.7;
    position: absolute; pointer-events: none;
  }
  .rich :global(h3) {
    font-size: 1.125em; font-weight: 650; margin: 0.625em 0 0.25em; letter-spacing: -0.005em;
  }
  .rich :global(h3:first-child) { margin-top: 0; }
  .rich :global(ul), .rich :global(ol) { margin: 0.25em 0; padding-left: 1.5em; }
  .rich :global(li) { margin: 0.125em 0; }
  .rich :global(strong), .rich :global(b) { font-weight: 650; }
  .rich :global(u) { text-underline-offset: 2px; }
  .rich :global(s), .rich :global(strike) { color: var(--dim); }
  @media (max-width: 700px) {
    .rich { font-size: max(1em, 16px); }
  }
</style>
