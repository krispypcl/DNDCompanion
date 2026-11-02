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
    onadd
  }: { definition: Definition; makeId: () => string; onadd: (added: Tracker[], label: string) => void } = $props();

  let open = $state(false);
  const groups = $derived(presetsFor(classList(definition).map((c) => c.name)));
  const levels = $derived(classLevels(definition));
  const key = (t: { label: string; class?: string }) => `${t.label.toLowerCase()}|${(t.class ?? '').toLowerCase()}`;
  const have = $derived(new Set((definition.trackers ?? []).map(key)));

  /** Already on the sheet: every tracker it would add is there. */
  function added(p: Preset): boolean {
    return p.build(1).every((t) => have.has(key(t)));
  }
  function add(p: Preset) {
    const level = levels[p.className.toLowerCase()] ?? 0;
    const fresh = buildPreset(p, level, makeId).filter((t) => !have.has(key(t)));
    if (fresh.length) onadd(fresh, p.label);
  }
  const still = prefersReducedMotion();
</script>

<div class="presets">
  <button class="opener" aria-expanded={open} onclick={() => (open = !open)}>
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="currentColor" />
    </svg>
    Ready-made trackers
    <i class="chev" class:up={open} aria-hidden="true">▾</i>
  </button>

  {#if open}
    <div class="panel" transition:slide={{ duration: still ? 0 : 240, easing: cubicOut }}>
      {#each [{ title: 'For your classes', list: groups.yours }, { title: 'Other classes', list: groups.others }] as g (g.title)}
        {#if g.list.length}
          <h4>{g.title}</h4>
          <div class="grid">
            {#each g.list as p (p.id)}
              {@const done = added(p)}
              <button class="preset" class:done disabled={done} onclick={() => add(p)}
                      title={done ? 'Already on this sheet' : `Add ${p.label}`}>
                <b>{p.label}</b>
                <span>{done ? 'Added' : p.blurb}</span>
              </button>
            {/each}
          </div>
        {/if}
      {/each}
      <p class="note">Numbers follow the 2024 Player’s Handbook and grow with the class’s level.
        A die or rest that changes with level is set for the level you are now.</p>
    </div>
  {/if}
</div>

<style>
  .presets { margin-top: 0.75rem; }
  .opener {
    display: inline-flex; align-items: center; gap: 0.4375rem; font: inherit; font-size: 0.8125rem;
    background: var(--a-wash); border: 1px solid var(--a-edge); color: var(--a); border-radius: var(--r-sm);
    padding: 0.375rem 0.75rem; cursor: pointer; animation: openerIn 0.3s cubic-bezier(0.2, 0.8, 0.3, 1) backwards;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.08s ease;
  }
  @keyframes openerIn { from { opacity: 0; transform: translateY(-4px); } }
  .opener:hover { border-color: var(--a); color: var(--a-hi); }
  .opener:active { transform: translateY(1px); }
  .chev { font-style: normal; font-size: 0.7rem; transition: transform 0.2s ease; }
  .chev.up { transform: rotate(180deg); }
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
  .preset.done { opacity: 0.55; cursor: default; }
  .preset.done span { color: var(--a); }
  .note { margin: 0.75rem 0 0; font-size: 0.72rem; color: var(--faint); line-height: 1.45; }
</style>
