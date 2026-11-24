<!--
  Giving conditions (in a DimModal): every standard condition as a chip in
  its own color, pressed when given, and a field for one of your own. The
  campaign page uses it for characters and for monsters and NPCs alike; the
  window's × closes it.
-->
<script lang="ts">
  import { STANDARD_CONDITIONS, lookOf } from '#lib/rules/conditions.ts';

  let { given, ontoggle, onadd }: {
    given: string[];
    ontoggle: (name: string) => void;
    onadd: (name: string) => void;
  } = $props();

  let custom = $state('');
  const has = (name: string) => given.some((c) => c.toLowerCase() === name.toLowerCase());
  function add() {
    const name = custom.trim();
    custom = '';
    if (name) onadd(name);
  }
</script>

<div class="grid">
  {#each STANDARD_CONDITIONS as name (name)}
    <button class="opt" class:on={has(name)} aria-pressed={has(name)} style:--cc={lookOf(name)?.color}
            onclick={() => ontoggle(name)}><span class="dot" aria-hidden="true"></span>{name}</button>
  {/each}
</div>
<div class="own">
  <input bind:value={custom} placeholder="Something else, e.g. Bless" aria-label="Another condition"
         onkeydown={(e) => { if (e.key === 'Enter') add(); }} />
  <button class="give" onclick={add} disabled={!custom.trim()}>Give</button>
</div>

<style>
  .dot {
    flex: none; width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--cc, var(--dim));
    box-shadow: 0 0 0 1px color-mix(in oklch, var(--text) 25%, transparent);
  }
  :global([data-mode='light']) .dot { box-shadow: 0 0 0 1px color-mix(in oklch, var(--text) 35%, transparent); }
  .grid { display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .opt {
    --cc: var(--dim);
    display: inline-flex; align-items: center; gap: 0.375rem; font: inherit; font-size: 0.8125rem; cursor: pointer;
    padding: 0.3125rem 0.625rem; border-radius: 999px; color: var(--dim);
    border: 1px solid var(--line-soft); background: var(--surface);
    transition: background-color 0.15s var(--ease-out), border-color 0.15s var(--ease-out), color 0.15s var(--ease-out);
  }
  .opt:hover { color: var(--text); border-color: color-mix(in oklab, var(--cc) 50%, var(--line)); }
  .opt:active, .own button:active:not(:disabled) { transform: translateY(1px); }
  .opt:focus-visible, .own button:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  /* Given: tinted in its color and ringed, the ring mixed toward the text so
     a dark color (Blinded, Dead) still shows on a dark page, as a light one does on a light page. */
  .opt.on {
    color: var(--text); border-color: color-mix(in oklab, var(--cc) 65%, var(--text));
    background: color-mix(in oklab, var(--cc) 22%, var(--raised));
    box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--cc) 65%, var(--text));
  }
  .own { display: flex; gap: 0.375rem; margin-top: 1rem; }
  .own input {
    flex: 1; min-width: 0; font: inherit; font-size: 0.8125rem; padding: 0.3125rem 0.5rem; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  .own input:focus { outline: none; border-color: var(--a-edge); }
  .own button {
    font: inherit; font-size: 0.8125rem; cursor: pointer; border-radius: var(--r-sm); padding: 0.3125rem 0.625rem;
    border: 1px solid var(--a-edge); background: var(--a-wash); color: var(--a);
    transition: border-color 0.15s var(--ease-out), background-color 0.15s var(--ease-out), transform 0.1s var(--ease-out);
  }
  .own button:hover:not(:disabled) { border-color: var(--a); }
  .own button:disabled { opacity: 0.5; cursor: default; }

</style>
