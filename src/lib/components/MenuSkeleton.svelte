<script lang="ts">
  /** The main menu's outline while the characters load (the greeting, the
      two area buttons, the count and its buttons, a page of cards),
      shimmering, in the place the real ones take, so nothing jumps when they
      arrive. */
  let { greet = false }: { greet?: boolean } = $props();
</script>

<div class="mskel" aria-busy="true" aria-label="Loading your characters">
  {#if greet}
    <div class="mgreet"><i class="skeleton mhi"></i><i class="skeleton mnext"></i></div>
  {/if}
  <div class="mtabs">
    {#each Array(2) as _, i (i)}
      <div class="mtab"><i class="skeleton micon"></i><span class="mtabtext"><i class="skeleton mtabname"></i><i class="skeleton mtabsub"></i></span></div>
    {/each}
  </div>
  <div class="mbar">
    <i class="skeleton mtally"></i>
    <span class="mactions"><i class="skeleton mbtn"></i><i class="skeleton mbtn wide"></i></span>
  </div>
  <i class="skeleton mgroup"></i>
  <div class="mcards">
    {#each Array(4) as _, i (i)}
      <div class="mcard"><div class="min">
        <i class="skeleton mface"></i>
        <div class="mlines">
          <i class="skeleton mname" style:width="{[9, 7, 10, 8][i]}rem"></i>
          <i class="skeleton mline"></i>
          <i class="skeleton mline short"></i>
        </div>
        <div class="mfacts"><i class="skeleton mhp"></i><i class="skeleton mbar2"></i></div>
        <i class="skeleton mfoot"></i>
      </div></div>
    {/each}
  </div>
</div>

<style>
  /* The same frame as the real areas in the main menu (+page.svelte). */
  .mskel { animation: in 0.4s ease 0.15s backwards; }
  .mgreet { margin-top: 1.75rem; display: grid; gap: 0.375rem; }
  .mhi { width: 11rem; height: 1.8rem; }
  .mnext { width: 22rem; max-width: 100%; height: 1.875rem; }
  .mtabs { margin-top: 1.75rem; }
  @keyframes in { from { opacity: 0; } }
  .mtabs { display: grid; grid-template-columns: 1fr 1fr; gap: 0.375rem; }
  .mtab {
    display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.875rem;
    border: 1px solid var(--line-soft); border-radius: var(--r-sm); background: var(--raised);
  }
  .micon { width: 2.25rem; height: 2.25rem; flex: none; background: var(--surface); }
  .mtabtext { display: grid; gap: 0.375rem; flex: 1; }
  .mtabname { width: 7.5rem; height: 1rem; max-width: 100%; }
  .mtabsub { width: 9rem; height: 0.75rem; max-width: 100%; }
  @media (max-width: 700px) {
    .mtab { padding: 0.5rem 0.625rem; justify-content: center; }
    .micon { width: 1.125rem; height: 1.125rem; }
    .mtabtext { flex: none; }
    .mtabsub { display: none; }
    .mnext { height: 1.5rem; }
  }
  .mbar { display: flex; align-items: center; justify-content: space-between; margin: 1.25rem 0 0.875rem; min-height: 2.125rem; }
  .mtally { width: 6.5rem; height: 0.8125rem; }
  .mactions { display: flex; gap: 0.5rem; }
  .mbtn { width: 4.5rem; height: 2.125rem; }
  .mbtn.wide { width: 6.25rem; }
  .mgroup { width: 7.5rem; height: 0.6875rem; margin-bottom: 0.5rem; }
  .mcards { display: grid; gap: 0.5rem; }
  /* Each card sized as the real one: by its own width (container queries,
     as on the cards themselves; the thresholds less this card's wider
     padding, 2.65rem, as the real card measures inside its own). */
  .mcard { container-type: inline-size; padding: 0.75rem 0.9rem 0.75rem 2.25rem; border: 1px solid var(--line-soft); border-radius: 8px; background: var(--surface); }
  .min { display: grid; grid-template-columns: 4.75rem minmax(0, 1fr); align-items: center; column-gap: 1rem; }
  .mface { width: 4.75rem; height: 4.75rem; }
  .mlines { display: grid; gap: 0.5rem; }
  .mname { height: 1rem; max-width: 100%; }
  .mline { width: 8rem; height: 0.75rem; max-width: 100%; }
  .mline.short { width: 11rem; }
  .mfacts, .mfoot { display: none; }
  @media (min-width: 900px) {
    .mcards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.375rem; }
  }
  @container (min-width: 38.35rem) {
    .min { grid-template-columns: 4.75rem minmax(0, 1fr) 13rem; }
    .mfacts { display: grid; gap: 0.5rem; padding-left: 1rem; border-left: 1px solid var(--line-soft); }
    .mhp { height: 1rem; width: 70%; }
    .mbar2 { height: 4px; }
  }
  /* A narrow card: the dates as its foot. */
  @container (max-width: 33.35rem) {
    .mfoot { display: block; grid-column: 1 / -1; height: 0.75rem; width: 13rem; max-width: 100%; justify-self: center; margin-top: 0.625rem; }
  }
  /* No taller than the page it stands for: two rows of two, three cards in
     one column, two on a phone. */
  @media (max-width: 899px) { .mcard:nth-child(n + 4) { display: none; } }
  @media (max-width: 600px) { .mcard:nth-child(n + 3) { display: none; } }
  @media (max-width: 420px) {
    .mgreet, .mtabs { margin-top: 1rem; }
    .mcard { padding-left: 2rem; }
  }
</style>
