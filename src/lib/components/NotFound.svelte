<script lang="ts">
  /** A page that is not there: a sheet that was deleted, a mistyped link. */
  import { base } from '$app/paths';

  let { title, message }: { title: string; message: string } = $props();
</script>

<div class="lost">
  <svg class="mark" viewBox="0 0 48 48" width="64" height="64" aria-hidden="true">
    <polygon points="24 3 43 14 43 34 24 45 5 34 5 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
    <text x="24" y="31" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">1</text>
  </svg>
  <h1>{title}</h1>
  <p>{message}</p>
  <a class="home" href="{base}/">Back to your sheets</a>
</div>

<style>
  .lost {
    min-height: 70vh; display: grid; place-items: center; align-content: center; gap: 0.75rem;
    text-align: center; padding: 2rem 1rem;
  }
  /* A natural 1, rolling in. */
  .mark { color: var(--danger); animation: roll 0.7s cubic-bezier(0.2, 0.8, 0.3, 1.2) backwards; }
  @keyframes roll {
    from { transform: rotate(-200deg) scale(0.4); opacity: 0; }
  }
  h1 { margin: 0.5rem 0 0; font-size: 1.5rem; font-weight: 650; letter-spacing: -0.01em; }
  p { margin: 0; color: var(--dim); max-width: 26rem; line-height: 1.5; }
  .home {
    margin-top: 0.75rem; text-decoration: none; color: var(--text); font-size: 0.875rem;
    background: var(--raised); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 0.5rem 1rem;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .home:hover { border-color: var(--a-edge); color: var(--a); }
</style>
