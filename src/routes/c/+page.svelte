<script lang="ts">
  /** /c?id=<id>: the same page, by a query a static host always has a file for. */
  import { page } from '$app/state';
  import CampaignView from '$lib/components/CampaignView.svelte';
</script>

{#key page.url.searchParams.get('id')}
  <CampaignView id={page.url.searchParams.get('id') ?? ''} />
{/key}
