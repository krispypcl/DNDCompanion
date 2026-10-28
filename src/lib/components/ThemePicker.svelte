<script lang="ts">
  /** Six presets as quick picks, and a colour input for anything else. A
      picked colour's own saturation decides how loud the theme is. */
  import { THEMES, THEME_NAMES, isThemeName, seedHex, swatchColor } from '$lib/theme';

  let {
    value,
    onchange
  }: { value: unknown; onchange: (next: string) => void } = $props();

  const preset = $derived(isThemeName(value) ? value : null);
  const custom = $derived(preset === null);
  const seed = $derived(seedHex(value));
</script>

<div class="picker">
  <div class="presets" role="radiogroup" aria-label="Character theme">
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
      oninput={(e) => onchange(e.currentTarget.value)}
    />
    <span>Pick your own</span>
  </label>
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
  /* The native swatch carries its own chrome; strip it back to the colour. */
  .own input::-webkit-color-swatch-wrapper { padding: 0; }
  .own input::-webkit-color-swatch { border: 1px solid var(--line); border-radius: 50%; }
  .own input::-moz-color-swatch { border: 1px solid var(--line); border-radius: 50%; }
</style>
