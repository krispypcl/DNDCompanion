<script lang="ts">
  import { page } from '$app/state';
  import CampaignView from '$lib/components/CampaignView.svelte';
</script>

{#key page.params.id}
  <CampaignView id={page.params.id ?? ''} />
{/key}
