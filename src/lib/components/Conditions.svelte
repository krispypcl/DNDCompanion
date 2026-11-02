<script lang="ts">
  /**
   * What is currently affecting the character. Play state, like hit points:
   * the owner changes it from the sheet without entering edit mode, and it can
   * be undone. A viewer sees it only when there is something to see.
   */
  import { STANDARD_CONDITIONS, addCondition, cleanName, conditionUrl, isStandard, lookKey, lookOf, removeCondition } from '$lib/rules/conditions';
  import { slide } from 'svelte/transition';
  import { snapshot } from '$lib/stores/undo';
  import { flip } from 'svelte/animate';
  import { scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import type { ConditionLook, ConditionMotion, State } from '$lib/types';

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
  const SWATCHES = [
    { name: 'Pink', color: 'oklch(70% 0.19 350)' },
    { name: 'Red', color: 'oklch(60% 0.21 25)' },
    { name: 'Orange', color: 'oklch(70% 0.17 55)' },
    { name: 'Gold', color: 'oklch(84% 0.16 90)' },
    { name: 'Green', color: 'oklch(68% 0.18 145)' },
    { name: 'Teal', color: 'oklch(72% 0.12 190)' },
    { name: 'Blue', color: 'oklch(64% 0.15 250)' },
    { name: 'Purple', color: 'oklch(58% 0.19 300)' },
    { name: 'White', color: 'oklch(95% 0.01 286)' },
    { name: 'Shadow', color: 'oklch(18% 0.01 286)' }
  ];
  const MOTIONS: { value: ConditionMotion; label: string }[] = [
    { value: 'still', label: 'Still' },
    { value: 'pulse', label: 'Pulse' },
    { value: 'shimmer', label: 'Shimmer' },
    { value: 'heavy', label: 'Heavy' },
    { value: 'shiver', label: 'Shiver' }
  ];
  const lookFor = (name: string): ConditionLook => looks[lookKey(name)] ?? { color: '', motion: 'pulse' };
  function setLook(name: string, patch: Partial<ConditionLook>) {
    onlooks?.({ ...looks, [lookKey(name)]: { ...lookFor(name), ...patch } });
  }

  let draft = $state('');
  const active = $derived(sheetState.conditions ?? []);

  function add() {
    const name = cleanName(draft);
    const next = addCondition(sheetState, draft);
    draft = '';
    if (next === sheetState) return;
    snapshot(sheetState, 'Condition');
    onchange(next);
    // One of their own, with no tint chosen yet: ask what it looks like.
    if (onlooks && !isStandard(name) && !(lookKey(name) in looks)) {
      onlooks({ ...looks, [lookKey(name)]: { color: SWATCHES[0].color, motion: 'pulse' } });
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
      <ul aria-label="Active conditions">
        {#each active as name (name)}
          {@const href = conditionUrl(name)}
          <li class="chip" animate:flip={{ duration: 220, easing: cubicOut }}
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
      {@const look = lookFor(asking)}
      <div class="ask" transition:slide={{ duration: 200 }} role="group" aria-label="How {asking} tints the screen">
        <p>What colour is <b>{asking}</b>? It tints the bottom of the screen while it lasts.</p>
        <div class="swatches">
          {#each SWATCHES as sw (sw.name)}
            <button class="sw" style:--sw={sw.color} aria-label={sw.name} title={sw.name}
                    aria-pressed={look.color === sw.color} onclick={() => setLook(asking!, { color: sw.color })}></button>
          {/each}
          <label class="sw custom" title="Any colour">
            <input type="color" aria-label="Any colour"
                   value={look.color.startsWith('#') ? look.color : '#c060a0'}
                   oninput={(e) => setLook(asking!, { color: e.currentTarget.value })} />
          </label>
          <button class="sw nonebtn" aria-label="No tint" title="No tint"
                  aria-pressed={!look.color} onclick={() => setLook(asking!, { color: '' })}>⦸</button>
        </div>
        <div class="motions" role="radiogroup" aria-label="How it moves">
          {#each MOTIONS as m (m.value)}
            <button role="radio" aria-checked={look.motion === m.value} disabled={!look.color}
                    onclick={() => setLook(asking!, { motion: m.value })}>{m.label}</button>
          {/each}
        </div>
        <div class="done"><button class="go" onclick={() => (asking = null)}>Done</button></div>
      </div>
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
  .sw[aria-pressed='true'] { border-color: var(--surface); outline: 2px solid var(--a); }
  .custom { background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red); }
  .custom input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
  .nonebtn { background: var(--bg); color: var(--dim); font-size: 0.875rem; line-height: 1; }
  .motions { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .motions button {
    background: var(--bg); border: 1px solid var(--line); color: var(--dim); border-radius: 999px;
    padding: 0.1875rem 0.625rem; font: inherit; font-size: 0.75rem; cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
  }
  .motions button[aria-checked='true'] { color: var(--a); border-color: var(--a-edge); background: var(--a-wash); }
  .motions button:disabled { opacity: 0.4; cursor: default; }
  .done { display: flex; justify-content: flex-end; margin-top: 0.5rem; }
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
    .sw { width: 2rem; height: 2rem; }
    .dot { width: 1rem; height: 1rem; }
    .motions button { padding: 0.375rem 0.75rem; font-size: 0.8125rem; }
  }
</style>
