<script lang="ts">
  /**
   * The splash itself lives in src/app.html, so it is painted on the first
   * frame rather than after hydration — otherwise the app flashes past before
   * it appears. This component renders nothing; it only takes the splash away
   * once the app is mounted, and only on that first mount, since the layout
   * stays put across navigation.
   */
  import { onMount } from 'svelte';
  import { prefersReducedMotion } from '$lib/motion';

  const HOLD = 560;
  const FADE = 420;

  /** The shell locks scrolling while the splash is up; this gives it back. */
  const unlock = () => document.documentElement.classList.remove('splashing');

  onMount(() => {
    const splash = document.getElementById('splash');
    if (!splash) {
      unlock();
      return;
    }

    if (prefersReducedMotion()) {
      splash.remove();
      unlock();
      return;
    }

    // One frame of the app behind it before the fade starts, so the splash
    // never lifts on a screen that has nothing on it yet.
    let leave = 0;
    let remove = 0;
    const frame = requestAnimationFrame(() => {
      leave = window.setTimeout(() => {
        // Scrolling comes back as the splash starts to lift, not after.
        unlock();
        splash.classList.add('out');
      }, HOLD);
      remove = window.setTimeout(() => splash.remove(), HOLD + FADE);
    });

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(leave);
      clearTimeout(remove);
      unlock();
    };
  });
</script>
