<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  let { value, duration = 320 }: { value: number; duration?: number } = $props();

  import { untrack } from 'svelte';
  import { prefersReducedMotion } from '$lib/motion';

  // Starts at the first value with no tween; later values count up to.
  const display = tweened(untrack(() => value), { easing: cubicOut });
  $effect(() => void display.set(value, { duration: prefersReducedMotion() ? 0 : duration }));
</script>

<span>{Math.round($display)}</span>
