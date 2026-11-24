<script lang="ts">
  import { backdrop } from '#lib/actions.ts';
  /** Asked only when leaving would lose something: a change that could not be saved. */
  import { onMount } from 'svelte';
  import { fade, prefersReducedMotion, windowMotion } from '#lib/motion.ts';
  import { windowSounds } from '#lib/sound.ts';

  let { onstay, onleave }: { onstay: () => void; onleave: () => void } = $props();
  const still = prefersReducedMotion();
  let stay: HTMLButtonElement | undefined = $state();

  onMount(() => {
    stay?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onstay();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });

  // Heard as it opens and as it goes.
  $effect(windowSounds);
</script>

<div class="scrim" transition:fade={{ duration: still ? 0 : 160 }}
     use:backdrop={onstay} role="presentation">
  <div class="box" role="alertdialog" aria-modal="true" aria-labelledby="leave-title" aria-describedby="leave-text"
       transition:windowMotion={{ start: 0.95, duration: 200 }}>
    <h2 id="leave-title">Wait, your latest changes aren’t saved!</h2>
    <p id="leave-text">
      They couldn’t be saved just now. Stay, and they’ll save as soon as they can.
      Leave, and they’re lost to the void.
    </p>
    <div class="row">
      <button class="leave" onclick={onleave}>Leave Anyway</button>
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
    transition: border-color 0.15s var(--ease-out), color 0.15s var(--ease-out), background-color 0.15s var(--ease-out), filter 0.15s var(--ease-out);
  }
  .leave { background: none; border: 1px solid var(--line); color: var(--dim); }
  .leave:hover { color: var(--danger); border-color: var(--danger); }
  .stay { background: var(--a); border: 1px solid var(--a); color: var(--bg); font-weight: 650; }
  .stay:hover { filter: brightness(1.1); }
  /* No frost on a phone: the bars above stay sharp. */
  @media (max-width: 700px) { .scrim { backdrop-filter: none; -webkit-backdrop-filter: none; } }
  /* A phone: a sheet from the bottom, the full width, its top rounded. */
  @media (max-width: 700px) {
    .scrim { place-items: end stretch; padding: 0; }
    .box {
      width: 100%; max-height: 90dvh; overflow-y: auto; overscroll-behavior: contain;
      border-radius: 1.125rem 1.125rem 0 0; border-bottom: 0;
      padding-bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
    }
  }
</style>
