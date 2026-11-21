<!--
  A stat block's six ability scores, each with its modifier under it
  (rules/statblock). Inside the stat block editor, or beside a creature's
  name in the M&N window.
-->
<script lang="ts">
  import { ABILITIES, modifier, signedMod, type StatBlock } from '#lib/rules/statblock.ts';

  let { value = $bindable() }: { value: StatBlock } = $props();

  function setScore(a: (typeof ABILITIES)[number], v: string) {
    const n = Number(v);
    value = { ...value, [a]: v === '' || !Number.isFinite(n) ? undefined : n };
  }
</script>

<div class="sbescores" role="group" aria-label="Ability scores">
  {#each ABILITIES as a (a)}
    <label><span>{a.toUpperCase()}</span>
      <input class="numfield" type="number" min="1" max="30" inputmode="numeric" value={value[a] ?? ''} placeholder="10"
             oninput={(e) => setScore(a, e.currentTarget.value)} />
      <i>{signedMod(modifier(value[a]))}</i>
    </label>
  {/each}
</div>

<style>
  .sbescores { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.375rem; min-width: 0; }
  label {
    display: grid; gap: 0.25rem; justify-items: center; text-align: center; min-width: 0; padding: 0.375rem;
    font-size: 0.75rem; color: var(--label); border-radius: var(--r-sm); background: var(--raised); border: 1px solid var(--line-soft);
  }
  span { font-weight: 650; letter-spacing: 0.08em; font-size: 0.625rem; }
  input {
    font: inherit; font-size: 0.8125rem; color: var(--text); min-width: 0; width: 100%; text-align: center; padding: 0.25rem;
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg); transition: border-color 0.15s ease;
  }
  input:hover { border-color: var(--a-edge); }
  input:focus { outline: none; border-color: var(--a-edge); }
  i { font-style: normal; font-size: 0.6875rem; color: var(--dim); }
  @media (max-width: 480px) { .sbescores { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
