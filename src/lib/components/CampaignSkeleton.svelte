<script lang="ts">
  /** Opened from another page: the page fades in as a whole, so this doesn't fade in again inside it. */
  const arrived = typeof document !== 'undefined' && document.documentElement.hasAttribute('data-arriving');
  /** The campaign page's outline while it loads (the header, three character
      cards, the table music and the board), shimmering, so nothing jumps when it arrives. */
</script>

<div class="cskel" class:arrived aria-busy="true" aria-label="Loading the campaign">
  <div class="head">
    <i class="skeleton logo"></i>
    <div class="lines"><i class="skeleton eyebrow"></i><i class="skeleton title"></i></div>
    <div class="tools">{#each Array(4) as _, i (i)}<i class="skeleton tool"></i>{/each}</div>
  </div>
  <div class="music">
    <i class="skeleton mcap"></i>
    <div class="mbody">
      <i class="skeleton player"></i>
      <div class="songs">{#each Array(4) as _, i (i)}<i class="skeleton song" style:width="{[9, 7, 10.5, 8][i]}rem"></i>{/each}</div>
    </div>
  </div>
  <div class="cards">
    {#each Array(3) as _, i (i)}
      <div class="card">
        <div class="who"><i class="skeleton face"></i><div class="lines"><i class="skeleton name"></i><i class="skeleton sub"></i></div></div>
        <i class="skeleton hp"></i>
        <div class="stats">{#each Array(3) as _, j (j)}<i class="skeleton stat"></i>{/each}</div>
      </div>
    {/each}
  </div>
  <i class="skeleton boardcap"></i>
  <i class="skeleton board"></i>
</div>

<style>
  /* The same frame as the page (CampaignView main). */
  .cskel { max-width: var(--page-width); margin: 0 auto; padding: 2rem var(--page-pad) 4rem; animation: in 0.4s ease 0.15s backwards; }
  @keyframes in { from { opacity: 0; } }
  .head { display: flex; align-items: center; gap: 0.875rem; }
  .logo { width: 1.625rem; height: 1.625rem; border-radius: 50%; flex: none; }
  .lines { display: grid; gap: 0.5rem; flex: 1; min-width: 0; }
  .eyebrow { width: 7rem; height: 0.6875rem; }
  .title { width: 16rem; max-width: 80%; height: 1.875rem; }
  .tools { display: flex; gap: 0.5rem; }
  .tool { width: 2.25rem; height: 2.125rem; }
  /* The table music's box (CampaignMusic): the player at the left, songs beside it. */
  .music { margin-top: 1rem; padding: 0.875rem 1rem; border-radius: var(--r); border: 1px solid var(--line-soft); background: var(--surface); }
  .mcap { display: block; width: 6rem; height: 0.6875rem; }
  .mbody { display: grid; grid-template-columns: minmax(0, 19rem) minmax(0, 1fr); gap: 1rem; margin-top: 0.875rem; align-items: center; }
  .player { height: 3.75rem; }
  .songs { display: grid; gap: 0.75rem; }
  .song { height: 0.9375rem; max-width: 100%; }
  @media (max-width: 700px) { .mbody { grid-template-columns: minmax(0, 1fr); } }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(25rem, 100%), 1fr)); gap: 0.875rem; margin-top: 1.5rem; }
  .card { background: var(--surface); border: 1px solid var(--line-soft); border-radius: var(--r); padding: 0.875rem; display: grid; gap: 0.75rem; }
  .who { display: flex; gap: 0.75rem; align-items: center; }
  .face { width: 3.25rem; height: 3.25rem; border-radius: var(--r-sm); flex: none; }
  .name { width: 8rem; height: 1.0625rem; }
  .sub { width: 5.5rem; height: 0.8125rem; }
  .hp { height: 2.25rem; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.375rem; }
  .stat { height: 3.25rem; }
  .boardcap { width: 7rem; height: 0.75rem; margin-top: 2.5rem; }
  .board { margin-top: 0.75rem; aspect-ratio: 16 / 9; border-radius: var(--r); }
  @media (max-width: 720px) { .board { aspect-ratio: auto; height: min(34rem, 70vh); } }
  @media (max-width: 600px) {
    .cskel { padding: 1.25rem 1rem 4rem; }
    .head { flex-wrap: wrap; }
    .tools { width: 100%; justify-content: flex-end; }
  }
  /* Arriving from another page, the page's own arrival is the fade (+layout). */
  .cskel.arrived { animation: none; }
</style>
