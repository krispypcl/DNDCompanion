<script lang="ts">
  /**
   * "Continue with Google" or "Continue with Discord": off to the service, and
   * back to `next` signed in (a new account is made the first time). Or, with
   * `link`, connects the service to the account already signed in.
   */
  import { base } from '$app/paths';
  import ProviderIcon from './ProviderIcon.svelte';
  import { slide } from 'svelte/transition';
  import { linkProvider, PROVIDER_NAMES, signInWithProvider, type OAuthProvider } from '$lib/data/session';

  let {
    provider = 'google',
    next = '/',
    link = false,
    label,
    compact = false,
    bare = false
  }: {
    provider?: OAuthProvider; next?: string; link?: boolean; label?: string;
    /** Sized to its words, like the other buttons in a row (the account's Connections). */
    compact?: boolean;
    /** Just the words, no mark (where the mark is already beside it). */
    bare?: boolean;
  } = $props();
  const name = $derived(PROVIDER_NAMES[provider]);
  let busy = $state(false);
  let error = $state<string | null>(null);
  async function go() {
    busy = true;
    error = null;
    try {
      const to = `${location.origin}${base}${next}`;
      if (link) await linkProvider(provider, to);
      else await signInWithProvider(provider, to);
    } catch (e) {
      error = e instanceof Error ? e.message : `${name} didn’t answer! Try again.`;
      busy = false;
    }
  }
</script>

<button type="button" class="oauth {provider}" class:compact onclick={go} disabled={busy}>
  {#if !bare}<ProviderIcon {provider} />{/if}
  {busy ? `Opening ${name}…` : (label ?? (link ? `Connect ${name}` : `Continue with ${name}`))}
</button>
{#if error}<p class="err" role="alert" transition:slide={{ duration: 200 }}>{error}</p>{/if}

<style>
  .oauth {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.625rem; width: 100%;
    font: inherit; font-size: 0.9375rem; font-weight: 500; cursor: pointer; padding: 0.625rem 1rem;
    border-radius: var(--r-sm); border: 1px solid var(--line); background: var(--raised); color: var(--text);
    transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.08s ease;
  }
  .oauth:hover:not(:disabled) { border-color: var(--a-edge); }
  .oauth:active:not(:disabled) { transform: translateY(1px); }
  .oauth:disabled { opacity: 0.6; cursor: default; }
  .oauth.compact { width: auto; font-size: 0.875rem; padding: 0.5rem 0.875rem; gap: 0.5rem; }
  .err { margin: 0.5rem 0 0; color: var(--bad); font-size: 0.8125rem; }
</style>
