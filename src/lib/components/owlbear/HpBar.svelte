<script lang="ts">
  /**
   * A character's hit points in the Owlbear panel and token menu: the bar
   * fills to their current hit points, and temporary ones follow on as a
   * blue stretch of their own (the bar grows to hold them), with the count
   * beside it and the temporary ones in their own small tag. A change from
   * the table flashes it: red for a hit, green for healing.
   */
  let { cur, max, temp = 0, vital = 'healthy' }: { cur: number; max: number; temp?: number; vital?: string } = $props();
  const total = $derived(Math.max(max, cur + temp, 1));

  let flash = $state<'' | 'hit' | 'heal'>('');
  let last: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const now = cur + temp;
    if (last !== null && now !== last) {
      flash = '';
      // A frame between, so the same flash twice in a row plays twice.
      requestAnimationFrame(() => (flash = now < last! ? 'hit' : 'heal'));
      clearTimeout(timer);
      timer = setTimeout(() => (flash = ''), 900);
    }
    last = now;
    return () => clearTimeout(timer);
  });
</script>

<div class="hp {vital}" class:hit={flash === 'hit'} class:heal={flash === 'heal'}>
  <span class="bar" aria-hidden="true">
    <span class="fill" style:width="{(Math.min(cur, total) / total) * 100}%"></span>
    {#if temp > 0}<span class="temp" style:left="{(Math.min(cur, total) / total) * 100}%" style:width="{(temp / total) * 100}%"></span>{/if}
  </span>
  <span class="nums"><b>{cur}</b>/{max}</span>
  {#if temp > 0}<span class="tag" title="Temporary hit points">+{temp} temp</span>{/if}
</div>

<style>
  .hp { --hurt-red: oklch(64% 0.21 25); --temp: oklch(66% 0.14 245); display: flex; align-items: center; gap: 0.4375rem; min-width: 0; flex: 1 1 auto; width: 100%; }
  .bar { position: relative; flex: 1; min-width: 2.5rem; height: 0.4375rem; border-radius: 999px; background: color-mix(in oklch, var(--text) 13%, transparent); overflow: hidden; }
  .fill, .temp { position: absolute; top: 0; bottom: 0; transition: width 0.5s cubic-bezier(0.2, 0.8, 0.25, 1), left 0.5s cubic-bezier(0.2, 0.8, 0.25, 1), background-color 0.4s ease; }
  .fill { left: 0; background: oklch(66% 0.16 150); }
  .bloodied .fill { background: oklch(74% 0.15 75); }
  .critical .fill, .down .fill { background: var(--hurt-red); }
  .temp { background: var(--temp); box-shadow: inset 1.5px 0 0 color-mix(in oklch, var(--bg) 70%, transparent); }
  .hit .bar { animation: hp-hit 0.6s ease-out; }
  .heal .bar { animation: hp-heal 0.8s ease-out; }
  .hit .nums b { animation: hp-num 0.5s ease-out; color: var(--hurt-red); transition: color 0.6s ease; }
  @keyframes hp-hit {
    0% { box-shadow: 0 0 0 0 color-mix(in oklch, var(--hurt-red) 70%, transparent); transform: translateX(0); }
    20% { transform: translateX(-2px); }
    40% { transform: translateX(2px); }
    60% { transform: translateX(-1px); }
    100% { box-shadow: 0 0 0 5px transparent; transform: none; }
  }
  @keyframes hp-heal {
    from { box-shadow: 0 0 0 0 color-mix(in oklch, oklch(66% 0.16 150) 70%, transparent); }
    to { box-shadow: 0 0 0 6px transparent; }
  }
  @keyframes hp-num { 30% { transform: scale(1.18); } }
  .nums b { display: inline-block; }
  .nums { font-size: 0.8125rem; color: var(--dim); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .nums b { color: var(--text); }
  .tag {
    flex: none; font-size: 0.6875rem; line-height: 1.3; padding: 0 0.375rem; border-radius: 999px; white-space: nowrap;
    color: var(--temp); border: 1px solid color-mix(in oklch, var(--temp) 50%, transparent);
    background: color-mix(in oklch, var(--temp) 12%, transparent);
  }
</style>
