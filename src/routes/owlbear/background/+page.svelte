<script lang="ts">
  /**
   * The extension's background page (owlbear/manifest.json): never seen,
   * running while the room is open. lib/owlbear/background.ts does the work.
   */
  import { onMount } from 'svelte';

  onMount(() => {
    let stop = () => {};
    let gone = false;
    void import('$lib/owlbear/background').then(async (m) => {
      const s = await m.run();
      if (gone) s();
      else stop = s;
    });
    return () => {
      gone = true;
      stop();
    };
  });
</script>

<svelte:head><title>DND Companion · Owlbear</title></svelte:head>
