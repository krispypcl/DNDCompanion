<script lang="ts">
  /** /s?id=<id>: the address the Share button copies (see SheetView). */
  import { page } from '$app/state';
  import SheetView from '$lib/components/SheetView.svelte';
</script>

{#key page.url.searchParams.get('id')}
  <SheetView id={page.url.searchParams.get('id') ?? ''} />
{/key}
