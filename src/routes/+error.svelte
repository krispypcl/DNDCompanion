<script lang="ts">
  import { page } from '$app/state';
  import NotFound from '$lib/components/NotFound.svelte';
</script>

{#if page.status === 404}
  <NotFound title="Nothing here!" message="You’ve wandered off the map. The link may be mistyped, or the page has moved on to other adventures." />
{:else}
  <NotFound title="Well, that’s a critical fail!" message={page.error?.message ?? 'This page tripped over its own feet. Try again in a moment.'} />
{/if}
