<script lang="ts">
  /**
   * The main menu's hello, and under it when the table next meets, counted
   * down, with the campaign as a button (or one plain line when nothing is
   * set).
   */
  import { base } from '$app/paths';
  import type { Campaign } from '$lib/data/campaigns';
  import { faceFamily, fontFace } from '$lib/rules/fonts';

  let {
    name,
    next,
    hasCampaigns
  }: {
    name: string;
    /** The soonest session: its campaign, the countdown ("in 2 h 15 min", "now") and the day and time. */
    next: { c: Campaign; count: string; when: string } | null;
    hasCampaigns: boolean;
  } = $props();
</script>

<section class="greet" aria-label="Welcome">
  <p class="greethi">Hello, {name}!</p>
  <p class="greetnext">
    {#if next}
      <a class="smallbtn accent greetcamp" href="{base}/c/{next.c.id}" style:font-family={faceFamily(fontFace(next.c.details?.nameFont))}>{next.c.name}</a>
      <span class="greetcount" class:now={next.count === 'now'}>{next.count === 'now' ? 'is on now' : `starts ${next.count}`}</span>
      <span class="greetwhen">{next.when}</span>
    {:else if hasCampaigns}
      No session on the calendar yet.
    {:else}
      Ready when you are: make a character, or start a campaign for your table.
    {/if}
  </p>
</section>

<style>
  .greet { display: grid; gap: 0.375rem; flex: 1 1 20rem; min-width: 0; }
  .greethi { margin: 0; font-family: var(--font-display, inherit); font-size: 1.5rem; font-weight: 650; line-height: 1.2; overflow-wrap: anywhere; }
  .greetnext {
    margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem 0.5rem;
    min-height: 1.875rem; font-size: 0.9375rem; color: var(--dim);
  }
  .greetcamp { font-size: 0.875rem; }
  .greetcount { color: var(--text); }
  .greetcount.now { color: var(--a); font-weight: 600; }
  .greetwhen { color: var(--faint); font-size: 0.8125rem; }
  .greetwhen::before { content: '·'; margin-right: 0.5rem; color: var(--faint); }
  @media (max-width: 700px) { .greethi { font-size: 1.375rem; } }
  /* A phone: the countdown says enough; the date would wrap onto a line of its own. */
  @media (max-width: 480px) { .greetwhen { display: none; } }
</style>
