<script lang="ts">
  /**
   * How a condition of the player's own looks: its colour (one of the
   * swatches, any colour, or none) and how its tint moves at the bottom of
   * the screen. The sheet's owner sets it when they add one; on the campaign
   * page, the DM does for the conditions they give.
   */
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion } from '$lib/motion';
  import { CONDITION_MOTIONS as MOTIONS, CONDITION_SWATCHES as SWATCHES } from '$lib/rules/conditions';
  import type { ConditionLook } from '$lib/types';

  let {
    name,
    look,
    who = '',
    onchange,
    ondone
  }: {
    name: string;
    look: ConditionLook;
    /** Whose screen it tints, when it is not the reader's own (the DM's view). */
    who?: string;
    onchange: (patch: Partial<ConditionLook>) => void;
    ondone: () => void;
  } = $props();

</script>

<div class="ask" transition:slide={{ duration: prefersReducedMotion() ? 0 : 200, easing: cubicOut }} role="group" aria-label="How {name} tints the screen">
  <p>What colour is <b>{name}</b>? It tints the bottom of {who ? `${who}’s` : 'the'} screen while it lasts.</p>
  <div class="swatches">
    {#each SWATCHES as sw (sw.name)}
      <button class="sw" style:--sw={sw.color} aria-label={sw.name} title={sw.name}
              aria-pressed={look.color === sw.color} onclick={() => onchange({ color: sw.color })}></button>
    {/each}
    <label class="sw custom" title="Any colour">
      <input type="color" aria-label="Any colour"
             value={look.color.startsWith('#') ? look.color : '#c060a0'}
             oninput={(e) => onchange({ color: e.currentTarget.value })} />
    </label>
    <button class="sw nonebtn" aria-label="No tint" title="No tint"
            aria-pressed={!look.color} onclick={() => onchange({ color: '' })}>⦸</button>
  </div>
  <div class="motions" role="radiogroup" aria-label="How it moves">
    {#each MOTIONS as m (m.value)}
      <button role="radio" aria-checked={look.motion === m.value} disabled={!look.color}
              onclick={() => onchange({ motion: m.value })}>{m.label}</button>
    {/each}
  </div>
  <div class="done"><button class="go" onclick={ondone}>Done</button></div>
</div>

<style>
  .ask {
    background: var(--raised); border: 1px solid var(--line-soft); border-radius: var(--r);
    padding: 0.625rem 0.75rem; margin: 0 0 0.5rem; font-size: 0.8125rem;
  }
  .ask p { margin: 0 0 0.5rem; color: var(--dim); line-height: 1.4; }
  .ask b { color: var(--text); font-weight: 600; }
  .swatches { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-bottom: 0.5rem; }
  .sw {
    width: 1.5rem; height: 1.5rem; border-radius: 50%; padding: 0; cursor: pointer;
    background: var(--sw); border: 2px solid transparent; outline: 1px solid var(--line);
    transition: transform 0.15s ease, border-color 0.15s ease; position: relative; overflow: hidden;
    display: inline-grid; place-items: center;
  }
  .sw:hover { transform: scale(1.12); }
  .sw:active { transform: scale(1.04) translateY(1px); }
  .sw:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  .sw[aria-pressed='true'] { border-color: var(--surface); outline: 2px solid var(--a); }
  .custom { background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red); }
  .custom:focus-within { outline: 2px solid var(--a); outline-offset: 1px; }
  .custom input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
  .nonebtn { background: var(--bg); color: var(--dim); font-size: 0.875rem; line-height: 1; }
  .motions { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .motions button {
    background: var(--bg); border: 1px solid var(--line); color: var(--dim); border-radius: 999px;
    padding: 0.1875rem 0.625rem; font: inherit; font-size: 0.75rem; cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease, transform 0.1s ease;
  }
  .motions button:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  .motions button:active:not(:disabled) { transform: translateY(1px); }
  .motions button:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  .motions button[aria-checked='true'] { color: var(--a); border-color: var(--a-edge); background: var(--a-wash); }
  .motions button:disabled { opacity: 0.4; cursor: default; }
  .done { display: flex; justify-content: flex-end; margin-top: 0.5rem; }
  .go {
    flex: none; background: var(--raised); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); padding: 0.3125rem 0.75rem; font: inherit; font-size: 0.8125rem;
    cursor: pointer; transition: border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
  }
  .go:hover { border-color: var(--a-edge); color: var(--a); }
  .go:active { transform: translateY(1px); }
  .go:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  @media (max-width: 700px) {
    .sw { width: 2rem; height: 2rem; }
    .motions button { padding: 0.375rem 0.75rem; font-size: 0.8125rem; }
    .go { padding: 0.4rem 0.875rem; }
  }
</style>
