<script lang="ts">
  /** A number that counts to each new value (never the first), so a change is seen happening. */
  import { untrack } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion } from '#lib/motion.ts';

  let { value }: { value: number } = $props();

  const display = new Tween(untrack(() => value), { easing: cubicOut });
  $effect(() => void display.set(value, { duration: prefersReducedMotion() ? 0 : 320 }));
</script>

<span>{Math.round(display.current)}</span>
