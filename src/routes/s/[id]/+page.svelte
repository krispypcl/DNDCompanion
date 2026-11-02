<script lang="ts">
  import { page } from '$app/state';
  import SheetView from '$lib/components/SheetView.svelte';
</script>

<SheetView id={page.params.id ?? ''} />
