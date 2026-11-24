<!--
  What the players see of the DM's monsters and NPCs (database/0018, 0020,
  revealed_creatures): only those the DM revealed, by name and portrait,
  their conditions, how hurt they look, and their expression as the DM
  describes it (database/0023), on one line ("Bloodied, Snarling"), and on
  the card's edge as on every campaign card; never their numbers or notes.
  The DM sees the same cards (`dm`), to know what the table sees. A
  portrait opens full screen.
-->
<script lang="ts">
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import type { Revealed } from '#lib/data/creatures.ts';
  import { lookOf } from '#lib/rules/conditions.ts';
  import { resolveImageUrl } from '#lib/rules/imageUrl.ts';
  import ConditionRing from './ConditionRing.svelte';
  import CreatureMark from './CreatureMark.svelte';
  import Lightbox from './Lightbox.svelte';
  import { prefersReducedMotion } from '#lib/motion.ts';
  import SectionHead from './SectionHead.svelte';

  let { list, dm = false }: { list: Revealed[]; dm?: boolean } = $props();
  const still = prefersReducedMotion();
  const LOOKS: Record<Revealed['vital'], string> = {
    healthy: 'Unhurt', bloodied: 'Bloodied', critical: 'Barely standing', down: 'Down', unknown: 'Hard to tell'
  };
  let viewing = $state<{ src: string; alt: string; from: Element | null } | null>(null);
</script>

{#if list.length}
  <section class="foes" aria-label="Monsters and NPCs in sight" transition:fade={{ duration: still ? 0 : 180 }}>
    <SectionHead title="In Sight" infoLabel="About these">
      {#snippet info()}{#if dm}What your players see of the monsters and NPCs you’ve revealed: how hurt they look, and their expressions.{:else}The monsters and NPCs your DM has shown you: how hurt they look, and their expressions.{/if}{/snippet}
    </SectionHead>
    <ul>
      {#each list as c (c.id)}
        {@const pic = resolveImageUrl(c.portrait ?? '').url}
        {@const ring = c.conditions.flatMap((n) => { const color = lookOf(n, c.condition_looks ?? {})?.color; return color ? [{ key: n.toLowerCase(), color }] : []; })}
        <li class="foe hurtcard {c.vital}" animate:flip={{ duration: still ? 0 : 240, easing: cubicOut }} transition:fade={{ duration: still ? 0 : 160 }}>
          <div class="foehead">
            <!-- Always a portrait, as on the DM's cards: its mark when it has no picture. -->
            {#if pic}
              <button class="foepic" class:ringed={ring.length > 0} class:npc={c.kind === 'npc'} aria-label="See {c.name}’s portrait" title="See it full screen"
                      onclick={(e) => (viewing = { src: pic, alt: `Portrait of ${c.name}`, from: e.currentTarget })}>
                <img src={pic} alt="" /><ConditionRing bands={ring} round />
              </button>
            {:else}
              <span class="foepic" class:ringed={ring.length > 0} class:npc={c.kind === 'npc'}><CreatureMark kind={c.kind} /><ConditionRing bands={ring} round /></span>
            {/if}
            <span class="foename">
              <strong>{c.name}</strong>
              <span class="foekind" class:npc={c.kind === 'npc'}>{c.kind === 'npc' ? 'NPC' : 'Monster'}</span>
            </span>
          </div>
          <span class="foelook"><i aria-hidden="true"></i>{LOOKS[c.vital]}{#if c.expression?.trim()}, {c.expression.trim()}{/if}</span>
          <!-- Always drawn, even empty, so the cards in a row keep their rows level. -->
          <ul class="foeconds">
            {#each c.conditions as name (name)}
              <li style:--cc={lookOf(name, c.condition_looks ?? {})?.color ?? 'var(--dim)'}><span aria-hidden="true"></span>{name}</li>
            {/each}
          </ul>
        </li>
      {/each}
    </ul>
  </section>
{/if}

{#if viewing}
  <Lightbox src={viewing.src} alt={viewing.alt} from={viewing.from} onclose={() => (viewing = null)} />
{/if}

<style>
  .foes { min-width: 0; }
  /* Spaced as the DM's monster and NPC cards; each card shares the list's three rows (subgrid), so a row of them lines up. */
  .foes > ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.875rem; grid-template-columns: repeat(auto-fill, minmax(min(18rem, 100%), 1fr)); }
  .foe {
    --vc: oklch(68% 0.15 150);
    display: grid; grid-row: span 3; grid-template-rows: subgrid; row-gap: 0.75rem; align-content: start; min-width: 0;
    padding: 0.875rem; border-radius: var(--r);
    background: var(--surface); border: 1px solid var(--line-soft);
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
  }
  .foe.bloodied { --vc: oklch(72% 0.15 70); }
  .foe.critical { --vc: oklch(64% 0.2 35); }
  .foe.down { --vc: oklch(58% 0.2 25); }
  .foe.unknown { --vc: var(--dim); }
  .foehead { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
  .foename { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; min-width: 0; }
  /* Round, as the 5e.tools tokens most portraits come from are. */
  .foepic {
    position: relative; flex: none; width: 3.25rem; height: 3.25rem; border-radius: 50%; display: grid; place-items: center;
    border: 1px solid color-mix(in oklab, oklch(62% 0.21 25) 45%, var(--line)); background: var(--raised); color: var(--dim);
    transition: border-color 0.35s ease;
  }
  .foepic.npc { border-color: var(--a-edge); }
  .foepic.ringed { border-color: transparent; }
  button.foepic { padding: 0; font: inherit; cursor: zoom-in; transition: border-color 0.35s ease, transform 0.15s ease; }
  button.foepic:hover { transform: scale(1.05); }
  button.foepic:active { transform: scale(0.98); }
  button.foepic:focus-visible { outline: 2px solid var(--a); outline-offset: 3px; }
  .foepic img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
  .foehead strong { font-size: 1.0625rem; overflow-wrap: anywhere; }
  .foekind {
    font-size: 0.625rem; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 0.125rem 0.4375rem; border-radius: 999px; border: 1px solid color-mix(in oklab, oklch(62% 0.21 25) 45%, var(--line));
    color: color-mix(in oklab, oklch(70% 0.17 25) 80%, var(--text));
  }
  .foekind.npc { border-color: var(--a-edge); color: var(--a); }
  .foelook { display: inline-flex; align-items: center; gap: 0.4375rem; font-size: 0.8125rem; color: var(--text); }
  .foelook i { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--vc); box-shadow: 0 0 0 3px color-mix(in oklch, var(--vc) 22%, transparent); }
  .foeconds { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.375rem; align-content: start; }
  .foeconds li {
    display: inline-flex; align-items: center; gap: 0.3125rem; font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 999px;
    border: 1px solid color-mix(in oklab, var(--cc) 60%, var(--line)); background: color-mix(in oklab, var(--cc) 18%, var(--raised));
  }
  .foeconds li span { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--cc); }
</style>
