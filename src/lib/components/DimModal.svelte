<!--
  A window over the page, the page dimmed and blurred behind it (as behind a
  picture opened from Appearance). It eases in, rising a little as it grows,
  and fades back out; a press on the dimmed page, Esc, or the window's own
  Done closes it. Its title is what you drag to move it.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { focusFirst, movable, portal } from '$lib/actions';
  import { prefersReducedMotion } from '$lib/motion';

  let { id, title, onclose, children }: { id: string; title: string; onclose: () => void; children: Snippet } = $props();

  /** In: grows from just under its size and rises into place. Out: a quick fade, shrinking a touch. */
  function rise(_node: Element, { out = false } = {}) {
    const still = prefersReducedMotion();
    return {
      duration: still ? 0 : out ? 150 : 260,
      easing: cubicOut,
      css: (t: number) => `opacity: ${t}; transform: translateY(${(1 - t) * (out ? 4 : 10)}px) scale(${(out ? 0.985 : 0.965) + (1 - (out ? 0.985 : 0.965)) * t});`
    };
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onclose(); } }} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="dimscrim" use:portal transition:fade={{ duration: prefersReducedMotion() ? 0 : 200, easing: cubicOut }}
     onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}>
  <div class="dimwindow themed-scroll" role="dialog" aria-modal="true" aria-labelledby={id} use:movable use:focusFirst
       in:rise out:rise={{ out: true }}>
    <h2 {id}>{title}</h2>
    {@render children()}
  </div>
</div>

<style>
  .dimscrim {
    position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 1rem;
    background: rgb(0 0 0 / 0.78); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  }
  .dimwindow {
    width: min(30rem, 100%); max-height: calc(100vh - 2rem); overflow-y: auto;
    padding: 1.125rem 1.25rem 1.25rem; border-radius: var(--r);
    background: var(--surface); border: 1px solid var(--line); box-shadow: 0 24px 60px rgb(0 0 0 / 0.5);
  }
  h2 { margin: 0 0 0.875rem; font-size: 1rem; font-weight: 650; color: var(--a); overflow-wrap: anywhere; }
</style>
