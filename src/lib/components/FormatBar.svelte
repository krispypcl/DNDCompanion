<script lang="ts">
  /** Bold, italic and the rest, for the page being written. */
  import type { Format } from '$lib/rules/richtext';

  let {
    active,
    onformat
  }: { active: Partial<Record<Format, boolean>>; onformat: (f: Format) => void } = $props();

  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');
  const mod = mac ? '⌘' : 'Ctrl+';

  const TOOLS: { format: Format; label: string; keys: string }[] = [
    { format: 'bold', label: 'Bold', keys: `${mod}B` },
    { format: 'italic', label: 'Italic', keys: `${mod}I` },
    { format: 'underline', label: 'Underline', keys: `${mod}U` },
    { format: 'strike', label: 'Strikethrough', keys: `${mod}Shift+X` },
    { format: 'heading', label: 'Heading', keys: `${mod}Alt+2` },
    { format: 'bullets', label: 'Bulleted list', keys: `${mod}Shift+8` },
    { format: 'numbers', label: 'Numbered list', keys: `${mod}Shift+7` }
  ];
</script>

<div class="bar" role="toolbar" aria-label="Formatting">
  {#each TOOLS as t (t.format)}
    <!-- mousedown would move focus out of the page and lose the selection. -->
    <button
      type="button"
      class="tool {t.format}"
      class:on={active[t.format]}
      aria-pressed={Boolean(active[t.format])}
      aria-label="{t.label} ({t.keys})"
      title="{t.label} ({t.keys})"
      onmousedown={(e) => e.preventDefault()}
      onclick={() => onformat(t.format)}
    >
      {#if t.format === 'bold'}<b>B</b>
      {:else if t.format === 'italic'}<i>I</i>
      {:else if t.format === 'underline'}<u>U</u>
      {:else if t.format === 'strike'}<s>S</s>
      {:else if t.format === 'heading'}<span class="h">H</span>
      {:else if t.format === 'bullets'}
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <g fill="currentColor"><circle cx="5" cy="7" r="1.6" /><circle cx="5" cy="12" r="1.6" /><circle cx="5" cy="17" r="1.6" /></g>
          <path d="M9.5 7H20M9.5 12H20M9.5 17H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <text x="2.5" y="9" font-size="6.5" font-weight="700" fill="currentColor">1</text>
          <text x="2.5" y="15.5" font-size="6.5" font-weight="700" fill="currentColor">2</text>
          <text x="2.5" y="22" font-size="6.5" font-weight="700" fill="currentColor">3</text>
          <path d="M9.5 7H20M9.5 13H20M9.5 19H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      {/if}
    </button>
  {/each}
</div>

<style>
  .bar { display: inline-flex; flex-wrap: wrap; gap: 0.125rem; }
  .tool {
    display: inline-grid; place-items: center; width: 1.875rem; height: 1.875rem;
    background: none; border: 1px solid transparent; border-radius: var(--r-sm);
    color: var(--dim); cursor: pointer; padding: 0; font: inherit; font-size: 0.875rem;
    transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
  }
  .tool:hover { color: var(--text); background: var(--raised); border-color: var(--line); }
  .tool.on { color: var(--a); background: var(--a-wash); border-color: var(--a-edge); }
  .tool b { font-weight: 800; }
  .tool i { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 0.95rem; }
  .tool u { text-underline-offset: 2px; }
  .h { font-weight: 800; font-size: 0.8125rem; }
  @media (max-width: 700px) {
    .tool { width: 2.25rem; height: 2.25rem; }
  }
</style>
