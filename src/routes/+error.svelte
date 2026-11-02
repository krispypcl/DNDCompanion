<script lang="ts">
  import { page } from '$app/state';
  import NotFound from '$lib/components/NotFound.svelte';
</script>

{#if page.status === 404}
  <NotFound title="Nothing here" message="This page does not exist. The link may be mistyped, or the page may have moved." />
{:else}
  <NotFound title="Something went wrong" message={page.error?.message ?? 'The page could not be shown.'} />
{/if}
