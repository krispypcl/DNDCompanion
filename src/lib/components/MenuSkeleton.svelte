<script lang="ts">
  /** The main menu's outline while the characters load (the greeting, with
      the buttons and the area switch on its line, and a page of cards),
      shimmering, in the place the real ones take, so nothing jumps when they
      arrive. */
  let { greet = false }: { greet?: boolean } = $props();
</script>

<div class="mskel" aria-busy="true" aria-label="Loading your characters">
  <div class="mhead">
    {#if greet}
      <div class="mgreet"><i class="skeleton mhi"></i><i class="skeleton mnext"></i></div>
    {/if}
    <div class="mcontrols">
      <span class="mactions"><i class="skeleton mbtn"></i><i class="skeleton mbtn wide"></i></span>
      <i class="skeleton mswitch"></i>
    </div>
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
  @keyframes in { from { opacity: 0; } }
  .mhead { margin-top: 1.75rem; display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem 1.5rem; flex-wrap: wrap; }
  .mgreet { display: grid; gap: 0.375rem; flex: 1 1 20rem; }
  .mhi { width: 11rem; height: 1.8rem; }
  .mnext { width: 22rem; max-width: 100%; height: 1.875rem; }
  .mcontrols { display: flex; align-items: center; gap: 0.75rem; margin-left: auto; }
  .mactions { display: flex; gap: 0.5rem; }
  .mbtn { width: 4.5rem; height: 2.125rem; }
  .mbtn.wide { width: 6.25rem; }
  .mswitch { width: 17rem; height: 2.375rem; border-radius: 999px; }
  .mgroup { margin-top: 1.5rem; }
  @media (max-width: 700px) {
    .mnext { height: 1.5rem; }
    .mcontrols { width: 100%; flex-direction: column-reverse; align-items: stretch; }
    .mactions { justify-content: flex-end; }
    .mswitch { width: 100%; }
  }
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
    .mhead { margin-top: 1rem; }
    .mgroup { margin-top: 1.25rem; }
    .mcard { padding-left: 2rem; }
  }
</style>
