<script lang="ts">
  /**
   * "Continue with Google": off to Google, and back to `next` signed in (a
   * new account is made the first time). Or, with `link`, connects Google to
   * the account already signed in.
   */
  import { base } from '$app/paths';
  import { slide } from 'svelte/transition';
  import { linkGoogle, signInWithGoogle } from '$lib/data/session';

  let { next = '/', link = false, label }: { next?: string; link?: boolean; label?: string } = $props();
  let busy = $state(false);
  let error = $state<string | null>(null);
  async function go() {
    busy = true;
    error = null;
    try {
      const to = `${location.origin}${base}${next}`;
      if (link) await linkGoogle(to);
      else await signInWithGoogle(to);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Google didn’t answer! Try again.';
      busy = false;
    }
  }
</script>

<button type="button" class="google" onclick={go} disabled={busy}>
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
    <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.3 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
    <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
  </svg>
  {busy ? 'Opening Google…' : (label ?? (link ? 'Connect Google' : 'Continue with Google'))}
</button>
{#if error}<p class="err" role="alert" transition:slide={{ duration: 200 }}>{error}</p>{/if}

<style>
  .google {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.625rem; width: 100%;
    font: inherit; font-size: 0.9375rem; font-weight: 500; cursor: pointer; padding: 0.625rem 1rem;
    border-radius: var(--r-sm); border: 1px solid var(--line); background: var(--raised); color: var(--text);
    transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.08s ease;
  }
  .google:hover:not(:disabled) { border-color: var(--a-edge); }
  .google:active:not(:disabled) { transform: translateY(1px); }
  .google:disabled { opacity: 0.6; cursor: default; }
  .err { margin: 0.5rem 0 0; color: var(--bad); font-size: 0.8125rem; }
</style>
