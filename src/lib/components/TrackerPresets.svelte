<script lang="ts">
  /**
   * Ready-made trackers, in edit mode under the trackers table: spell slots
   * and class resources, with the ones for the character's own classes first.
   * Each adds ordinary trackers that can be changed like any other.
   */
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { classLevels, classList } from '$lib/rules/derived';
  import { buildPreset, presetsFor, type Preset } from '$lib/rules/presets';
  import { prefersReducedMotion } from '$lib/motion';
  import type { Definition, Tracker } from '$lib/types';

  let {
    definition,
    makeId,
    open,
    onadd,
    onremove
  }: {
    definition: Definition;
    makeId: () => string;
    /** Whether the list is showing; its button sits in the table's add row. */
    open: boolean;
    onadd: (added: Tracker[], label: string) => void;
    /** Takes back the trackers a preset added. */
    onremove: (ids: string[], label: string) => void;
  } = $props();
  const groups = $derived(presetsFor(classList(definition).map((c) => c.name)));
  const levels = $derived(classLevels(definition));
  const key = (t: { label: string; class?: string }) => `${t.label.toLowerCase()}|${(t.class ?? '').toLowerCase()}`;
  const have = $derived(new Set((definition.trackers ?? []).map(key)));

  /** Already on the sheet: every tracker it would add is there. */
  function added(p: Preset): boolean {
    return p.build(1).every((t) => have.has(key(t)));
  }
  /** Pressed once it adds; pressed again it takes the same trackers away. */
  function toggle(p: Preset) {
    if (added(p)) {
      const keys = new Set(p.build(1).map(key));
      const ids = (definition.trackers ?? []).filter((t) => keys.has(key(t))).map((t) => t.id);
      onremove(ids, p.label);
      return;
    }
    const level = levels[p.className.toLowerCase()] ?? 0;
    const fresh = buildPreset(p, level, makeId).filter((t) => !have.has(key(t)));
    if (fresh.length) onadd(fresh, p.label);
  }
  const mine = $derived(new Set(groups.yours.map((p) => p.id)));
  const still = prefersReducedMotion();
</script>

{#if open}
    <div class="panel" transition:slide={{ duration: still ? 0 : 240, easing: cubicOut }}>
      {#each [{ title: 'For your classes', list: groups.yours }, { title: 'Other classes', list: groups.others }] as g (g.title)}
        {#if g.list.length}
          <h4>{g.title}</h4>
          <div class="grid">
            {#each g.list as p (p.id)}
              {@const done = added(p)}
              <button class="preset" class:done aria-pressed={done} onclick={() => toggle(p)}
                      title={done ? `Remove ${p.label}` : `Add ${p.label}`}>
                <b>{p.label}</b>
                <span>{done ? 'Added · press again to remove' : p.blurb}</span>
                {#if !mine.has(p.id)}<em>Counts {p.className} levels: none on this sheet yet</em>{/if}
              </button>
            {/each}
          </div>
        {/if}
      {/each}
      <p class="note">Each tracker counts the level of its own class, set in its Class column
        and taken from the classes on the Character tab.<br />Numbers follow the 2024 Player’s Handbook and grow with the class’s level.
        A die or rest that changes with level is set for the level you are now.</p>
    </div>
{/if}

<style>
  .panel { margin-top: 0.625rem; padding: 0.75rem; border: 1px solid var(--line-soft); border-radius: var(--r); background: var(--raised); }
  h4 {
    margin: 0 0 0.5rem; font-size: 0.6875rem; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--label); font-weight: 600;
  }
  h4:not(:first-child) { margin-top: 0.875rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: 0.375rem; }
  .preset {
    text-align: left; font: inherit; display: grid; gap: 0.125rem; cursor: pointer;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 0.5rem 0.625rem;
    color: var(--text); transition: border-color 0.15s ease, transform 0.15s ease, background-color 0.15s ease;
  }
  .preset b { font-size: 0.8125rem; font-weight: 600; }
  .preset span { font-size: 0.72rem; color: var(--dim); line-height: 1.35; }
  .preset:hover:not(:disabled) { border-color: var(--a-edge); transform: translateY(-1px); }
  .preset.done { border-color: var(--a-edge); background: var(--a-wash); }
  .preset.done span { color: var(--a); }
  .preset em { font-style: normal; font-size: 0.68rem; color: var(--faint); }
  .note { margin: 0.75rem 0 0; font-size: 0.72rem; color: var(--faint); line-height: 1.45; }
</style>
