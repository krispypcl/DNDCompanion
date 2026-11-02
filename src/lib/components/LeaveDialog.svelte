<script lang="ts">
  /** Asked only when leaving would lose something: a change that could not be saved. */
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion } from '$lib/motion';

  let { onstay, onleave }: { onstay: () => void; onleave: () => void } = $props();
  const still = prefersReducedMotion();
  let stay: HTMLButtonElement | undefined = $state();

  onMount(() => {
    stay?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onstay();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });
</script>

<div class="scrim" transition:fade={{ duration: still ? 0 : 160 }}
     onclick={(e) => { if (e.target === e.currentTarget) onstay(); }} role="presentation">
  <div class="box" role="alertdialog" aria-modal="true" aria-labelledby="leave-title" aria-describedby="leave-text"
       transition:scale={{ start: 0.95, duration: still ? 0 : 200, easing: cubicOut }}>
    <h2 id="leave-title">Your latest changes are not saved</h2>
    <p id="leave-text">
      They could not be saved just now. If you stay, they will be saved as soon as they can be.
      If you leave, they are lost.
    </p>
    <div class="row">
      <button class="leave" onclick={onleave}>Leave anyway</button>
      <button class="stay" bind:this={stay} onclick={onstay}>Stay</button>
    </div>
  </div>
</div>

<style>
  .scrim {
    position: fixed; inset: 0; z-index: 55; display: grid; place-items: center; padding: 1rem;
    background: rgb(0 0 0 / 0.55); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
  }
  .box {
    width: min(26rem, 100%); background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--r); padding: 1.25rem; box-shadow: 0 20px 60px rgb(0 0 0 / 0.45);
  }
  h2 { margin: 0 0 0.5rem; font-size: 1.0625rem; font-weight: 650; }
  p { margin: 0; color: var(--dim); font-size: 0.875rem; line-height: 1.5; }
  .row { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.125rem; }
  button {
    font: inherit; font-size: 0.875rem; border-radius: var(--r-sm); padding: 0.5rem 0.875rem; cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, filter 0.15s ease;
  }
  .leave { background: none; border: 1px solid var(--line); color: var(--dim); }
  .leave:hover { color: var(--danger); border-color: var(--danger); }
  .stay { background: var(--a); border: 1px solid var(--a); color: var(--bg); font-weight: 650; }
  .stay:hover { filter: brightness(1.1); }
</style>
