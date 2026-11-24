<!--
  A section's title on the campaign page, the same for every section
  (Characters, Monsters & NPCs, In sight, Initiative, Table music, Table
  board): small capitals, its info bubble beside it, anything that belongs to
  the title after that (the round, the board's pages), and the section's own
  buttons at the right. No box: the content below carries its own.
  A foldable section's title is the button that folds it.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import InfoTip from './InfoTip.svelte';

  let {
    title,
    info,
    infoLabel = `About ${title.toLowerCase()}`,
    children,
    end,
    folded,
    ontoggle,
    controls
  }: {
    title: string;
    /** What goes in the info bubble beside the title. */
    info?: Snippet;
    infoLabel?: string;
    /** After the title and its bubble (a round, page tabs). */
    children?: Snippet;
    /** At the right: the section's own buttons. */
    end?: Snippet;
    /** Foldable: whether it is folded now, and how to fold or open it. */
    folded?: boolean;
    ontoggle?: () => void;
    /** The id of what the fold button shows and hides. */
    controls?: string;
  } = $props();
</script>

<div class="sechead">
  <h2 class="sectitle">
    {#if ontoggle}
      <button class="secfold" aria-expanded={!folded} aria-controls={controls} onclick={ontoggle}
              title={folded ? `Show ${title.toLowerCase()}` : `Fold ${title.toLowerCase()} away`}>{title}</button>
    {:else}{title}{/if}
  </h2>
  {#if info}<InfoTip label={infoLabel}>{@render info()}</InfoTip>{/if}
  {#if children}{@render children()}{/if}
  {#if end}<div class="secend">{@render end()}</div>{/if}
</div>

<style>
  .sechead { display: flex; align-items: center; gap: 0.5rem 0.75rem; flex-wrap: wrap; margin-bottom: 0.625rem; min-height: 1.875rem; }
  .sectitle {
    margin: 0; display: inline-flex; align-items: center;
    font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--label); font-weight: 600;
  }
  .secend { display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; margin-left: auto; }
  .secfold {
    font: inherit; letter-spacing: inherit; text-transform: inherit; color: inherit; cursor: pointer;
    display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.625rem; margin-left: -0.625rem;
    border: 1px solid transparent; border-radius: 999px; background: none;
    transition: border-color 0.15s var(--ease-out), color 0.15s var(--ease-out), transform 0.08s var(--ease-out);
  }
  .secfold::after {
    content: ''; width: 0.4rem; height: 0.4rem; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor;
    transform: rotate(-135deg) translateY(-1px); transition: transform 0.2s var(--ease-out);
  }
  .secfold[aria-expanded='false']::after { transform: rotate(45deg) translateY(-1px); }
  .secfold:hover { border-color: var(--a-edge); color: var(--a); }
  .secfold:active { transform: translateY(1px); }
  .secfold:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
</style>
