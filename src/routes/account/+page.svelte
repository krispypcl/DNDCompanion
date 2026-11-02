<script lang="ts">
  /**
   * The player's own account: how they appear (a name and a picture, the
   * picture by link like a portrait), their password, and signing out.
   */
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import Avatar from '$lib/components/Avatar.svelte';
  import Lightbox from '$lib/components/Lightbox.svelte';
  import ModeToggle from '$lib/components/ModeToggle.svelte';
  import D20Loader from '$lib/components/D20Loader.svelte';
  import { profileOf, signOut, signOutEverywhere, updatePassword, updateProfile } from '$lib/data/session';
  import { passwordStrength } from '$lib/rules/password';
  import { resolveImageUrl } from '$lib/rules/imageUrl';
  import { session } from '$lib/stores/session';

  const MIN_PASSWORD = 8;

  let name = $state('');
  let picture = $state('');
  let filled = false;
  $effect(() => {
    const user = $session.user;
    if (!user || filled) return;
    const p = profileOf(user);
    name = p.displayName;
    picture = p.avatarUrl;
    filled = true;
  });

  const link = $derived(resolveImageUrl(picture));
  let loaded = $state<Record<string, 'ok' | 'failed'>>({});
  let viewing = $state(false);

  let profileMsg = $state<{ ok: boolean; text: string } | null>(null);
  let savingProfile = $state(false);
  async function saveProfile(e: SubmitEvent) {
    e.preventDefault();
    savingProfile = true;
    profileMsg = null;
    try {
      await updateProfile({ displayName: name, avatarUrl: picture });
      profileMsg = { ok: true, text: 'Saved.' };
    } catch (err) {
      profileMsg = { ok: false, text: err instanceof Error ? err.message : 'Could not save.' };
    } finally {
      savingProfile = false;
    }
  }

  let pw = $state('');
  let pw2 = $state('');
  const strength = $derived(passwordStrength(pw, $session.user?.email ?? ''));
  let pwMsg = $state<{ ok: boolean; text: string } | null>(null);
  let savingPw = $state(false);
  async function savePassword(e: SubmitEvent) {
    e.preventDefault();
    pwMsg = null;
    if (pw.length < MIN_PASSWORD) return (pwMsg = { ok: false, text: `Use at least ${MIN_PASSWORD} characters.` });
    if (strength.score === 0) return (pwMsg = { ok: false, text: 'That password is too easy to guess.' });
    if (pw !== pw2) return (pwMsg = { ok: false, text: 'The two passwords do not match.' });
    savingPw = true;
    try {
      await updatePassword(pw);
      pw = pw2 = '';
      pwMsg = { ok: true, text: 'Password changed.' };
    } catch (err) {
      pwMsg = { ok: false, text: err instanceof Error ? err.message : 'Could not change the password.' };
    } finally {
      savingPw = false;
    }
  }

  let confirmEverywhere = $state(false);
  async function leave(everywhere: boolean) {
    if (everywhere) await signOutEverywhere();
    else await signOut();
    goto(`${base}/`);
  }
</script>

<svelte:head><title>Your account · DND Companion</title></svelte:head>

<main>
  <header>
    <a class="back" href="{base}/">← Your characters</a>
    <ModeToggle />
  </header>

  {#if $session.loading}
    <div class="wait"><D20Loader size={56} label="Loading your account" /></div>
  {:else if !$session.user}
    <section class="card"><h1>Your account</h1><p class="dim">Sign in to see your account.</p>
      <a class="btn" href="{base}/login">Sign in</a></section>
  {:else}
    <h1 class="title">Your account</h1>

    <form class="card" onsubmit={saveProfile} aria-labelledby="profile-h">
      <h2 id="profile-h">Profile</h2>
      <div class="who">
        <button type="button" class="pic" disabled={!link.url || loaded[link.url] !== 'ok'}
                aria-label="View profile picture full screen" onclick={() => (viewing = true)}>
          <Avatar url={picture} name={name || $session.user.email || '?'} size={72} />
        </button>
        <div class="grow">
          <label for="name">Display name</label>
          <input id="name" bind:value={name} maxlength="40" placeholder="What the table calls you" autocomplete="nickname" />
        </div>
      </div>
      <label for="pic">Profile picture URL</label>
      <input id="pic" bind:value={picture} placeholder="Paste an image link: Google Drive, Imgur, Pinterest, Dropbox…" />
      {#if link.url}
        <img class="probe" src={link.url} alt="" onload={() => (loaded[link.url] = 'ok')} onerror={() => (loaded[link.url] = 'failed')} />
      {/if}
      {#if link.url && loaded[link.url] === 'failed'}
        <p class="note bad">That link did not load as a picture. Open the picture itself and copy its image address.</p>
      {:else if link.note}
        <p class="note" class:bad={link.source === 'invalid'}>{link.note}</p>
      {/if}
      <p class="email">Signed in as <b>{$session.user.email}</b></p>
      <div class="row">
        {#if profileMsg}<span class="msg" class:bad={!profileMsg.ok} role="status">{profileMsg.text}</span>{/if}
        <button class="btn primary" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</button>
      </div>
    </form>

    <form class="card" onsubmit={savePassword} aria-labelledby="pw-h">
      <h2 id="pw-h">Password</h2>
      <label for="pw">New password</label>
      <input id="pw" type="password" bind:value={pw} autocomplete="new-password" minlength={MIN_PASSWORD} />
      {#if pw}
        <div class="meter" data-score={strength.score}>
          <div class="bars">{#each [1, 2, 3, 4] as n (n)}<i class:lit={strength.score >= n || n === 1}></i>{/each}</div>
          <p><b>{strength.label}</b>{#if strength.hint} · {strength.hint}{/if}</p>
        </div>
      {/if}
      <label for="pw2">Confirm new password</label>
      <input id="pw2" type="password" bind:value={pw2} autocomplete="new-password" />
      <div class="row">
        {#if pwMsg}<span class="msg" class:bad={!pwMsg.ok} role="status">{pwMsg.text}</span>{/if}
        <button class="btn primary" disabled={savingPw || !pw}>{savingPw ? 'Changing…' : 'Change password'}</button>
      </div>
    </form>

    <section class="card" aria-labelledby="out-h">
      <h2 id="out-h">Signing out</h2>
      <p class="dim">Signing out everywhere ends every session on every device, this one included —
        useful after signing in on someone else's phone.</p>
      <div class="row">
        <button class="btn" onclick={() => leave(false)}>Sign out</button>
        {#if confirmEverywhere}
          <button class="btn danger" onclick={() => leave(true)}>Yes, sign out everywhere</button>
        {:else}
          <button class="btn" onclick={() => (confirmEverywhere = true)}>Sign out everywhere</button>
        {/if}
      </div>
    </section>
  {/if}
</main>

{#if viewing && link.url}
  <Lightbox src={link.url} alt="Profile picture" onclose={() => (viewing = false)} />
{/if}

<style>
  main { max-width: 36rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
  .back { color: var(--dim); text-decoration: none; font-size: 0.875rem; transition: color 0.15s ease; }
  .back:hover { color: var(--a); }
  .title { font-size: 1.5rem; font-weight: 650; margin: 0 0 1rem; letter-spacing: -0.01em; }
  .wait { display: grid; place-items: center; padding: 4rem 0; }
  .card {
    background: var(--surface); border: 1px solid var(--line-soft); border-radius: var(--r);
    padding: 1.125rem; margin-bottom: 1rem; display: grid; gap: 0.5rem;
    animation: rise 0.3s cubic-bezier(0.2, 0.7, 0.3, 1) backwards;
  }
  .card:nth-of-type(2) { animation-delay: 0.05s; }
  .card:nth-of-type(3) { animation-delay: 0.1s; }
  @keyframes rise { from { opacity: 0; transform: translateY(6px); } }
  h2 { font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--label); font-weight: 600; margin: 0 0 0.25rem; }
  label { font-size: 0.8125rem; color: var(--dim); margin-top: 0.25rem; }
  input {
    background: var(--bg); border: 1px solid var(--line); color: var(--text); border-radius: var(--r-sm);
    padding: 0.5rem 0.625rem; font: inherit; font-size: 0.9375rem; width: 100%; box-sizing: border-box;
    transition: border-color 0.15s ease;
  }
  input:focus { outline: none; border-color: var(--a-edge); }
  .who { display: flex; gap: 1rem; align-items: center; }
  .grow { flex: 1; display: grid; gap: 0.375rem; }
  .pic { padding: 0; border: 0; background: none; border-radius: 50%; cursor: zoom-in; transition: transform 0.15s ease; }
  .pic:disabled { cursor: default; }
  .pic:not(:disabled):hover { transform: scale(1.05); }
  .probe { display: none; }
  .note { margin: 0; font-size: 0.78rem; color: var(--dim); }
  .bad { color: var(--danger); }
  .email { margin: 0.5rem 0 0; font-size: 0.8125rem; color: var(--dim); }
  .email b { color: var(--text); font-weight: 600; }
  .dim { color: var(--dim); margin: 0; font-size: 0.875rem; line-height: 1.5; }
  .row { display: flex; justify-content: flex-end; align-items: center; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }
  .msg { font-size: 0.8125rem; color: oklch(72% 0.17 150); margin-right: auto; animation: rise 0.25s ease; }
  .msg.bad { color: var(--danger); }
  .btn {
    font: inherit; font-size: 0.875rem; border-radius: var(--r-sm); padding: 0.5rem 0.875rem; cursor: pointer;
    background: var(--raised); border: 1px solid var(--line); color: var(--text); text-decoration: none;
    transition: border-color 0.15s ease, color 0.15s ease, filter 0.15s ease, transform 0.08s ease;
  }
  .btn:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  .btn:active:not(:disabled) { transform: translateY(1px); }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .btn.primary { background: var(--a); border-color: var(--a); color: var(--bg); font-weight: 650; }
  .btn.primary:hover:not(:disabled) { color: var(--bg); filter: brightness(1.1); }
  .btn.danger { border-color: var(--danger); color: var(--danger); }
  .meter { display: grid; gap: 0.25rem; }
  .bars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.25rem; }
  .bars i { height: 4px; border-radius: 2px; background: var(--track); transition: background-color 0.3s ease; }
  .meter[data-score='0'] i.lit, .meter[data-score='1'] i.lit { background: var(--danger); }
  .meter[data-score='2'] i.lit { background: color-mix(in oklch, var(--danger) 45%, var(--a)); }
  .meter[data-score='3'] i.lit, .meter[data-score='4'] i.lit { background: var(--a); }
  .meter p { margin: 0; font-size: 0.78rem; color: var(--dim); }
  .meter b { color: var(--text); }
  @media (max-width: 700px) { input { font-size: 16px; } }
</style>
