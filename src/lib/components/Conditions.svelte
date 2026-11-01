<script lang="ts">
  /**
   * What is currently affecting the character. Play state, like hit points:
   * the owner changes it from the sheet without entering edit mode, and it can
   * be undone. A viewer sees it only when there is something to see.
   */
  import { STANDARD_CONDITIONS, addCondition, conditionUrl, removeCondition } from '$lib/rules/conditions';
  import { snapshot } from '$lib/stores/undo';
  import { flip } from 'svelte/animate';
  import { scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import type { State } from '$lib/types';

  let {
    state: sheetState,
    editable,
    onchange
  }: {
    state: State;
    /** The owner. Anyone else just reads the chips. */
    editable: boolean;
    onchange: (next: State) => void;
  } = $props();

  let draft = $state('');
  const active = $derived(sheetState.conditions ?? []);

  function add() {
    const next = addCondition(sheetState, draft);
    draft = '';
    if (next === sheetState) return;
    snapshot(sheetState, 'Condition');
    onchange(next);
  }

  function remove(name: string) {
    snapshot(sheetState, 'Condition');
    onchange(removeCondition(sheetState, name));
  }

  function onkey(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    }
  }
</script>

{#if editable || active.length > 0}
  <div class="conditions">
    <h2 class="cap">Conditions</h2>

    {#if active.length > 0}
      <ul aria-label="Active conditions">
        {#each active as name (name)}
          {@const href = conditionUrl(name)}
          <li class="chip" animate:flip={{ duration: 220, easing: cubicOut }}
              in:scale={{ start: 0.6, duration: 240, easing: cubicOut }}
              out:scale={{ start: 0.6, duration: 160 }}>
            {#if href}
              <a {href} target="_blank" rel="noopener noreferrer" title="Look up {name} on 5e.tools">{name}</a>
            {:else}
              <span>{name}</span>
            {/if}
            {#if editable}
              <button class="x" aria-label="Remove {name}" onclick={() => remove(name)}>×</button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    {#if editable}
      <div class="add">
        <input
          list="standard-conditions"
          bind:value={draft}
          onkeydown={onkey}
          placeholder="Add a condition or effect"
          aria-label="Add a condition or effect"
          maxlength="40"
        />
        <datalist id="standard-conditions">
          {#each STANDARD_CONDITIONS as c (c)}<option value={c}></option>{/each}
        </datalist>
        <button class="go" onclick={add} disabled={!draft.trim()}>Add</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .conditions { padding-top: 1.25rem; }
  .cap {
    display: block; font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--label); font-weight: 600; margin: 0 0 0.625rem;
  }
  ul { list-style: none; margin: 0 0 0.5rem; padding: 0; display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .chip {
    display: inline-flex; align-items: center; gap: 0.25rem;
    background: var(--a-wash); border: 1px solid var(--a-edge); color: var(--text);
    border-radius: 999px; padding: 0.125rem 0.25rem 0.125rem 0.625rem;
    font-size: 0.8125rem; line-height: 1.5;
  }
  /* A chip with nothing to press has nothing to be padded for on the right. */
  .chip:not(:has(.x)) { padding-right: 0.625rem; }
  .chip a { color: inherit; text-decoration: none; }
  .chip a:hover { color: var(--a); text-decoration: underline; text-underline-offset: 2px; }
  .x {
    background: none; border: 0; color: var(--dim); cursor: pointer;
    font-size: 1rem; line-height: 1; width: 1.25rem; height: 1.25rem;
    border-radius: 50%; padding: 0; display: inline-grid; place-items: center;
    transition: color 0.15s ease, background-color 0.15s ease;
  }
  .x:hover { color: var(--danger); background: var(--raised); }

  .add { display: flex; gap: 0.375rem; }
  input {
    flex: 1 1 auto; min-width: 0; background: var(--bg); border: 1px solid var(--line);
    color: var(--text); border-radius: var(--r-sm); padding: 0.3125rem 0.5rem;
    font: inherit; font-size: 0.8125rem;
    transition: border-color 0.15s ease;
  }
  input:hover { border-color: var(--a-edge); }
  input::placeholder { color: var(--dim); opacity: 0.7; }
  /* The suggestions stay; Chrome's arrow at the end of the field does not. */
  input::-webkit-calendar-picker-indicator { display: none !important; }
  input::-webkit-list-button { display: none !important; }
  .go {
    flex: none; background: var(--raised); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); padding: 0.3125rem 0.75rem; font: inherit; font-size: 0.8125rem;
    cursor: pointer; transition: border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
  }
  .go:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  .go:disabled { opacity: 0.45; cursor: default; }

  @media (max-width: 700px) {
    /* Under 16px a phone zooms in when a field takes focus. */
    input { font-size: 16px; padding: 0.4rem 0.5rem; }
    .go { padding: 0.4rem 0.875rem; }
    .x { width: 1.75rem; height: 1.75rem; font-size: 1.125rem; }
  }
</style>
