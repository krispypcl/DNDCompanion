<!--
  A campaign's crest: its picture in a still frame washed in the campaign's
  color, as a sheet's portrait is, turning toward the pointer like a coin
  (motion.ts parallax). With no crest (or one that won't load), what a
  character with no portrait shows: the d20, on the same wash. A crest that
  can be opened full screen is a button.
-->
<script lang="ts">
  import { parallax } from '#lib/motion.ts';
  import ClassIcon from './ClassIcon.svelte';

  let {
    src = '',
    size = 3.25,
    name = '',
    onopen
  }: {
    /** The picture's address (resolved), or nothing for the die. */
    src?: string;
    /** Its side, in rem. */
    size?: number;
    /** The campaign's name, for what a reader hears. */
    name?: string;
    /** Opens it full screen; without it the crest is only a picture. */
    onopen?: (from: Element) => void;
  } = $props();

  let broken = $state(false);
  $effect(() => {
    void src;
    broken = false;
  });
  const shown = $derived(Boolean(src) && !broken);
</script>

{#snippet inside()}
  <span class="crestframe">
    {#if shown}
      <img src={src} alt="" draggable="false" onerror={() => (broken = true)} />
    {:else}
      <ClassIcon />
    {/if}
  </span>
{/snippet}

{#if onopen && shown}
  <button class="crest" style:--crest={`${size}rem`} use:parallax aria-label="See {name ? `${name}’s` : 'the'} crest" title="See it full screen"
          onclick={(e) => onopen(e.currentTarget)}>{@render inside()}</button>
{:else}
  <span class="crest" style:--crest={`${size}rem`} use:parallax role={shown ? 'img' : undefined} aria-label={shown ? `${name ? `${name}’s` : 'The'} crest` : undefined}>{@render inside()}</span>
{/if}

<style>
  .crest {
    position: relative; flex: none; display: block; width: var(--crest); height: var(--crest); padding: 0;
    border: 0; border-radius: var(--r); background: none; font: inherit; color: var(--a);
  }
  button.crest { cursor: zoom-in; transition: transform 0.15s var(--ease-out); }
  button.crest:active { transform: translateY(1px); }
  button.crest:focus-visible { outline: 2px solid var(--a); outline-offset: 3px; }
  /* The frame and its wash stay still; what is inside turns toward the
     pointer (--px, --py, --pz from parallax), a little larger so no edge
     shows, with a soft shine where the light catches it. */
  .crestframe {
    position: absolute; inset: 0; overflow: hidden; border-radius: inherit; display: grid; place-items: center;
    border: 1px solid var(--a-edge);
    background: linear-gradient(150deg, var(--portrait-from), var(--portrait-to));
    perspective: 320px;
  }
  .crestframe > img, .crestframe > :global(.class-icon) {
    transform: rotateY(calc(var(--px, 0) * 14deg)) rotateX(calc(var(--py, 0) * -14deg)) scale(calc(1 + var(--pz, 0) * 0.12));
    transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .crestframe > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .crestframe::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(circle at calc(50% + var(--px, 0) * 45%) calc(50% + var(--py, 0) * 45%), rgb(255 255 255 / 0.28), transparent 60%);
    opacity: var(--pz, 0); transition: opacity 0.45s var(--ease-out); mix-blend-mode: soft-light;
  }
  :global(html[data-motion='reduce']) .crestframe > img, :global(html[data-motion='reduce']) .crestframe > :global(.class-icon) { transition: none; }
</style>
