<script lang="ts">
  /**
   * A labelled panel that folds open and shut, as the Combat tab's reference
   * lists do. Collapsed by default; what it holds is styled by whoever fills it.
   */
  import type { Snippet } from 'svelte';

  let { label, open = $bindable(false), children }: { label: string; open?: boolean; children: Snippet } = $props();
</script>

<details class="fold" bind:open>
  <summary><span class="cap">{label}</span></summary>
  <!-- A wrapper so browsers without ::details-content still have something to
       animate when the panel opens. -->
  <div class="inner">{@render children()}</div>
</details>

<style>
  .fold { padding-top: 1.25rem; }
  summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  summary::-webkit-details-marker { display: none; }
  summary::after {
    content: '';
    width: 0.4rem;
    height: 0.4rem;
    border-right: 1.5px solid var(--dim);
    border-bottom: 1.5px solid var(--dim);
    transform: rotate(45deg) translateY(-1px);
    transition: transform 0.2s ease;
  }
  .fold[open] summary::after { transform: rotate(-135deg) translateY(-1px); }

  /* Unfolding. Where ::details-content exists the height animates both ways;
     elsewhere the open state is animated and closing snaps, which is the
     direction nobody watches. */
  .fold::details-content {
    block-size: 0;
    opacity: 0;
    overflow: hidden;
    transition:
      block-size 0.32s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.26s ease,
      content-visibility 0.32s allow-discrete;
  }
  .fold[open]::details-content { block-size: auto; opacity: 1; }

  @supports not selector(::details-content) {
    .fold[open] .inner { animation: unfold 0.3s cubic-bezier(0.22, 1, 0.36, 1) both; }
  }
  @keyframes unfold {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: none; }
  }
  .cap {
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--label);
    font-weight: 600;
  }
</style>
