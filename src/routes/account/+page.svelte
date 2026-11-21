<script lang="ts">
  import InfoTip from '#lib/components/InfoTip.svelte';
  import NotFound from '#lib/components/NotFound.svelte';
  import { pageTitle } from '#lib/title.ts';
  import { profile } from '#lib/stores/profile.ts';
  /**
   * The player's own account: how they appear (a name and a picture, the
   * picture by link like a portrait) and signing out, their password, the
   * services they sign in with, and who can see what they make.
   */
  import { base } from '#lib/base.ts';
  import { goto } from '$app/navigation';
  import Avatar from '#lib/components/Avatar.svelte';
  import Lightbox from '#lib/components/Lightbox.svelte';
  import ModeToggle from '#lib/components/ModeToggle.svelte';
  import BackLink from '#lib/components/BackLink.svelte';
  import D20Loader from '#lib/components/D20Loader.svelte';
  import {
    deleteAccount, enabledProviders, profileOf, PROVIDER_NAMES, providersOf, sheetsPrivate,
    setSheetsPrivate, signOut, signOutEverywhere, unlinkProvider, updatePassword, updateProfile,
    type OAuthProvider
  } from '#lib/data/session.ts';
  import OAuthButton from '#lib/components/OAuthButton.svelte';
  import ProviderIcon from '#lib/components/ProviderIcon.svelte';
  import { slide } from 'svelte/transition';
  import { passwordStrength } from '#lib/rules/password.ts';
  import { resolveImageUrl } from '#lib/rules/imageUrl.ts';
  import { session } from '#lib/stores/session.ts';
  import { friendlyError } from '#lib/errors.ts';
  import Switch from '#lib/components/Switch.svelte';
  import Choice from '#lib/components/Choice.svelte';
  import { settleIn } from '#lib/motion.ts';
  import { chooseMode, modeChoice, type ModeChoice } from '#lib/stores/mode.ts';
  import { savePrefs, setDiceStyle, setReduceMotion, storedDice, storedReduceMotion, type DiceStyle, type Prefs } from '#lib/prefs.ts';
  import { sheetRepo } from '#lib/data/sheets.ts';
  import { campaignRepo } from '#lib/data/campaigns.ts';
  import { characterLevel, mainClass } from '#lib/rules/derived.ts';
  import { numericDate } from '#lib/rules/dates.ts';
  import { setSharing, sharing } from '#lib/library.ts';

  const MIN_PASSWORD = 8;

  let name = $state('');
  let picture = $state('');
  let filled = $state(false);
  /** What the profile says now: shown until the fields are filled, so the picture never starts as "?". */
  const known = $derived($session.user ? profileOf($session.user, $profile) : null);
  // Filled once, when the profile has loaded (typing isn't overwritten after).
  $effect(() => {
    const user = $session.user;
    if (!user || !$profile || filled) return;
    const p = profileOf(user, $profile);
    name = p.displayName;
    picture = p.avatarUrl;
    filled = true;
  });

  const link = $derived(resolveImageUrl(picture));
  let loaded = $state<Record<string, 'ok' | 'failed'>>({});
  let viewing = $state(false);
  let viewFrom = $state<Element | null>(null);

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
      profileMsg = { ok: false, text: friendlyError(err, 'Your profile didn’t save! Try again in a moment.') };
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
    if (pw.length < MIN_PASSWORD) return (pwMsg = { ok: false, text: `That password is a bit short! Use at least ${MIN_PASSWORD} characters.` });
    if (strength.score === 0) return (pwMsg = { ok: false, text: 'Even a goblin could guess that password! Try a longer one.' });
    if (pw !== pw2) return (pwMsg = { ok: false, text: 'Those two passwords don’t match! Type them again.' });
    savingPw = true;
    try {
      await updatePassword(pw);
      pw = pw2 = '';
      pwMsg = { ok: true, text: 'Password changed.' };
    } catch (err) {
      pwMsg = { ok: false, text: friendlyError(err, 'Your password didn’t change! Try again in a moment.') };
    } finally {
      savingPw = false;
    }
  }

  /** The shared library: on unless turned off here. Off takes back what was shared. */
  let shareBusy = $state(false);
  let shareMsg = $state<{ ok: boolean; text: string } | null>(null);
  async function toggleSharing(on: boolean) {
    shareBusy = true;
    shareMsg = null;
    const done = await setSharing(on);
    shareBusy = false;
    shareMsg = done.ok
      ? { ok: true, text: on ? 'Sharing again. Your rows join the library the next time you open a sheet.' : 'Stopped. Your rows are back out of the library.' }
      : { ok: false, text: friendlyError(done.message, 'The library didn’t listen! Try again in a moment.') };
  }

  /* Private sheets: every sheet of this account seen only by its owner and
     the DM of its campaign (database/0014). */
  let privateBusy = $state(false);
  let privateMsg = $state<{ ok: boolean; text: string } | null>(null);
  async function togglePrivate(on: boolean) {
    privateBusy = true;
    privateMsg = null;
    try {
      await setSheetsPrivate(on);
      privateMsg = { ok: true, text: on ? 'Private. Only you and your DMs can open your sheets now.' : 'Open again. Anyone with a link can read your sheets.' };
    } catch (err) {
      privateMsg = { ok: false, text: friendlyError(err, 'Your sheets didn’t listen! Try again in a moment.') };
    } finally {
      privateBusy = false;
    }
  }

  /** Connections: Google, and Discord once it is switched on in Supabase. */
  const SERVICES: OAuthProvider[] = ['google', 'discord'];
  let switchedOn = $state<Partial<Record<string, boolean>>>({ google: true });
  /** Until the services are known, the rows show as skeletons (no jump when Discord appears). */
  let servicesKnown = $state(false);
  $effect(() => {
    enabledProviders().then((on) => {
      switchedOn = { google: true, ...on };
      servicesKnown = true;
    });
  });
  const linked = $derived(providersOf($session.user));
  let unlinking = $state<OAuthProvider | null>(null);
  let connMsg = $state<{ ok: boolean; text: string } | null>(null);
  async function unlink(p: OAuthProvider) {
    unlinking = p;
    connMsg = null;
    try {
      await unlinkProvider(p);
      connMsg = { ok: true, text: `${PROVIDER_NAMES[p]} is off your account.` };
    } catch (err) {
      connMsg = { ok: false, text: friendlyError(err, `${PROVIDER_NAMES[p]} wouldn’t let go! Try again in a moment.`) };
    } finally {
      unlinking = null;
    }
  }

  /*
   * Preferences: the look, dice and motion apply to this device at once and
   * are kept on the account.
   */
  /** Follows the header's own switch too. */
  const look = $derived($modeChoice);
  let dice = $state<DiceStyle>(storedDice());
  let calm = $state(storedReduceMotion());
  let prefMsg = $state<{ ok: boolean; text: string } | null>(null);
  async function keep(patch: Prefs) {
    prefMsg = null;
    try {
      await savePrefs(patch);
    } catch (err) {
      prefMsg = { ok: false, text: friendlyError(err, 'Your preferences didn’t stick to your account! They still apply here.') };
    }
  }
  function setLook(next: ModeChoice) {
    chooseMode(next);
    void keep({ mode: next });
  }
  function setDice(next: DiceStyle) {
    dice = next;
    setDiceStyle(next);
    void keep({ dice: next });
  }
  function setCalm(on: boolean) {
    calm = on;
    setReduceMotion(on);
    void keep({ reduceMotion: on });
  }

  /** Statistics: counted from the account's sheets and campaigns. */
  type Stats = {
    characters: number; retired: number; highest: { level: number; name: string } | null;
    favorite: string | null; favoriteCount: number; run: number; ended: number; joined: number;
  };
  let stats = $state<Stats | null>(null);
  let statsError = $state<string | null>(null);
  let counted: string | null = null;
  $effect(() => {
    const id = $session.user?.id;
    if (!id || counted === id) return;
    counted = id;
    Promise.all([sheetRepo.listMySheets(id), campaignRepo.mine(id)])
      .then(async ([mine, run]) => {
        const theirs = (await campaignRepo.byIds(mine.map((s) => s.campaign_id ?? '')).catch(() => [])).filter((c) => c.created_by !== id);
        let highest: Stats['highest'] = null;
        const classes = new Map<string, number>();
        for (const s of mine) {
          if (!s.definition) continue;
          const level = characterLevel(s.definition);
          if (!highest || level > highest.level) highest = { level, name: s.definition.identity?.name?.trim() || s.name };
          const main = mainClass(s.definition);
          if (main) classes.set(main, (classes.get(main) ?? 0) + 1);
        }
        const top = [...classes.entries()].sort((a, b) => b[1] - a[1])[0];
        stats = {
          characters: mine.length,
          retired: mine.filter((s) => s.retired).length,
          highest,
          favorite: top?.[0] ?? null,
          favoriteCount: top?.[1] ?? 0,
          run: run.length,
          ended: run.filter((c) => c.archived).length,
          joined: theirs.length
        };
      })
      .catch((err) => (statsError = friendlyError(err, 'Your adventures wouldn’t add up! Try again in a moment.')));
  });

  let confirmEverywhere = $state(false);

  /** Deleting the account: a button, then the phrase typed out, then gone. */
  const PHRASE = 'IHATEDND';
  let deletingOpen = $state(false);
  let typed = $state('');
  let deleting = $state(false);
  let deleteMsg = $state<string | null>(null);
  async function deleteForGood(e: SubmitEvent) {
    e.preventDefault();
    if (typed !== PHRASE) return;
    deleting = true;
    deleteMsg = null;
    try {
      await deleteAccount();
      goto(`${base}/`);
    } catch (err) {
      deleteMsg = friendlyError(err, 'Your account refused to go! Try again in a moment.');
    } finally {
      deleting = false;
    }
  }
  async function leave(everywhere: boolean) {
    if (everywhere) await signOutEverywhere();
    else await signOut();
    goto(`${base}/`);
  }
</script>

<svelte:head>{#if $session.loading || $session.user}<title>{pageTitle('Account')}</title>{/if}</svelte:head>

{#if !$session.loading && !$session.user}
  <!-- Signed out: the same page as a link that leads nowhere, with the way in. -->
  <NotFound tab="Sign in needed" title="Who goes there?"
            message="This door only opens for its owner. Sign in to see your account, your connections and your privacy settings."
            action={{ href: `${base}/login?next=${encodeURIComponent('/account')}`, label: 'Sign in' }} home={false} />
{:else}
<main>
  <!-- Back at the left and the mode at the right; on a phone the other way round, as every page's top bar. -->
  <header>
    <BackLink href="{base}/" title="Back to your characters and campaigns" />
    <ModeToggle />
  </header>

  {#if $session.loading || !$session.user}
    <div class="screen-center"><D20Loader size={56} label="Loading your account" /></div>
  {:else}
    <h1 class="title">Account</h1>

    <!-- On a wide screen the cards flow down columns, like a board of notes. -->
    <div class="cards">

    <form class="card" onsubmit={saveProfile} aria-labelledby="profile-h">
      <h2 id="profile-h">Profile</h2>
      <div class="who">
        <button type="button" class="pic" disabled={!link.url || loaded[link.url] !== 'ok'}
                aria-label="View profile picture full screen" onclick={(e) => { viewFrom = e.currentTarget; viewing = true; }}>
          <Avatar url={filled ? picture : (known?.avatarUrl ?? '')} name={(filled ? name : known?.displayName) || $session.user.email || '?'} size={72} />
        </button>
        <div class="grow">
          <label for="name">Display name</label>
          <input id="name" bind:value={name} maxlength="40" placeholder="What the table calls you" autocomplete="nickname" />
        </div>
      </div>
      <label for="pic">Profile picture URL</label>
      <input id="pic" bind:value={picture} placeholder="Paste an image link: Google Drive, Imgur, Pinterest or Dropbox" />
      {#if link.url}
        <img class="probe" src={link.url} alt="" onload={() => (loaded[link.url] = 'ok')} onerror={() => (loaded[link.url] = 'failed')} />
      {/if}
      {#if link.url && loaded[link.url] === 'failed'}
        <p class="note bad">That link didn’t turn into a picture! Open the picture itself and copy its image address.</p>
      {:else if link.note}
        <p class="note" class:bad={link.source === 'invalid'}>{link.note}</p>
      {/if}
      <p class="email">Signed in as <b>{$session.user.email}</b></p>
      {#if profileMsg}<p class="msg" class:bad={!profileMsg.ok} role="status">{profileMsg.text}</p>{/if}
      <!-- Signing out at the left, saving at the right, on one line. -->
      <div class="row split">
        <button type="button" class="btn" onclick={() => leave(false)}>Sign out</button>
        {#if confirmEverywhere}
          <button type="button" class="btn danger" onclick={() => leave(true)}>Yes, sign out everywhere</button>
        {:else}
          <button type="button" class="btn" onclick={() => (confirmEverywhere = true)}>Sign out everywhere</button>
        {/if}
        <InfoTip label="About signing out everywhere">Signing out everywhere ends every session on every device, this one included,
          which helps after signing in on someone else's phone.</InfoTip>
        <button class="btn primary save" disabled={savingProfile}>{savingProfile ? 'Saving' : 'Save profile'}</button>
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
        <button class="btn primary" disabled={savingPw || !pw}>{savingPw ? 'Changing' : 'Change password'}</button>
      </div>
    </form>

    <!-- Connections: the services this account signs in with, besides its email. -->
    <section class="card" aria-labelledby="conn-h">
      <h2 id="conn-h">Connections
        <InfoTip label="About connections">Connect another account to sign in with one press next time, as well as with
          your email. Taking one off leaves your sheets and campaigns as they are; your last way in can't be taken off.</InfoTip>
      </h2>
      <ul class="conns">
        {#if !servicesKnown}
          {#each SERVICES as p (p)}<li aria-hidden="true"><i class="skeleton sk-conn"></i><i class="skeleton sk-btn"></i></li>{/each}
        {/if}
        {#each servicesKnown ? SERVICES.filter((p) => switchedOn[p] || linked.includes(p)) : [] as p (p)}
          <li out:slide={{ duration: 200 }}>
            {#if linked.includes(p)}
              <span class="linked">
                <ProviderIcon provider={p} />
                {PROVIDER_NAMES[p]} is connected.
              </span>
              {#if linked.length > 1}
                <button class="btn" disabled={unlinking === p} onclick={() => unlink(p)}>{unlinking === p ? 'Disconnecting' : 'Disconnect'}</button>
              {/if}
            {:else}
              <!-- Not yet: said in gray where "connected" would be, the way to connect at the right. -->
              <span class="linked off">
                <ProviderIcon provider={p} />
                {PROVIDER_NAMES[p]} is not yet connected.
              </span>
              <OAuthButton provider={p} link compact bare label="Connect" next="/account" />
            {/if}
          </li>
        {/each}
      </ul>
      {#if connMsg}<p class="msg" class:bad={!connMsg.ok} role="status">{connMsg.text}</p>{/if}
    </section>

    <section class="card" aria-labelledby="pref-h">
      <h2 id="pref-h">Preferences
        <InfoTip label="About preferences">The look, motion and dice apply to this device straight away and are
          saved to your account, so a device you sign in on for the first time starts the same way.</InfoTip>
      </h2>
      <div class="prefs">
        <span class="pref-name">Look</span>
        <Choice label="Light, dark or your device's own" value={look} onchange={setLook}
                options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]} />
        <span class="pref-name">Dice
          <InfoTip label="About the dice style">How the dice roller shows a roll. <b>Tumble</b>: the dice spin through
            their faces for a moment, then land. <b>Quick</b>: the total shows at once. Sound plays either way.</InfoTip>
        </span>
        <Choice label="How the dice roller shows a roll" value={dice} onchange={setDice}
                options={[{ value: 'tumble', label: 'Tumble' }, { value: 'quick', label: 'Quick' }]} />
        <span class="pref-name">Motion</span>
        <Switch checked={calm} label="Reduce motion" onchange={setCalm}
                title="Fewer and shorter animations, whatever your device is set to" />
      </div>
      {#if prefMsg}<p class="msg" class:bad={!prefMsg.ok} role="status">{prefMsg.text}</p>{/if}

      <h3 class="sub-h">Privacy
        <InfoTip label="About privacy"><b>Share my rows.</b> When you type a name in a table (an attack, spell, item,
          feature or tracker), rows other players have written are offered, ready to use. Your own rows are shared the
          same way, without your name: only players you share a campaign with can see who wrote them. Turning it off
          takes back everything you have shared.<br /><br /><b>Keep my sheets private.</b> Every sheet you have, and every
          one you make, can then be opened only by you and by the DM of the campaign it is in. Other players, your
          campaign mates included, no longer see it or its card, and its share link stops working for anyone else.
          Turning it off opens them again.</InfoTip>
      </h3>
      <div class="switches">
        <Switch checked={sharing($profile)} label="Share my rows" disabled={shareBusy}
                title="Turning it off takes back everything you have shared"
                onchange={toggleSharing} />
        {#if shareMsg}<span class="msg" class:bad={!shareMsg.ok} role="status">{shareMsg.text}</span>{/if}
        <Switch checked={sheetsPrivate($profile)} label="Keep my sheets private" disabled={privateBusy}
                title="Only you and your DMs can open your sheets"
                onchange={togglePrivate} />
        {#if privateMsg}<span class="msg" class:bad={!privateMsg.ok} role="status">{privateMsg.text}</span>{/if}
      </div>
      <!-- The whole policy: what is kept, where, and how to remove it. -->
      <a class="smallbtn policylink" href="{base}/privacy?from=account">
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /><path d="m9 12 2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
        Privacy policy
      </a>
    </section>

    <section class="card" aria-labelledby="stats-h">
      <h2 id="stats-h">Statistics</h2>
      {#if stats}
        <dl class="stats" in:settleIn>
          <div><dt>Larper since</dt><dd>{numericDate($session.user.created_at) || 'Unknown'}</dd></div>
          <div><dt>Characters</dt><dd>{stats.characters}{#if stats.retired}<small>{stats.retired} retired</small>{/if}</dd></div>
          <div><dt>Highest level</dt><dd>{stats.highest ? stats.highest.level : 'None'}{#if stats.highest}<small>{stats.highest.name}</small>{/if}</dd></div>
          <div><dt>Favorite class</dt><dd>{stats.favorite ?? 'None yet'}{#if stats.favoriteCount > 1}<small>{stats.favoriteCount} characters</small>{/if}</dd></div>
          <div><dt>Campaigns run</dt><dd>{stats.run}{#if stats.ended}<small>{stats.ended} ended</small>{/if}</dd></div>
          <div><dt>Campaigns joined</dt><dd>{stats.joined}</dd></div>
        </dl>
      {:else if statsError}
        <p class="msg bad">{statsError}</p>
      {:else}
        <!-- The tiles' outline while the numbers are counted, the same size as
             the real ones, so the page doesn't move when they arrive. -->
        <dl class="stats" aria-busy="true" aria-label="Counting your adventures">
          {#each Array(6) as _, i (i)}<div><dt><i class="skeleton sk-label"></i></dt><dd><i class="skeleton sk-value"></i><i class="skeleton sk-small"></i></dd></div>{/each}
        </dl>
      {/if}
    </section>

    <section class="card danger-zone" aria-labelledby="del-h">
      <h2 id="del-h">Delete account</h2>
      <p class="dim">Deletes your account and every sheet you have made, with all their notes and
        backstories. Shared links to them stop working.</p>
      {#if !deletingOpen}
        <div class="row">
          <button class="btn danger" onclick={() => (deletingOpen = true)}>Delete my account</button>
        </div>
      {:else}
        <form onsubmit={deleteForGood} transition:slide={{ duration: 200 }}>
          <label for="phrase">Type <b>{PHRASE}</b> to finalize deletion. This is irreversible and cannot be undone.</label>
          <input id="phrase" bind:value={typed} autocomplete="off" autocapitalize="characters" spellcheck="false"
                 placeholder={PHRASE} />
          {#if deleteMsg}<p class="msg bad" role="alert">{deleteMsg}</p>{/if}
          <div class="row">
            <button type="button" class="btn" onclick={() => { deletingOpen = false; typed = ''; deleteMsg = null; }}>Keep my account</button>
            <button class="btn danger solid" disabled={typed !== PHRASE || deleting}>
              {deleting ? 'Deleting' : 'Delete everything'}
            </button>
          </div>
        </form>
      {/if}
    </section>
    </div>
  {/if}
</main>
{/if}

{#if viewing && link.url}
  <Lightbox src={link.url} alt="Profile picture" from={viewFrom} onclose={() => (viewing = false)} />
{/if}

<style>
  .linked { display: flex; align-items: center; gap: 0.5rem; color: var(--a); margin: 0.5rem 0 0; }
  .conns { list-style: none; margin: 0.5rem 0 0; padding: 0; display: grid; gap: 0.5rem; }
  .conns li { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; min-height: 2.5rem; }
  .conns .linked { margin: 0; font-size: 0.875rem; }
  .conns .linked.off { color: var(--faint); }
  /* Not connected yet: the service's mark, grayed. */
  .conns .linked.off :global(.provider-icon) { filter: grayscale(1); opacity: 0.55; }
  /* An OAuthButton's message sits under the row. */
  .conns li :global(.err) { flex-basis: 100%; text-align: right; }
  /* The switches sit at the left, each with its message under it. */
  .switches { display: grid; justify-items: start; gap: 0.375rem; margin-top: 0.25rem; }
  .policylink { justify-self: start; margin-top: 0.875rem; }
  .policylink svg { flex: none; transition: transform 0.35s cubic-bezier(0.33, 1, 0.68, 1); }
  .policylink:hover svg { transform: translateY(-1px) scale(1.08); }
  @media (prefers-reduced-motion: reduce) { .policylink svg { transition: none; } }
  /* Preferences: a name at the left, its control beside it. */
  .prefs { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 0.625rem 1rem; margin-top: 0.25rem; }
  .pref-name { font-size: 0.8125rem; color: var(--dim); display: inline-flex; align-items: center; gap: 0.125rem; }
  .prefs > :global(*) { justify-self: start; }
  .sub-h {
    font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--label); font-weight: 600;
    margin: 1rem 0 0; padding-top: 1rem; border-top: 1px solid var(--line-soft); display: flex; align-items: center; gap: 0.125rem;
  }
  /* Statistics: tiles of a number and what it counts. */
  .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: 0.5rem; margin: 0.25rem 0 0; }
  .stats div { background: var(--raised); border: 1px solid var(--line-soft); border-radius: var(--r-sm); padding: 0.625rem 0.75rem; }
  .stats dt { font-size: 0.6875rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--label); }
  .stats dd { margin: 0.25rem 0 0; font-size: 1.25rem; font-weight: 650; font-variant-numeric: tabular-nums; display: grid; }
  .sk-label { width: 70%; height: 0.6875rem; margin-top: 0.125rem; }
  .sk-value { width: 45%; height: 1.25rem; margin-top: 0.125rem; }
  .sk-small { width: 55%; height: 0.75rem; margin-top: 0.3125rem; }
  .sk-conn { height: 1rem; width: 12rem; }
  .sk-btn { height: 2.125rem; width: 6rem; border-radius: var(--r-sm); }
  .stats small { font-size: 0.75rem; font-weight: 400; color: var(--dim); overflow-wrap: anywhere; }
  .switches .msg { margin: 0 0 0.25rem; }
  /* The tracks line up under each other, whatever the label's length. */
  .switches :global(.switch .label) { min-width: 10rem; text-align: left; }
  /* Sign out and Sign out everywhere at the left, Save at the right. */
  .row.split { justify-content: flex-start; }
  .row.split .save { margin-left: auto; }
  /* A phone: Save across the top, the two ways out side by side under it. */
  @media (max-width: 520px) {
    .row.split { display: grid; grid-template-columns: auto auto 1fr; }
    .row.split .save { grid-column: 1 / -1; order: -1; margin-left: 0; }
    .row.split .btn { white-space: nowrap; }
    /* Preferences: each name above its control. */
    .prefs { grid-template-columns: minmax(0, 1fr); gap: 0.375rem; }
    .prefs > .pref-name:not(:first-child) { margin-top: 0.5rem; }
  }
  /* A Connect button keeps to the right, also when it wraps under its line. */
  .conns li > :global(.oauth) { margin-left: auto; }
  p.msg { margin: 0.25rem 0 0; }
  h2 { display: flex; align-items: center; gap: 0.125rem; }
  /* As wide as every other page (app.css --page-width); the cards flow into
     columns as the width allows, one on a phone. */
  main { max-width: var(--page-width); margin: 0 auto; padding: 1.5rem var(--page-pad) 3rem; }
  .cards { columns: 3 30rem; column-gap: 1rem; }
  .cards > :global(*) { break-inside: avoid; }
  @media (max-width: 600px) { main { padding-left: 1rem; padding-right: 1rem; } }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
  @media (max-width: 700px) {
    header { flex-direction: row-reverse; }
    header > :global(.mode) { width: 2.25rem; height: 2.25rem; }
  }
  .title { font-size: 1.5rem; font-weight: 650; margin: 0 0 1rem; letter-spacing: -0.01em; }
  .card {
    background: var(--surface); border: 1px solid var(--line-soft); border-radius: var(--r);
    padding: 1.125rem; margin-bottom: 1rem; display: grid; gap: 0.5rem;
  }
  /* The page rises in as a whole (the layout's own entrance); the cards no
     longer rise a second time on top of it. */
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
  /* Deleting is red whatever the account's theme: it is not a themed action. */
  .danger-zone { --danger: oklch(62% 0.2 25); border-color: oklch(62% 0.2 25 / 0.35); }
  .danger-zone .btn.danger:hover:not(:disabled) { background: oklch(62% 0.2 25 / 0.12); color: var(--danger); border-color: var(--danger); }
  .btn.danger.solid { background: var(--danger); color: white; font-weight: 650; }
  .btn.danger.solid:hover:not(:disabled) { background: var(--danger); color: white; filter: brightness(1.1); }
  .danger-zone form { display: grid; gap: 0.5rem; }
  .danger-zone label b { color: var(--text); letter-spacing: 0.04em; }
  .danger-zone .msg { margin: 0; }
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
