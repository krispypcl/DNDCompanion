<script lang="ts">
  /**
   * Where Google or Discord sends the sign-in window opened from Owlbear
   * (lib/owlbear/signin.ts): it passes the one-time code to the panel that
   * asked for it, then closes itself.
   */
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { supabase } from '#lib/supabase.ts';
  import { SIGNIN_EVENT, signinChannel } from '#lib/owlbear/signin.ts';
  import Logo from '../Logo.svelte';

  let step = $state<'sending' | 'done' | 'failed' | 'lost'>('sending');
  let said = $state('');

  onMount(() => {
    const q = new URLSearchParams(location.search);
    const nonce = q.get('n');
    const code = q.get('code');
    const flow = q.get('sb_flow_id');
    const refused = q.get('error_description') || q.get('error');
    if (!nonce) return void (step = 'lost');
    const payload = refused ? { error: refused } : code ? { code, ...(flow ? { flow } : {}) } : null;
    if (!payload) return void (step = 'lost');
    if (refused) said = refused;
    // The code is in the address: out of it (and the history) at once.
    history.replaceState(null, '', location.pathname);
    const channel = supabase.channel(signinChannel(nonce));
    let tries = 0;
    const send = () =>
      channel.httpSend(SIGNIN_EVENT, payload).then(
        () => {
          step = refused ? 'failed' : 'done';
          // Once more, in case the panel's ear was a beat late; then the window goes.
          if (tries++ === 0) setTimeout(() => void send(), 1500);
          else setTimeout(() => window.close(), 600);
        },
        () => {
          if (tries++ < 3) setTimeout(() => void send(), 1000);
          else step = 'failed';
        }
      );
    void send();
  });
</script>

<svelte:head><title>Signing in · DND Companion</title></svelte:head>

<main class="signback">
  <Logo size={40} />
  {#key step}
    <div class="sbtext" in:fade={{ duration: 180 }}>
      {#if step === 'sending'}
        <h1>Almost there</h1>
        <p>Handing your sign-in to Owlbear.</p>
      {:else if step === 'done'}
        <h1>You’re signed in!</h1>
        <p>Back to the table: this window closes on its own.</p>
      {:else if step === 'failed'}
        <h1>That didn’t take!</h1>
        <p>{said || 'The sign-in couldn’t reach Owlbear.'} Close this window and try again from the panel.</p>
      {:else}
        <h1>Nothing to do here</h1>
        <p>This window is for signing in from the DND Companion panel in Owlbear Rodeo.</p>
      {/if}
    </div>
  {/key}
</main>

<style>
  :global(html.in-owlbear), :global(html.in-owlbear body) { background: var(--bg); }
  .signback {
    min-height: 100dvh; display: grid; place-content: center; justify-items: center; gap: 1rem; padding: 2rem 1.5rem; text-align: center;
  }
  .sbtext { display: grid; gap: 0.375rem; max-width: 22rem; }
  h1 { margin: 0; font-size: 1.25rem; }
  p { margin: 0; color: var(--dim); font-size: 0.9375rem; line-height: 1.5; }
</style>
