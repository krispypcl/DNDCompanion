<script lang="ts">
  /** Coins. Lives in the rail rather than the Equipment tab, which is then
      only the things you carry. */
  import type { Definition } from '$lib/types';

  let {
    definition,
    editable,
    onchange
  }: { definition: Definition; editable: boolean; onchange: (next: Definition) => void } = $props();

  const COINS = ['pp', 'gp', 'ep', 'sp', 'cp'] as const;

  function setCoin(coin: string, value: string) {
    onchange({ ...definition, currency: { ...definition.currency, [coin]: Number(value) } });
  }
</script>

<div class="coins">
  {#each COINS as coin (coin)}
    <label>
      <span class="cap">{coin}</span>
      {#if editable}
        <input
          type="number"
          aria-label="{coin} coins"
          value={definition.currency?.[coin] ?? 0}
          onchange={(e) => setCoin(coin, e.currentTarget.value)}
        />
      {:else}
        <strong>{definition.currency?.[coin] ?? 0}</strong>
      {/if}
    </label>
  {/each}
</div>

<style>
  .coins { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.375rem; }
  label { display: block; text-align: center; min-width: 0; }
  .cap {
    display: block; font-size: 0.6875rem; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--label); font-weight: 600;
  }
  strong, input {
    display: block; width: 100%; text-align: center; font-size: 0.9375rem;
    font-weight: 600; font-variant-numeric: tabular-nums; margin-top: 0.1875rem;
    box-sizing: border-box;
  }
  input {
    background: var(--bg); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); padding: 0.1875rem 0.125rem; font-family: inherit;
    -moz-appearance: textfield; appearance: textfield;
  }
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  strong { border: 1px solid transparent; padding: 0.1875rem 0.125rem; }

  @media (max-width: 700px) {
    /* 15px is under the threshold at which a phone zooms in on focus, and
       both states move together so the row keeps its height. */
    strong, input { font-size: 1rem; }
  }
</style>
