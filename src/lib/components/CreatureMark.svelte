<!-- A monster's horned face or an NPC's bust: what a creature shows with no portrait. -->
<script lang="ts">
  let { kind, size = '1.625rem' }: { kind: 'monster' | 'npc'; size?: string } = $props();
</script>

<svg class="creaturemark" viewBox="0 0 24 24" aria-hidden="true" style:width={size} style:height={size}>
  {#if kind === 'npc'}
    <circle cx="12" cy="8.5" r="3.75" /><path d="M4.75 20c.6-3.9 3.6-6.25 7.25-6.25s6.65 2.35 7.25 6.25" />
  {:else}
    <path d="M8.25 8.5 5 3.25l.75 6.25M15.75 8.5 19 3.25l-.75 6.25" /><circle cx="12" cy="14" r="6.25" /><path d="M9.75 13.5h.01M14.25 13.5h.01M10 17.25h4" />
  {/if}
</svg>

<style>
  .creaturemark { flex: none; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
</style>
