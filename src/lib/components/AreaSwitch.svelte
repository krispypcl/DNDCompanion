<script lang="ts">
  /**
   * Two areas as one switch (the main menu's Characters or Campaigns, the
   * campaign page's Players or Monsters & NPCs): a pill whose
   * thumb slides to the side chosen. Each side shows its sign, its name, how
   * many, and, where it is given, a light while anyone is at one of the
   * tables.
   */
  type Side = { key: string; icon: 'person' | 'flag' | 'monster'; count: number; live?: number };
  let { sides, active, onchoose }: { sides: Side[]; active: string; onchoose: (key: string) => void } = $props();
</script>

<div class="areaswitch" role="tablist" aria-label="Show" style:--at={Math.max(0, sides.findIndex((s) => s.key === active))}>
  <i class="switchthumb" aria-hidden="true"></i>
  {#each sides as side (side.key)}
    <button role="tab" aria-selected={active === side.key} class:on={active === side.key} onclick={() => onchoose(side.key)}>
      <svg class="switchicon" viewBox="0 0 24 24" aria-hidden="true">
        {#if side.icon === 'person'}<circle cx="12" cy="8" r="3.75" /><path d="M4.75 20c.6-3.9 3.6-6.25 7.25-6.25s6.65 2.35 7.25 6.25" />
        {:else if side.icon === 'monster'}<path d="M8.25 8.5 5 3.25l.75 6.25M15.75 8.5 19 3.25l-.75 6.25" /><circle cx="12" cy="14" r="6.25" /><path d="M9.75 13.5h.01M14.25 13.5h.01M10 17.25h4" />
        {:else}<path d="M5 21V3.75M5 4.5h12.5l-2.6 4 2.6 4H5" />{/if}
      </svg>
      <span>{side.key}</span>
      <span class="areacount">{side.count}</span>
      {#if side.live}
        <i class="here-dot" title="{side.live === 1 ? 'Someone is' : `${side.live} people are`} at one of your tables now"></i>
      {/if}
    </button>
  {/each}
</div>

<style>
  .areaswitch {
    position: relative; display: grid; grid-template-columns: 1fr 1fr; padding: 3px; flex: none;
    border-radius: 999px; border: 1px solid var(--line); background: var(--raised);
    box-sizing: border-box; min-height: var(--switch-h);
  }
  .switchthumb {
    position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc(50% - 3px); border-radius: 999px;
    border: 1px solid var(--a-edge); background: var(--a-wash);
    transform: translateX(calc(var(--at) * 100%)); transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  }
  button {
    position: relative; z-index: 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.4375rem;
    font: inherit; font-size: 0.875rem; color: var(--dim); cursor: pointer; white-space: nowrap;
    border: 0; background: none; border-radius: 999px; padding: 0.375rem 0.875rem;
    transition: color 0.2s ease, transform 0.08s ease;
  }
  button:hover { color: var(--a); }
  button:active { transform: translateY(1px); }
  button.on { color: var(--text); }
  button:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  .switchicon { width: 1rem; height: 1rem; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; flex: none; }
  button.on .switchicon { color: var(--a); }
  .areacount {
    font-size: 0.6875rem; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1;
    padding: 0.1875rem 0.4375rem; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); color: var(--dim);
    transition: color 0.2s ease, border-color 0.2s ease;
  }
  button.on .areacount { border-color: var(--a-edge); color: var(--a); }
</style>
