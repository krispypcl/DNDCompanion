<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import Splash from '$lib/components/Splash.svelte';
  import { rise } from '$lib/motion';

  let { children } = $props();
</script>

<Splash />

<!--
  Keyed on the path, so every route change — opening a sheet, coming back to
  the list — plays the same arrival. Only the incoming view animates: running
  an exit as well would leave two copies in the document at once and the page
  would jump.
-->
{#key page.url.pathname}
  <div class="route" in:rise={{ y: 10, duration: 260, delay: 30 }}>
    {@render children()}
  </div>
{/key}
