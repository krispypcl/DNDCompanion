<script lang="ts">
  /**
   * Says so when the connection drops, and that nothing typed meanwhile is
   * lost; when it comes back, sends what was waiting and says that too.
   */
  import { fly } from 'svelte/transition';
  import { online } from '$lib/stores/online';
  import { sheetStore } from '$lib/stores/sheet';
  import { prefersReducedMotion } from '$lib/motion';

  let back = $state(false);
  let wasOffline = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    if (!$online) {
      wasOffline = true;
      back = false;
      return;
    }
    if (!wasOffline) return;
    wasOffline = false;
    back = true;
    sheetStore.retry();
    clearTimeout(timer);
    timer = setTimeout(() => (back = false), 2600);
  });

  const move = { y: 12, duration: prefersReducedMotion() ? 0 : 220 };
</script>

{#if !$online}
  <div class="notice off" role="status" transition:fly={move}>
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0" />
        <path d="M3 3l18 18" />
      </g>
    </svg>
    <span><b>You’re offline!</b> Anything you change is tucked away and will save when you’re back.</span>
  </div>
{:else if back}
  <div class="notice on" role="status" transition:fly={move}>
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span><b>Back online!</b> Saving your changes.</span>
  </div>
{/if}

<style>
  .notice {
    position: fixed; z-index: 45; left: 50%; bottom: 1rem; translate: -50% 0;
    display: flex; align-items: center; gap: 0.5rem; max-width: calc(100vw - 2rem);
    padding: 0.625rem 0.875rem; border-radius: var(--r);
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    font-size: 0.8125rem; line-height: 1.4; box-shadow: 0 10px 30px rgb(0 0 0 / 0.35);
  }
  .notice b { font-weight: 650; }
  .off svg { color: var(--danger); }
  .on svg { color: oklch(72% 0.17 150); }
</style>
