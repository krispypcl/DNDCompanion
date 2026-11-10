<script lang="ts">
  /**
   * /join?code=<invite>: a player brings a character into a campaign. Names
   * the campaign first, asks them to sign in if they have not, then lets them
   * pick which of their characters joins.
   */
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { fade } from 'svelte/transition';
  import { campaignMessage, campaignRepo, inviteCode } from '$lib/data/campaigns';
  import { sheetRepo } from '$lib/data/sheets';
  import { session } from '$lib/stores/session';
  import { characterLevel, classLine } from '$lib/rules/derived';
  import D20Loader from '$lib/components/D20Loader.svelte';
  import Logo from '$lib/components/Logo.svelte';
  import NotFound from '$lib/components/NotFound.svelte';
  import type { Sheet } from '$lib/types';

  const code = $derived(inviteCode(page.url.searchParams.get('code') ?? ''));
  let target = $state<{ id: string; name: string } | null>(null);
  let looked = $state(false);
  let landed = $state(false);
  let sheets = $state<Sheet[]>([]);
  let busy = $state<string | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    const c = code;
    looked = false;
    if (!c) { looked = true; return; }
    campaignRepo.byInvite(c)
      .then((t) => (target = t))
      .catch((e) => (error = campaignMessage(e, 'The invite wouldn’t open! Try again in a moment.')))
      .finally(() => (looked = true));
  });

  const userId = $derived($session.user?.id ?? null);
  $effect(() => {
    const id = userId;
    if (!id) return;
    sheetRepo.listMySheets(id).then((rows) => (sheets = rows.filter((s) => !s.retired))).catch(() => {});
  });

  async function join(sheet: Sheet) {
    if (!target) return;
    busy = sheet.id;
    error = null;
    try {
      await campaignRepo.join(code, sheet.id);
      await goto(`${base}/c/${target.id}`);
    } catch (e) {
      error = campaignMessage(e, 'That character tripped on the doorstep! Try again.');
    } finally {
      busy = null;
    }
  }

  const back = $derived(`/join?code=${code}`);
</script>

<svelte:head><title>{target ? `Join ${target.name}` : 'Join a campaign'}</title></svelte:head>

{#if !looked || $session.loading || !landed}
  <div class="loading screen-center">
    <D20Loader size={56} label="Opening the invite" result={!looked || $session.loading ? null : target ? 20 : 1}
               onlanded={() => (landed = true)} />
  </div>
{:else if !target}
  <NotFound title="That invite doesn’t open any door!"
            message={error ?? 'It may have been replaced with a new one. Ask your DM for the current link.'} />
{:else}
  <main in:fade={{ duration: 200 }}>
    <a class="home" href="{base}/"><Logo size={26} /></a>
    <p class="eyebrow">You’re invited to</p>
    <h1>{target.name}</h1>

    {#if !$session.user}
      <p>Sign in to bring a character along.</p>
      <div class="row">
        <a class="btn" href="{base}/login?next={encodeURIComponent(back)}">Sign in</a>
        <a class="btn ghost" href="{base}/signup">Create an account</a>
      </div>
    {:else if sheets.length === 0}
      <p>You have no characters yet. Make one, then open this link again.</p>
      <div class="row"><a class="btn" href="{base}/">Your characters</a></div>
    {:else}
      <p>Which character joins?</p>
      <ul>
        {#each sheets as s (s.id)}
          {@const here = s.campaign_id === target.id}
          <li>
            <button onclick={() => join(s)} disabled={busy !== null || here}>
              <strong>{s.definition?.identity?.name || s.name}</strong>
              <span class="sub">{classLine(s.definition) || 'No class yet'} · level {characterLevel(s.definition)}</span>
              <span class="tag">{here ? 'Already in' : busy === s.id ? 'Joining…' : s.campaign_id ? 'Moves here' : 'Join'}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if error}<p class="err" role="alert">{error}</p>{/if}
  </main>
{/if}

<style>
  .loading { min-height: 60vh; }
  main { max-width: 32rem; margin: 0 auto; padding: 3rem 1rem 4rem; }
  .home { display: inline-grid; margin-bottom: 1.5rem; }
  .eyebrow { margin: 0; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--a); }
  h1 { margin: 0.25rem 0 1rem; font-size: 1.75rem; }
  p { color: var(--dim); }
  .row { display: flex; gap: 0.5rem; }
  .btn {
    display: inline-block; padding: 0.5rem 1rem; border-radius: var(--r-sm); text-decoration: none;
    border: 1px solid var(--a-edge); background: var(--a-wash); color: var(--a);
  }
  .btn.ghost { border-color: var(--line); background: var(--surface); color: var(--text); }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; }
  li button {
    width: 100%; display: grid; grid-template-columns: 1fr auto; grid-template-rows: auto auto; column-gap: 0.75rem;
    text-align: left; font: inherit; padding: 0.75rem 0.9rem; border-radius: var(--r); cursor: pointer;
    border: 1px solid var(--line); background: var(--surface); color: var(--text);
    transition: border-color 0.15s ease, transform 0.15s ease;
  }
  li button:hover:not(:disabled) { border-color: var(--a-edge); transform: translateY(-1px); }
  li button:disabled { cursor: default; opacity: 0.7; }
  .sub { grid-column: 1; font-size: 0.8125rem; color: var(--dim); }
  .tag { grid-column: 2; grid-row: 1 / 3; align-self: center; font-size: 0.8125rem; color: var(--a); }
  .err { color: var(--bad); }
</style>
