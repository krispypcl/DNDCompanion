<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  let { value, duration = 320 }: { value: number; duration?: number } = $props();

  const reduce =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const display = tweened(value, { duration: reduce ? 0 : duration, easing: cubicOut });
  $effect(() => void display.set(value));
</script>

<span>{Math.round($display)}</span>
