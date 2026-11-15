<!--
  A sheet without a portrait yet shows its main class instead: a bow for a
  ranger, a dagger for a rogue, a sword for a fighter. Line drawings in the
  character's accent, on the portrait's own wash; anything unknown gets the
  app's d20.
-->
<script lang="ts" module>
  /** Each class's drawing, on a 24-unit square, in strokes. */
  const ICONS: Record<string, string[]> = {
    fighter: ['M20.5 3.5 20 7.6 10.4 17.2 6.8 13.6 16.4 4Z', 'M5 12.2l6.8 6.8', 'M8.4 15.6 4.6 19.4', 'M3.3 20.7a1 1 0 1 0 1.4-1.4 1 1 0 1 0-1.4 1.4Z'],
    rogue: ['M12 2.5 14 5.2v8.3h-4V5.2Z', 'M7.5 13.5h9', 'M12 13.5v5', 'M12 18.5a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 1 0 0-2.8Z', 'M12 5.5v6'],
    ranger: ['M6 3c11 3 11 15 0 18', 'M6 3v18', 'M3 12h16', 'M16.5 9.5 19 12l-2.5 2.5', 'M3 12l1.5-1.5M3 12l1.5 1.5'],
    barbarian: ['M16.2 5.8 5 21', 'M12.6 5.2c2.4-2.9 7.3-2.5 8.6 2 .7 2.4-.1 4.8-1.8 6.1-.4-2.9-2.6-5-6.8-5.2Z'],
    wizard: ['M3 19c6 2.6 12 2.6 18 0-6-2.4-12-2.4-18 0Z', 'M7 18.2 12 3l2.8 6.4 2.2 8.8', 'M14.5 13.5h0'],
    sorcerer: ['M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4.5 3-6 .5 2 1.5 3 2.5 3-.5-3-.5-6 .5-8Z'],
    warlock: ['M2 12c3-5.5 17-5.5 20 0-3 5.5-17 5.5-20 0Z', 'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6Z', 'M12 9.6v4.8'],
    cleric: [
      'M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8Z',
      'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1'
    ],
    paladin: ['M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6Z', 'M12 8v8M9 11h6'],
    bard: ['M9 18V6l10-2v12', 'M9 9.5l10-2', 'M7 16a2 2 0 1 0 0 4 2 2 0 1 0 0-4Z', 'M17 14a2 2 0 1 0 0 4 2 2 0 1 0 0-4Z'],
    druid: ['M5 19c0-9 5-14 15-15-1 10-6 15-15 15Z', 'M5 19l9-9'],
    monk: ['M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16Z', 'M12 4a4 4 0 0 1 0 8 4 4 0 0 0 0 8', 'M12 7.5h0M12 16.5h0'],
    artificer: [
      'M12.71 4.83 14.76 2.91 16.48 3.62 16.57 6.43 17.57 7.43 20.38 7.52 21.09 9.24 19.17 11.29 19.17 12.71 21.09 14.76 20.38 16.48 17.57 16.57 16.57 17.57 16.48 20.38 14.76 21.09 12.71 19.17 11.29 19.17 9.24 21.09 7.52 20.38 7.43 17.57 6.43 16.57 3.62 16.48 2.91 14.76 4.83 12.71 4.83 11.29 2.91 9.24 3.62 7.52 6.43 7.43 7.43 6.43 7.52 3.62 9.24 2.91 11.29 4.83Z',
      'M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6Z'
    ],
    gunslinger: ['M3 9h15l1-1h2v3h-3v1h-8l-1 1v4c0 1-1 2-2 2H5l1.5-6L5 12H3Z', 'M10 12c0 2 2 2 2.5 0'],
    bloodhunter: ['M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12Z', 'M9.5 15a2.5 2.5 0 0 0 2.5 2.5']
  };
  /** Another name for the same drawing. */
  const ALIAS: Record<string, string> = { 'blood hunter': 'bloodhunter', mystic: 'monk', psion: 'sorcerer' };
  const D20 = [
    'M12 1.5 21.5 7v10L12 22.5 2.5 17V7Z',
    'M12 6l5 8.5H7Z',
    'M12 6V1.5M12 6l9.5 1M12 6 2.5 7M17 14.5 21.5 7M17 14.5l4.5 2.5M17 14.5 12 22.5M7 14.5l5 8M7 14.5 2.5 17M7 14.5 2.5 7'
  ];

  export function classIcon(name: string | undefined): string[] {
    const key = (name ?? '').trim().toLowerCase();
    return ICONS[ALIAS[key] ?? key] ?? ICONS[key.replace(/[^a-z]/g, '')] ?? D20;
  }
</script>

<script lang="ts">
  let { cls }: { cls?: string } = $props();
  const paths = $derived(classIcon(cls));
</script>

<svg class="class-icon" viewBox="0 0 24 24" aria-hidden="true">
  {#each paths as d, i (i)}
    <path {d} />
  {/each}
</svg>

<style>
  .class-icon {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 54%;
    height: 54%;
    fill: none;
    stroke: var(--a);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.75;
    pointer-events: none;
  }
</style>
