<script lang="ts">
  /** A page that is not there: a sheet that was deleted, a mistyped link. */
  import { base } from '$app/paths';
  import D20Loader from './D20Loader.svelte';

  let { title, message }: { title: string; message: string } = $props();
</script>

<div class="lost">
  <div class="mark"><D20Loader result={1} size={72} failedLabel={title} /></div>
  <h1>{title}</h1>
  <p>{message}</p>
  <a class="home" href="{base}/">Back to your sheets</a>
</div>

<style>
  .lost {
    min-height: 70vh; display: grid; place-items: center; align-content: center; gap: 0.75rem;
    text-align: center; padding: 2rem 1rem;
  }
  /* The loading die, landed on a natural 1: the same die, so a sheet that
     will not load and a sheet that is not there read as the same roll. */
  .mark { animation: arrive 0.45s ease-out backwards; }
  @keyframes arrive { from { opacity: 0; transform: translateY(-10px); } }
  h1 { margin: 0.5rem 0 0; font-size: 1.5rem; font-weight: 650; letter-spacing: -0.01em; }
  p { margin: 0; color: var(--dim); max-width: 26rem; line-height: 1.5; }
  .home {
    margin-top: 0.75rem; text-decoration: none; color: var(--text); font-size: 0.875rem;
    background: var(--raised); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 0.5rem 1rem;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .home:hover { border-color: var(--a-edge); color: var(--a); }
</style>
