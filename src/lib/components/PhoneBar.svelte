<!--
  What a page puts in a phone's bottom bar: its places, the one it is in,
  what a press does, and the place's one docked action, if any. The bar
  itself is drawn by the layout (BottomBar), the same on every page; this
  only hands it the page's places, and takes them back when the page goes.
-->
<script lang="ts" module>
  export type PhonePlace = { key: string; label: string; icon: PlaceIcon; badge?: boolean };
  export type PlaceIcon = 'play' | 'abilities' | 'spells' | 'search' | 'gear' | 'features' | 'more' | 'party' | 'hourglass' | 'sight' | 'board' | 'person' | 'flag';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { chrome } from '#lib/stores/chrome.svelte.ts';

  let {
    places,
    active,
    onchoose,
    dock,
    themeCss,
    page
  }: {
    places: PhonePlace[];
    active: string;
    onchoose: (key: string) => void;
    /** The place's one main action, above the bar. */
    dock?: Snippet;
    /** The page's own colors (theme.ts themeStyle), for the bar's accent. */
    themeCss?: string;
    /** Which page these are for ("sheet:<id>"): its loading screen hands over the same, so the bar comes in once. */
    page?: string;
  } = $props();

  const owner = Symbol('bar');
  $effect(() => {
    chrome.bar = { places, active, onchoose, dock, themeCss, page, owner };
  });
  // Only this page's own places are taken back: the next page may already have put its own in.
  $effect(() => () => {
    if (chrome.bar?.owner === owner) chrome.bar = null;
  });
</script>
