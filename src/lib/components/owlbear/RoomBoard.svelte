<script lang="ts">
  /**
   * The campaign's board over the whole Owlbear Rodeo room: the same board
   * as on the campaign page, live. Its DM and players (signed in from the
   * DND Companion panel) draw and write on it; anyone else in the room reads.
   */
  import { onMount } from 'svelte';
  import { joinRoom, type Obr } from '$lib/owlbear/frame';
  import { fade } from 'svelte/transition';
  import { session } from '$lib/stores/session';
  import { campaignRepo, type Campaign } from '$lib/data/campaigns';
  import { sheetRepo } from '$lib/data/sheets';
  import CampaignBoard from '../CampaignBoard.svelte';
  import InfoTip from '../InfoTip.svelte';

  let obr = $state.raw<Obr | null>(null);
  let campaign = $state<Campaign | null>(null);
  let owners = $state<string[]>([]);
  let gone = $state(false);

  const me = $derived($session.user?.id ?? null);
  const member = $derived(Boolean(campaign && me && (campaign.created_by === me || owners.includes(me))));
  const canEdit = $derived(member && !campaign?.archived);

  onMount(() => {
    const id = new URLSearchParams(location.search).get('c') ?? '';
    const stops: (() => void)[] = [];
    Promise.all([campaignRepo.get(id), sheetRepo.listCampaignSheets(id)])
      .then(([c, rows]) => {
        campaign = c;
        gone = !c;
        owners = rows.map((r) => r.owner_id);
      })
      .catch(() => (gone = true));
    void joinRoom(stops).then((o) => (obr = o));
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === 'Escape' && !(t && (t.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t.tagName)))) void obr?.closeBoard();
    };
    window.addEventListener('keydown', onKey);
    stops.push(() => window.removeEventListener('keydown', onKey));
    return () => stops.forEach((s) => s());
  });
</script>

<svelte:head><title>Board · DND Companion</title></svelte:head>

<main>
  <header>
    <h1>{campaign?.name ?? 'Board'}</h1>
    {#if campaign}
      <InfoTip label="About the board">
        {#if canEdit}
          The campaign’s board, the same one as on its page: what you draw and write here everyone in the campaign sees.
        {:else if member}
          This campaign has ended, so its board stays as the story left it.
        {:else}
          The campaign’s board, live. To draw or write on it, sign in from the DND Companion panel with an account that
          runs or plays in this campaign.
        {/if}
      </InfoTip>
      <a class="smallbtn open" href={obr?.campaignUrl(campaign.id)} target="_blank" rel="noopener noreferrer">Campaign ↗</a>
    {/if}
    <button class="closex" aria-label="Close the board" title="Close the board (Esc)" onclick={() => obr?.closeBoard()}>×</button>
  </header>
  {#if gone}
    <p class="msg">This campaign has wandered off! It may have been deleted.</p>
  {:else if !campaign}
    <p class="msg">Unrolling the board…</p>
  {:else}
    <div class="board" in:fade={{ duration: 200 }}>
      <CampaignBoard campaignId={campaign.id} userId={me} {canEdit} />
    </div>
  {/if}
</main>

<style>
  :global(html.in-owlbear body) { background: var(--bg); }
  main { height: 100dvh; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 0.5rem; padding: 0.75rem 1rem 1rem; box-sizing: border-box; }
  header { display: flex; align-items: center; gap: 0.625rem; min-width: 0; }
  h1 { margin: 0; font-size: 1.125rem; min-width: 0; overflow-wrap: anywhere; }
  .open { margin-left: auto; }
  .msg { margin: 0; color: var(--dim); }
  /* The board takes the whole room below its heading. */
  .board { min-height: 0; display: grid; }
  .board :global(.boardwrap) { margin: 0; display: flex; flex-direction: column; min-height: 0; }
  .board :global(.boardwrap > .board) { flex: 1 1 auto; height: auto; min-height: 12rem; }
</style>
