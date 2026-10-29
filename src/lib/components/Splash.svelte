<script lang="ts">
  /**
   * The moment of arrival. Shown once, when the app first mounts — not on
   * navigation, since the layout stays mounted across routes — and then it
   * takes itself out of the DOM so it can never swallow a click.
   */
  import { onMount } from 'svelte';
  import { prefersReducedMotion } from '$lib/motion';

  const HOLD = 560;
  const FADE = 420;

  let phase = $state<'in' | 'out' | 'gone'>('in');

  onMount(() => {
    if (prefersReducedMotion()) {
      phase = 'gone';
      return;
    }
    const leave = setTimeout(() => (phase = 'out'), HOLD);
    const remove = setTimeout(() => (phase = 'gone'), HOLD + FADE);
    return () => {
      clearTimeout(leave);
      clearTimeout(remove);
    };
  });
</script>

{#if phase !== 'gone'}
  <div class="splash" class:out={phase === 'out'} aria-hidden="true">
    <svg class="mark" viewBox="0 0 48 48" width="48" height="48">
      <!-- A plain twenty-sided outline: the shape of the hobby, not anyone's logo. -->
      <polygon
        points="24 3 43 14 43 34 24 45 5 34 5 14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <polygon
        points="24 12 34 29 14 29"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </svg>
    <span class="word">DND Companion</span>
  </div>
{/if}

<style>
  .splash {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 0.875rem;
    background: var(--bg);
    animation: splash-in 0.3s ease-out both;
  }
  /* Nothing underneath is reachable while it is on screen anyway, but once it
     starts leaving, clicks should pass straight through it. */
  .splash.out {
    pointer-events: none;
    animation: splash-out 0.42s ease-in forwards;
  }
  .mark {
    color: var(--a);
    animation: mark-in 0.62s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .word {
    font-size: 0.75rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--dim);
    animation: word-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both;
  }

  @keyframes splash-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes splash-out {
    from { opacity: 1; }
    to { opacity: 0; visibility: hidden; }
  }
  @keyframes mark-in {
    from { opacity: 0; transform: scale(0.84) rotate(-9deg); }
    to { opacity: 1; transform: none; }
  }
  @keyframes word-in {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: none; }
  }
</style>
