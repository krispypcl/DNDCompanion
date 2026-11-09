<script lang="ts">
  /**
   * What is currently affecting the character. Play state, like hit points:
   * the owner changes it from the sheet without entering edit mode, and it can
   * be undone. A viewer sees it only when there is something to see.
   */
  import { STANDARD_CONDITIONS, defaultLook, addCondition, cleanName, conditionUrl, isStandard, lookKey, lookOf, removeCondition } from '$lib/rules/conditions';
  import { snapshot } from '$lib/stores/undo';
  import { flip } from 'svelte/animate';
  import { scale } from 'svelte/transition';
  import { cubicOut, quintOut } from 'svelte/easing';
  import { reorder } from '$lib/reorder';
  import ConditionLookPicker from './ConditionLookPicker.svelte';
  import type { ConditionLook, State } from '$lib/types';

  let {
    state: sheetState,
    editable,
    onchange,
    looks = {},
    onlooks
  }: {
    state: State;
    /** The owner. Anyone else just reads the chips. */
    editable: boolean;
    onchange: (next: State) => void;
    /** The tints chosen for conditions written in by hand. */
    looks?: Record<string, ConditionLook>;
    onlooks?: (next: Record<string, ConditionLook>) => void;
  } = $props();

  /** A condition of the player's own: its tint is asked for when it is added. */
  let asking = $state<string | null>(null);
  const lookFor = (name: string): ConditionLook => looks[lookKey(name)] ?? { color: '', motion: 'pulse' };
  function setLook(name: string, patch: Partial<ConditionLook>) {
    onlooks?.({ ...looks, [lookKey(name)]: { ...lookFor(name), ...patch } });
  }

  let draft = $state('');
  const active = $derived(sheetState.conditions ?? []);
  /** While a chip is being moved, the order it would land in. */
  let preview = $state<string[] | null>(null);
  const shown = $derived(preview ?? active);
  function reordered(order: string[]) {
    snapshot(sheetState, 'Condition order');
    onchange({ ...sheetState, conditions: order });
  }

  function add() {
    const name = cleanName(draft);
    const next = addCondition(sheetState, draft);
    draft = '';
    if (next === sheetState) return;
    snapshot(sheetState, 'Condition');
    onchange(next);
    // One of their own, with no tint chosen yet: ask what it looks like.
    if (onlooks && !isStandard(name) && !(lookKey(name) in looks)) {
      onlooks({ ...looks, [lookKey(name)]: defaultLook() });
      asking = name;
    }
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
      <!-- The owner moves a chip by picking it up: dragged, or held then dragged. -->
      <ul aria-label="Active conditions" class:can-reorder={editable && active.length > 1}
          use:reorder={{ enabled: editable, keys: active, onpreview: (k) => (preview = k), oncommit: reordered }}>
        {#each shown as name (name)}
          {@const href = conditionUrl(name)}
          <li class="chip" data-key={name} animate:flip={{ duration: 300, easing: quintOut }}
              in:scale={{ start: 0.6, duration: 240, easing: cubicOut }}
              out:scale={{ start: 0.6, duration: 160 }}>
            {#if editable && onlooks && !isStandard(name)}
              <!-- Its own tint, chosen by the player: the dot reopens the choice. -->
              <button class="dot" class:none={!lookOf(name, looks)} style:--dot={lookOf(name, looks)?.color}
                      aria-label="Choose how {name} tints the screen" title="Tint"
                      onclick={() => (asking = asking === name ? null : name)}></button>
            {/if}
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

    {#if editable && asking && active.includes(asking)}
      <ConditionLookPicker name={asking} look={lookFor(asking)} onchange={(patch) => setLook(asking!, patch)} ondone={() => (asking = null)} />
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
  .dot {
    width: 0.75rem; height: 0.75rem; border-radius: 50%; padding: 0; margin-right: 0.125rem;
    border: 1px solid color-mix(in oklch, var(--text) 30%, transparent); background: var(--dot); cursor: pointer;
    transition: transform 0.15s ease;
  }
  .dot:hover { transform: scale(1.25); }
  .dot.none { background: none; border-style: dashed; }
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
    .dot { width: 1rem; height: 1rem; }
  }
</style>
