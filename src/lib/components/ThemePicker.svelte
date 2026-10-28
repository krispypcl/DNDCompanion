<script lang="ts">
  /** A character's colour. Two numbers behind the scenes; six choices here. */
  import { THEMES, THEME_NAMES, DEFAULT_THEME, isThemeName, swatchColor } from '$lib/theme';

  let {
    value,
    onchange
  }: { value: unknown; onchange: (next: string) => void } = $props();

  const current = $derived(isThemeName(value) ? value : DEFAULT_THEME);
</script>

<div class="picker" role="radiogroup" aria-label="Character theme">
  {#each THEME_NAMES as name (name)}
    <button
      class="sw"
      class:on={current === name}
      role="radio"
      aria-checked={current === name}
      aria-label={THEMES[name].label}
      title={THEMES[name].label}
      style:background={swatchColor(name)}
      onclick={() => onchange(name)}
    ></button>
  {/each}
</div>

<style>
  .picker { display: flex; gap: 0.625rem; align-items: center; }
  .sw {
    width: 1.75rem; height: 1.75rem; border-radius: 50%;
    border: 1px solid var(--line); padding: 0; cursor: pointer;
  }
  .sw.on { box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--a); }
</style>
