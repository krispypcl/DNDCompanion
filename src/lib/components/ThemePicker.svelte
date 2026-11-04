<script lang="ts">
  /**
   * Six presets as quick picks, a colour input for anything else, and a hex
   * box for an exact colour. A picked colour's own saturation decides how
   * loud the theme is.
   *
   * Dragging round the colour input only previews (one repaint a frame); the
   * colour is kept when the input settles. Saving on every movement wrote the
   * whole sheet, and an undo step, dozens of times a second, which lagged.
   */
  import { THEMES, THEME_NAMES, isHexColor, isThemeName, seedHex, swatchColor } from '$lib/theme';

  let {
    value,
    onchange,
    onpreview,
    label = 'Character theme'
  }: {
    value: unknown;
    onchange: (next: string) => void;
    /** The colour being dragged to, not yet kept; null when it settles. */
    onpreview?: (next: string | null) => void;
    /** What the swatches are for, for a screen reader. */
    label?: string;
  } = $props();

  const preset = $derived(isThemeName(value) ? value : null);
  const custom = $derived(preset === null);
  const seed = $derived(seedHex(value));

  let frame = 0;
  let pending: string | null = null;
  function preview(hex: string) {
    pending = hex;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (pending) onpreview?.(pending);
    });
  }
  function keep(hex: string) {
    cancelAnimationFrame(frame);
    frame = 0;
    pending = null;
    onpreview?.(null);
    if (hex.toLowerCase() !== String(value ?? '').toLowerCase()) onchange(hex.toLowerCase());
  }

  // The hex box: written freely, kept on Enter or leaving it, if it is a colour.
  let draft = $state<string | null>(null);
  const hexText = $derived(draft ?? (custom ? seed : ''));
  const bad = $derived(draft !== null && draft.trim() !== '' && !isHexColor(draft));
  function commitHex() {
    if (draft === null) return;
    const text = draft.trim();
    if (isHexColor(text)) {
      keep(text.startsWith('#') ? text : `#${text}`);
      draft = null;
    } else if (text === '') draft = null;
  }
</script>

<div class="picker">
  <div class="presets" role="radiogroup" aria-label={label}>
    {#each THEME_NAMES as name (name)}
      <button
        class="sw"
        class:on={preset === name}
        role="radio"
        aria-checked={preset === name}
        aria-label={THEMES[name].label}
        title={THEMES[name].label}
        style:background={swatchColor(name)}
        onclick={() => onchange(name)}
      ></button>
    {/each}
  </div>

  <label class="own" class:on={custom}>
    <input
      type="color"
      value={seed}
      aria-label="Pick your own accent colour"
      oninput={(e) => (onpreview ? preview(e.currentTarget.value) : keep(e.currentTarget.value))}
      onchange={(e) => keep(e.currentTarget.value)}
    />
    <span>Pick your own</span>
  </label>
  <input
    class="hex"
    class:bad
    type="text"
    spellcheck="false"
    autocomplete="off"
    maxlength="7"
    placeholder="#hex"
    aria-label="Accent colour as hex"
    aria-invalid={bad}
    value={hexText}
    oninput={(e) => (draft = e.currentTarget.value)}
    onkeydown={(e) => { if (e.key === 'Enter') commitHex(); if (e.key === 'Escape') { draft = null; e.currentTarget.blur(); } }}
    onblur={commitHex}
  />
  {#if bad}<p class="err" role="alert">That’s not a colour we can paint with! Six hex digits, like #3a7bd5.</p>{/if}
</div>

<style>
  .picker { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
  .presets { display: flex; gap: 0.625rem; align-items: center; }
  .sw {
    width: 1.75rem; height: 1.75rem; border-radius: 50%;
    border: 1px solid var(--line); padding: 0; cursor: pointer;
  }
  .sw.on { box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--a); }
  .own {
    display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer;
    border: 1px solid var(--line); border-radius: var(--r-sm);
    padding: 0.25rem 0.625rem 0.25rem 0.3125rem; font-size: 0.8125rem; color: var(--dim);
  }
  .own.on { border-color: var(--a-edge); background: var(--a-wash); color: var(--a); }
  .own input {
    width: 1.5rem; height: 1.5rem; padding: 0; border: 0; background: none; cursor: pointer;
  }
  .hex {
    width: 5.5rem; font: inherit; font-size: 0.8125rem; font-variant-numeric: tabular-nums; text-transform: lowercase;
    padding: 0.3125rem 0.5rem; border: 1px solid var(--line); border-radius: var(--r-sm);
    background: var(--bg); color: var(--text); transition: border-color 0.15s ease;
  }
  .hex:focus { outline: none; border-color: var(--a-edge); }
  .hex.bad { border-color: var(--bad); }
  .err { flex-basis: 100%; margin: 0; font-size: 0.75rem; color: var(--bad); }
  /* The native swatch carries its own chrome; strip it back to the colour. */
  .own input::-webkit-color-swatch-wrapper { padding: 0; }
  .own input::-webkit-color-swatch { border: 1px solid var(--line); border-radius: 50%; }
  .own input::-moz-color-swatch { border: 1px solid var(--line); border-radius: 50%; }
</style>
