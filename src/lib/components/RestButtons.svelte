<script lang="ts">
  import { applyRest } from '$lib/rules/rest';
  import { snapshot } from '$lib/stores/undo';
  import type { Definition, RestKind, State } from '$lib/types';

  let {
    definition,
    state,
    editable,
    onchange,
    onrest
  }: {
    definition: Definition;
    state: State;
    editable: boolean;
    onchange: (next: State) => void;
    onrest: (label: string) => void;
  } = $props();

  const LABELS: Record<RestKind, string> = {
    short: 'Short Rest',
    long: 'Long Rest',
    dawn: 'Dawn'
  };

  function rest(kind: RestKind) {
    if (!editable) return;
    snapshot(state, LABELS[kind]);
    onchange(applyRest(definition, state, kind));
    onrest(`${LABELS[kind]} taken`);
  }
</script>

<div class="rests">
  {#each Object.keys(LABELS) as RestKind[] as kind (kind)}
    <button disabled={!editable} onclick={() => rest(kind)}>{LABELS[kind]}</button>
  {/each}
</div>

<style>
  .rests { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  button {
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--text);
    border-radius: 6px;
    padding: 0.4rem 0.8rem;
    font: inherit;
    font-size: 0.875rem;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  button:disabled { opacity: 0.5; cursor: default; }
</style>
