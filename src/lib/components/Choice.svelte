<script lang="ts" generics="T extends string">
  /** A row of options, one chosen: Light / Dark / System, Tumble / Quick. */
  let {
    options,
    value,
    label,
    onchange
  }: {
    options: { value: T; label: string }[];
    value: T;
    /** What the choice is about, for a screen reader. */
    label: string;
    onchange: (next: T) => void;
  } = $props();
</script>

<div class="choice" role="radiogroup" aria-label={label}>
  {#each options as o (o.value)}
    <button type="button" role="radio" aria-checked={value === o.value} class:on={value === o.value}
            onclick={() => value !== o.value && onchange(o.value)}>{o.label}</button>
  {/each}
</div>

<style>
  .choice {
    display: inline-flex; padding: 0.1875rem; gap: 0.1875rem; border-radius: var(--r-sm);
    background: var(--bg); border: 1px solid var(--line);
  }
  button {
    font: inherit; font-size: 0.8125rem; padding: 0.3125rem 0.75rem; border-radius: calc(var(--r-sm) - 2px);
    border: 1px solid transparent; background: none; color: var(--dim); cursor: pointer;
    transition: color 0.15s var(--ease-out), background-color 0.15s var(--ease-out), border-color 0.15s var(--ease-out);
  }
  button:hover { color: var(--text); }
  button.on { background: var(--a-wash); border-color: var(--a-edge); color: var(--a); }
  button:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
</style>
