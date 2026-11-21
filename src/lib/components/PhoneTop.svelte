<!--
  What a page puts in a phone's top bar: buttons at the left and at the
  right (Back last). The bar itself is drawn by the layout (TopBar), the
  same on every page; this only hands it the page's buttons, and takes
  them back when the page goes.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { chrome } from '#lib/stores/chrome.svelte.ts';

  let { left, right, themeCss }: { left?: Snippet; right?: Snippet; /** The page's own colors (theme.ts themeStyle). */ themeCss?: string } = $props();

  const owner = Symbol('top');
  $effect(() => {
    chrome.top = { left, right, themeCss, owner };
  });
  // Only this page's own buttons are taken back: the next page may already have put its own in.
  $effect(() => () => {
    if (chrome.top?.owner === owner) chrome.top = null;
  });
</script>
