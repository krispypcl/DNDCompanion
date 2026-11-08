<script lang="ts">
  /** Bold, italic and the rest, for the page being written. */
  import { scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { MARKS, type Format, type MarkKind } from '$lib/rules/richtext';
  import { prefersReducedMotion } from '$lib/motion';

  let {
    active,
    onformat,
    onmark
  }: {
    active: Partial<Record<Format, boolean>>;
    onformat: (f: Format) => void;
    /** Colour, highlight or size for the selection. */
    onmark?: (kind: MarkKind, value: string) => void;
  } = $props();

  /** Which of the three swatch trays is open. */
  let tray = $state<MarkKind | null>(null);
  const SWATCH: Record<string, string> = {
    red: 'oklch(66% 0.2 25)', orange: 'oklch(72% 0.16 55)', gold: 'oklch(78% 0.15 88)', green: 'oklch(68% 0.16 145)',
    teal: 'oklch(70% 0.11 190)', blue: 'oklch(66% 0.15 250)', purple: 'oklch(66% 0.17 300)', pink: 'oklch(70% 0.17 350)',
    grey: 'oklch(60% 0.01 286)', yellow: 'oklch(88% 0.17 98)'
  };
  const TRAYS: { kind: MarkKind; label: string }[] = [
    { kind: 'c', label: 'Text colour' }, { kind: 'h', label: 'Highlight' }, { kind: 's', label: 'Text size' }
  ];
  const SIZE_LABEL: Record<string, string> = { small: 'Small', big: 'Big', huge: 'Huge', none: 'Normal' };

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
  {#if onmark}
    <span class="sep" aria-hidden="true"></span>
    {#each TRAYS as t (t.kind)}
      <div class="trayhost">
        <button type="button" class="tool" class:on={tray === t.kind} aria-expanded={tray === t.kind}
                aria-label={t.label} title={t.label} onmousedown={(e) => e.preventDefault()}
                onclick={() => (tray = tray === t.kind ? null : t.kind)}>
          {#if t.kind === 'c'}<span class="a">A<i style:background="linear-gradient(90deg, {SWATCH.red}, {SWATCH.gold}, {SWATCH.blue})"></i></span>
          {:else if t.kind === 'h'}
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M9 15l-3 3h5l1.5-1.5M9 15l7.5-7.5a2 2 0 0 1 3 3L12 18M9 15l3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" /><path d="M4 21h16" stroke={SWATCH.yellow} stroke-width="2.5" stroke-linecap="round" /></svg>
          {:else}<span class="sz">A<small>A</small></span>{/if}
        </button>
        {#if tray === t.kind}
          <div class="tray" role="group" aria-label={t.label} transition:scale={{ duration: prefersReducedMotion() ? 0 : 150, start: 0.9, easing: cubicOut }}>
            {#each MARKS[t.kind] as v (v)}
              <button type="button" class="opt {t.kind}" class:none={v === 'none'} style:--sw={SWATCH[v]}
                      aria-label={t.kind === 's' ? SIZE_LABEL[v] : v === 'none' ? 'None' : v}
                      title={t.kind === 's' ? SIZE_LABEL[v] : v === 'none' ? 'None' : v[0].toUpperCase() + v.slice(1)}
                      onmousedown={(e) => e.preventDefault()}
                      onclick={() => { onmark(t.kind, v); tray = null; }}>
                {#if t.kind === 's'}<span class="szopt {v}">{SIZE_LABEL[v]}</span>{/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .bar { display: inline-flex; flex-wrap: wrap; gap: 0.125rem; align-items: center; }
  .sep { width: 1px; height: 1.25rem; background: var(--line); margin: 0 0.25rem; }
  .trayhost { position: relative; }
  .a { position: relative; font-weight: 700; line-height: 1; padding-bottom: 3px; }
  .a i { position: absolute; left: -2px; right: -2px; bottom: -1px; height: 3px; border-radius: 2px; }
  .sz { font-weight: 700; } .sz small { font-size: 0.65em; }
  .tray {
    position: absolute; bottom: calc(100% + 0.375rem); left: 50%; translate: -50% 0; z-index: 20;
    display: flex; gap: 0.25rem; padding: 0.375rem; border-radius: var(--r-sm); white-space: nowrap;
    background: var(--raised); border: 1px solid var(--line); box-shadow: 0 10px 24px -10px rgb(0 0 0 / 0.55);
  }
  .opt {
    width: 1.375rem; height: 1.375rem; padding: 0; border-radius: 50%; cursor: pointer;
    border: 2px solid var(--surface); box-shadow: 0 0 0 1px var(--line); background: var(--sw);
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }
  .opt.h { border-radius: 0.3rem; background: color-mix(in oklch, var(--sw) 45%, transparent); }
  .opt:hover { transform: scale(1.12); box-shadow: 0 0 0 1px var(--a-edge); }
  .opt.none { background: linear-gradient(135deg, transparent 45%, var(--bad) 46%, var(--bad) 54%, transparent 55%), var(--surface); }
  .opt.s { width: auto; height: auto; border-radius: var(--r-sm); border: 1px solid var(--line); box-shadow: none; background: var(--surface); padding: 0.125rem 0.5rem; color: var(--text); }
  .opt.s.none { background: var(--surface); }
  .szopt.small { font-size: 0.75rem; } .szopt.big { font-size: 1rem; font-weight: 600; } .szopt.huge { font-size: 1.2rem; font-weight: 700; } .szopt.none { font-size: 0.875rem; }
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
