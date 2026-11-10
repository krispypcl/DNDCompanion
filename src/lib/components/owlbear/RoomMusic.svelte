<script lang="ts">
  /**
   * The table's music inside an Owlbear Rodeo room: a small player in the
   * corner that follows the DM's jukebox (lib/tableMusic, the same as the
   * campaign page). The DM, signed in here, leads it from the room too.
   * It stays open while the panel is shut; × puts it away.
   */
  import { onMount } from 'svelte';
  import { joinRoom, type Obr } from '$lib/owlbear/frame';
  import { fade } from 'svelte/transition';
  import { session } from '$lib/stores/session';
  import { campaignRepo, type Campaign } from '$lib/data/campaigns';
  import { TableMusic } from '$lib/tableMusic.svelte';
  import CampaignMusic from '../CampaignMusic.svelte';
  import InfoTip from '../InfoTip.svelte';
  import SoundToggle from '../SoundToggle.svelte';

  let obr = $state.raw<Obr | null>(null);
  let campaign = $state<Campaign | null>(null);
  let gone = $state(false);
  let music = $state.raw<TableMusic | null>(null);
  let box = $state<HTMLElement>();

  const isDm = $derived(Boolean(campaign && $session.user && campaign.created_by === $session.user.id));
  $effect(() => music?.setDm(isDm));

  async function read(id: string) {
    try {
      campaign = await campaignRepo.get(id);
      gone = !campaign;
    } catch {
      if (!campaign) gone = true;
    }
  }

  onMount(() => {
    const id = new URLSearchParams(location.search).get('c') ?? '';
    const stops: (() => void)[] = [];
    const m = new TableMusic(id);
    music = m;
    stops.push(m.start());
    void read(id);
    // The DM may add songs while the table plays: the list is read again now and then.
    const timer = setInterval(() => document.visibilityState === 'visible' && read(id), 60000);
    stops.push(() => clearInterval(timer));
    void joinRoom(stops).then((o) => (obr = o));
    return () => stops.forEach((s) => s());
  });

  // A song the list doesn't have yet (just added by the DM): read the list again.
  $effect(() => {
    const pb = music?.playback;
    if (!campaign || !pb?.url) return;
    if (campaign.details.songs?.[pb.index]?.url !== pb.url) void read(campaign.id);
  });

  /**
   * The popover takes the height its contents need, once they are there:
   * while it is still tuning up it keeps the size it opened at, so it grows
   * once rather than shrinking and growing again.
   */
  const settled = $derived(gone || Boolean(campaign && music?.ready));
  $effect(() => {
    if (!box || !obr || !settled) return;
    const o = obr;
    const el = box;
    const ro = new ResizeObserver(() => void o.sizeMusic(el.offsetHeight).catch(() => {}));
    ro.observe(el);
    return () => ro.disconnect();
  });
</script>

<svelte:head><title>Table music · DND Companion</title></svelte:head>

<main bind:this={box}>
  <header>
    <span class="cap">Table music</span>
    <InfoTip label="If you hear nothing">Turn the speaker on. Still quiet? Allow sound for owlbear.rodeo in your browser. Phones can’t play it here.</InfoTip>
    <span class="end"><SoundToggle /></span>
    <button class="closex" aria-label="Close the music" title="Close the music" onclick={() => obr?.closeMusic()}>×</button>
  </header>
  {#if gone}
    <p class="msg">This campaign has wandered off! It may have been deleted.</p>
  {:else if !campaign || !music?.ready}
    <p class="msg">Tuning up…</p>
  {:else if !campaign.details.songs?.length}
    <p class="msg">No music on this campaign yet. The DM adds songs on the campaign page.</p>
  {:else}
    <div in:fade={{ duration: 180 }}>
      <CampaignMusic campaignId={campaign.id} songs={campaign.details.songs ?? []} editing={false} room
                     lead={isDm} playback={music.table} away={music.away} onplayback={(p) => music?.send(p)}
                     onchange={async (songs) => {
                       if (!isDm || !campaign) return;
                       campaign = { ...campaign, details: { ...campaign.details, songs } };
                       await campaignRepo.saveDetails(campaign.id, campaign.details).catch(() => {});
                     }} />
    </div>
  {/if}
</main>

<style>
  :global(html.in-owlbear), :global(html.in-owlbear body) { background: transparent !important; }
  main { padding: 0.625rem 0.75rem 0.75rem; display: grid; gap: 0.5rem; }
  header { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
  .cap { font-size: 0.6875rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--label); flex: none; }
  .end { margin-left: auto; display: inline-flex; }
  .msg { margin: 0; color: var(--dim); font-size: 0.8125rem; line-height: 1.4; }
</style>
