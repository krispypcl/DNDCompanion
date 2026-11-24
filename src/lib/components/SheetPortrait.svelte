<script lang="ts">
  /**
   * The sheet's portrait: the picture (or the main class, drawn, when there
   * is none) in a still frame it turns inside toward the pointer, the level
   * badge on its bottom edge, rays and words when the character levels up,
   * and a skull over a grayed picture when they die. Its size is the sheet
   * header's business (SheetView sets it per width).
   */
  import { glow, parallax } from '#lib/motion.ts';
  import ClassIcon from './ClassIcon.svelte';

  let {
    src,
    cls,
    level,
    levelUp,
    dead
  }: {
    src: string | null | undefined;
    /** The main class, drawn when there is no picture (a bow for a ranger). */
    cls: string | undefined;
    level: number;
    /** Counts each level gained this visit; a new count plays the burst once. */
    levelUp: number;
    dead: boolean;
  } = $props();
</script>

<div class="portrait" class:has={Boolean(src)} class:fallen={dead} use:parallax>
  <!-- The picture turns toward the pointer, inside its still frame. -->
  <span class="frame">
    <ClassIcon {cls} />
    {#if src}
      <!-- A link that stops working (a Drive file that was unshared) leaves
           the frame as it is for a sheet with no art, not a broken-image icon. -->
      <img {src} alt="" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
    {/if}
  </span>
  <span class="lvl" use:glow={level}>LV {level}</span>
  {#key levelUp}
    {#if levelUp > 0}
      <!-- Leveled up: rays burst from the portrait and the news floats up. -->
      <span class="burst" aria-hidden="true">{#each Array(12) as _, i (i)}<i style:--r="{i * 30}deg"></i>{/each}</span>
      <span class="levelup" role="status">Level up!</span>
    {/if}
  {/key}
  {#if dead}
    <!-- Three failed death saves, or Dead written in: a skull on the portrait. -->
    <span class="skull" title="Dead" role="img" aria-label="Dead">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.5c-4.7 0-8 3.2-8 7.6 0 2.6 1.2 4.4 3 5.5v2.6c0 .9.7 1.6 1.6 1.6h.9v-2h1.6v2h1.8v-2h1.6v2h.9c.9 0 1.6-.7 1.6-1.6v-2.6c1.8-1.1 3-2.9 3-5.5 0-4.4-3.3-7.6-8-7.6Z"
              fill="currentColor" />
        <circle cx="8.8" cy="10.6" r="2" fill="#140d0d" />
        <circle cx="15.2" cy="10.6" r="2" fill="#140d0d" />
        <path d="M12 13.2l-1.1 2h2.2Z" fill="#140d0d" />
      </svg>
    </span>
  {/if}
</div>

<style>
  .portrait {
    width: 6rem; aspect-ratio: 1; border-radius: var(--r);
    flex: none; display: flex; align-items: flex-end; justify-content: center;
    position: relative; overflow: visible;
  }
  .portrait img {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover;
  }
  /*
   * The frame and its wash stay still; the picture inside (or the class
   * drawn) turns toward the pointer like a coin (motion.ts parallax sets
   * --px/--py from -1 to 1 and --pz while pointed at), a little larger so no
   * edge shows, with a soft shine where the light catches it, and eases flat
   * again on leaving. The level badge stays put below it.
   */
  .frame {
    position: absolute; inset: 0; overflow: hidden; border-radius: inherit;
    border: 1px solid var(--a-edge);
    background: linear-gradient(150deg, var(--portrait-from), var(--portrait-to));
    perspective: 420px;
  }
  .frame > :global(img), .frame > :global(.class-icon) {
    transform:
      rotateY(calc(var(--px, 0) * 14deg))
      rotateX(calc(var(--py, 0) * -14deg))
      scale(calc(1 + var(--pz, 0) * 0.12));
    transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), filter 0.8s var(--ease-out);
  }
  .frame::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(
      circle at calc(50% + var(--px, 0) * 45%) calc(50% + var(--py, 0) * 45%),
      rgb(255 255 255 / 0.28), transparent 60%
    );
    opacity: var(--pz, 0);
    transition: opacity 0.45s var(--ease-out);
    mix-blend-mode: soft-light;
  }
  /* Quick to follow the pointer; slow to settle back once it leaves. */
  .portrait:hover .frame > :global(img), .portrait:hover .frame > :global(.class-icon) { transition-duration: 0.18s, 0.8s; }
  /* Sits on the bottom edge, half in and half out. */
  .lvl {
    position: absolute; left: 50%; bottom: 0; transform: translate(-50%, 50%); z-index: 2;
    background: var(--surface); border: 1px solid var(--a-edge);
    color: var(--a); border-radius: var(--r-sm); font-size: 0.6875rem; font-weight: 650;
    padding: 0.0625rem 0.5rem; letter-spacing: 0.02em; white-space: nowrap;
  }
  /* Dead: the portrait drains of color. */
  .portrait.fallen img { filter: grayscale(1) brightness(0.65); }
  /* Dead: a big skull in front of the grayed portrait, not a badge. */
  .skull {
    position: absolute; inset: 0; z-index: 1; border-radius: var(--r);
    display: grid; place-items: center; pointer-events: none;
    background: radial-gradient(circle, oklch(10% 0.01 25 / 0.55) 0%, oklch(10% 0.01 25 / 0.15) 70%);
    color: oklch(94% 0.01 286);
    animation: skullIn 0.7s var(--ease-out);
  }
  .skull svg {
    width: 62%; height: 62%;
    filter: drop-shadow(0 0 10px oklch(60% 0.22 25 / 0.85)) drop-shadow(0 2px 2px rgb(0 0 0 / 0.6));
  }
  @keyframes skullIn { from { transform: scale(1.6); opacity: 0; } }
  /* Level up: twelve rays from the portrait, and the words rising off it. */
  .burst { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
  .burst i {
    position: absolute; left: 50%; top: 50%; width: 3px; height: 34%; margin-left: -1.5px;
    border-radius: 2px; transform-origin: 50% 0;
    background: linear-gradient(to bottom, var(--a-hi), transparent);
    transform: rotate(var(--r)) translateY(30%) scaleY(0.2); opacity: 0;
    animation: ray 0.9s cubic-bezier(0.2, 0.8, 0.3, 1);
  }
  @keyframes ray {
    15% { opacity: 1; }
    to { transform: rotate(var(--r)) translateY(120%) scaleY(1); opacity: 0; }
  }
  .levelup {
    position: absolute; left: 50%; top: -0.5rem; z-index: 3; white-space: nowrap; pointer-events: none;
    transform: translateX(-50%); font-size: 0.75rem; font-weight: 750; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--a-hi); text-shadow: 0 1px 6px rgb(0 0 0 / 0.6);
    animation: levelRise 1.6s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
  }
  /* Grows to its size as it rises, never past it, then drifts up and fades. */
  @keyframes levelRise {
    0% { opacity: 0; transform: translate(-50%, 6px) scale(0.8); }
    20% { opacity: 1; transform: translate(-50%, -6px) scale(1); }
    70% { opacity: 1; transform: translate(-50%, -12px); }
    100% { opacity: 0; transform: translate(-50%, -20px); }
  }
  :global(html[data-motion='reduce']) .burst, :global(html[data-motion='reduce']) .levelup { animation: none; }
  :global(html[data-motion='reduce']) .burst { display: none; }
</style>
