<!--
  A creature's expression (database/0023) as a dropdown: the one chosen
  shows on its button; the list holds None, the suggestions (rules/creatures
  EXPRESSIONS) and any of the DM's own, with a field at its top to write a
  new one (it also narrows the list). Enter sets what was written; the
  arrow keys move through the list; Esc or a press outside closes it.
-->
<script lang="ts">
  import { cubicOut } from 'svelte/easing';
  import { cleanExpression, EXPRESSIONS } from '#lib/rules/creatures.ts';
  import { prefersReducedMotion } from '#lib/motion.ts';

  let { value, who, disabled = false, onpick }: { value: string; who: string; disabled?: boolean; onpick: (next: string) => void } = $props();

  let open = $state(false);
  let draft = $state('');
  let box = $state<HTMLElement>();
  let button = $state<HTMLButtonElement>();
  const id = `expr-${Math.random().toString(36).slice(2, 8)}`;

  /** None, the suggestions, and the DM's own when it's none of them; narrowed by what is being written. */
  const options = $derived.by(() => {
    const all = ['', ...EXPRESSIONS, ...(value && !(EXPRESSIONS as readonly string[]).includes(value) ? [value] : [])];
    const q = draft.trim().toLowerCase();
    return q ? all.filter((o) => o && o.toLowerCase().includes(q)) : all;
  });

  function pick(next: string) {
    open = false;
    draft = '';
    button?.focus();
    if (next !== value) onpick(next);
  }
  function toggle() {
    open = !open;
    draft = '';
  }
  /** Down the list from the field, and through it. */
  function onkey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      open = false;
      button?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(box?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : at - 1;
    if (next < 0) box?.querySelector<HTMLInputElement>('input')?.focus();
    else items[next]?.focus();
  }
  function written(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const text = cleanExpression(draft);
    if (text) pick(options.find((o) => o.toLowerCase() === text.toLowerCase()) ?? text);
  }
  /** A press anywhere else closes it. */
  function outside(node: HTMLElement) {
    const press = (e: PointerEvent) => {
      if (open && !node.contains(e.target as Node)) open = false;
    };
    window.addEventListener('pointerdown', press, true);
    return { destroy: () => window.removeEventListener('pointerdown', press, true) };
  }
  /** Drops a little from under its button, and goes back the same way. */
  function drop(_node: Element) {
    return {
      duration: prefersReducedMotion() ? 0 : 160,
      easing: cubicOut,
      css: (t: number) => `opacity: ${t}; transform: translateY(${(1 - t) * -4}px);`
    };
  }
</script>

<div class="exprpick" bind:this={box} use:outside onkeydown={onkey} role="presentation">
  <button type="button" class="exprbtn" bind:this={button} {disabled} aria-haspopup="listbox" aria-expanded={open} aria-controls={id}
          aria-label="{who}’s expression: {value || 'none'}" onclick={toggle}>
    <span class="exprnow" class:none={!value}>{value || 'None'}</span>
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="m2.5 4.5 3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </button>
  {#if open}
    <div class="exprmenu" transition:drop>
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={draft} maxlength="40" placeholder="Write your own" aria-label="Write {who}’s expression" autofocus onkeydown={written} />
      <div class="exprlist themed-scroll" role="listbox" {id} aria-label="Expressions">
        {#each options as o (o)}
          <button type="button" role="option" aria-selected={o === value} class:none={!o} onclick={() => pick(o)}>
            {o || 'None'}
            {#if o === value}<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="m2.5 6.5 2.5 2.5 4.5-5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>{/if}
          </button>
        {:else}
          <p class="exprhint">Enter sets “{cleanExpression(draft)}”.</p>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .exprpick { position: relative; flex: 1; min-width: 0; }
  /* Open, its card and the page's section around it come forward, so the list lies over what follows (each of the
     page's sections is its own layer). */
  :global(main > *:has(.exprmenu)), :global(li:has(> * .exprmenu)) { z-index: 5 !important; }
  .exprbtn {
    width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; text-align: left;
    font: inherit; font-size: 0.8125rem; padding: 0.3125rem 0.5rem; color: var(--text); cursor: pointer;
    border: 1px solid var(--line-soft); border-radius: var(--r-sm); background: var(--raised);
    transition: border-color 0.15s var(--ease-out), color 0.15s var(--ease-out), transform 0.08s var(--ease-out);
  }
  .exprbtn:hover:not(:disabled), .exprbtn[aria-expanded='true'] { border-color: var(--a-edge); }
  .exprbtn:active:not(:disabled) { transform: translateY(1px); }
  .exprbtn:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  .exprbtn:disabled { cursor: default; }
  .exprbtn:disabled svg { visibility: hidden; }
  .exprbtn svg { flex: none; color: var(--dim); transition: transform 0.2s cubic-bezier(0.33, 1, 0.68, 1); }
  .exprbtn[aria-expanded='true'] svg { transform: rotate(180deg); }
  .exprnow { overflow-wrap: anywhere; }
  .exprnow.none, .exprlist .none { color: var(--dim); }
  .exprmenu {
    position: absolute; z-index: 40; left: 0; right: 0; top: calc(100% + 0.25rem); display: grid; gap: 0.25rem; padding: 0.375rem;
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--surface);
    box-shadow: 0 12px 28px -10px rgb(0 0 0 / 0.45);
  }
  .exprmenu input {
    font: inherit; font-size: 0.8125rem; padding: 0.3125rem 0.5rem; color: var(--text); min-width: 0;
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  .exprmenu input:focus { outline: none; border-color: var(--a-edge); }
  .exprmenu input::placeholder { color: var(--dim); opacity: 0.8; }
  .exprlist { display: grid; max-height: 13rem; overflow-y: auto; overscroll-behavior: contain; }
  .exprlist button {
    display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; text-align: left; cursor: pointer;
    font: inherit; font-size: 0.8125rem; padding: 0.3125rem 0.5rem; color: var(--text); border: 0; border-radius: var(--r-sm); background: none;
    transition: background-color 0.12s var(--ease-out), color 0.12s var(--ease-out);
  }
  .exprlist button:hover, .exprlist button:focus-visible { background: var(--a-wash); color: var(--a); outline: none; }
  .exprlist button[aria-selected='true'] { color: var(--a); font-weight: 600; }
  .exprhint { margin: 0; padding: 0.3125rem 0.5rem; font-size: 0.75rem; color: var(--dim); }
  @media (max-width: 700px) {
    .exprmenu input { font-size: 16px; }
    .exprlist button { padding: 0.5rem 0.625rem; font-size: 0.875rem; }
  }
</style>
