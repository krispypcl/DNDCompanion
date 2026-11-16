<script lang="ts">
  /** The sheet's outline while it loads: the same layout, shimmering, so the
      page does not jump when the real thing arrives. */
</script>

<div class="skel" aria-busy="true" aria-label="Loading the sheet">
  <div class="head">
    <i class="skeleton sq"></i>
    <div class="lines"><i class="skeleton l1"></i><i class="skeleton l2"></i></div>
  </div>
  <div class="band">
    <div class="card hp"><i class="skeleton l3"></i><i class="skeleton big"></i><i class="skeleton bar"></i></div>
    <div class="card abil">{#each Array(6) as _, i (i)}<i class="skeleton box"></i>{/each}</div>
  </div>
  <div class="main">
    <div class="card rail">{#each Array(9) as _, i (i)}<i class="skeleton row"></i>{/each}</div>
    <div class="card centre">{#each Array(5) as _, i (i)}<i class="skeleton row wide"></i>{/each}</div>
    <div class="card rail">{#each Array(6) as _, i (i)}<i class="skeleton box2"></i>{/each}</div>
  </div>
</div>

<style>
  .skel { padding: var(--page-pad); max-width: var(--page-width); margin: 0 auto; animation: in 0.4s ease 0.15s backwards; }
  @keyframes in { from { opacity: 0; } }
  /* Each block is the shared shimmer (.skeleton, app.css). */
  .head { display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem; }
  .sq { width: 6rem; height: 6rem; border-radius: var(--r); flex: none; }
  .lines { display: grid; gap: 0.625rem; flex: 1; }
  .l1 { width: 14rem; height: 1.75rem; }
  .l2 { width: 20rem; max-width: 80%; height: 0.875rem; }
  .card { background: var(--surface); border: 1px solid var(--line-soft); border-radius: var(--r); padding: 1rem; }
  .band { display: grid; grid-template-columns: minmax(16rem, 1fr) 2.05fr; gap: 1rem; margin-bottom: 1rem; }
  .hp { display: grid; gap: 0.75rem; align-content: end; min-height: 12rem; }
  .l3 { width: 5rem; height: 0.6875rem; }
  .big { width: 6rem; height: 2.875rem; }
  .bar { height: 14px; border-radius: 7px; }
  .abil { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.625rem; align-content: start; }
  .box { height: 5.5rem; border-radius: var(--r); }
  .main { display: grid; grid-template-columns: 16.5rem 1fr 18.75rem; gap: 1rem; }
  .rail, .centre { display: grid; gap: 0.75rem; align-content: start; min-height: 24rem; }
  .row { height: 1.25rem; }
  .row.wide { height: 2rem; }
  .box2 { height: 4rem; border-radius: var(--r); }
  @media (max-width: 860px) {
    .skel { padding: 0.75rem; }
    .band, .main { grid-template-columns: 1fr; }
    .abil { grid-template-columns: repeat(3, 1fr); }
    .main .rail:last-child { display: none; }
  }
  /* On a phone the real header keeps the portrait at the left of the name. */
  @media (max-width: 700px) {
    .head { gap: 0.875rem; }
    .sq { width: 5.5rem; height: 5.5rem; }
    .l1 { width: 9rem; }
    .l2 { width: 12rem; }
  }
</style>
