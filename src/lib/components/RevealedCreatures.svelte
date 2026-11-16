<!--
  What the players see of the DM's monsters and NPCs (database/0018,
  revealed_creatures): only those the DM revealed, by name, their
  conditions and how hurt they look, never their numbers or notes.
-->
<script lang="ts">
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import type { Revealed } from '$lib/data/creatures';
  import { lookOf } from '$lib/rules/conditions';
  import { prefersReducedMotion } from '$lib/motion';
  import InfoTip from './InfoTip.svelte';

  let { list }: { list: Revealed[] } = $props();
  const still = prefersReducedMotion();
  const LOOKS: Record<Revealed['vital'], string> = {
    healthy: 'Unhurt', bloodied: 'Bloodied', critical: 'Barely standing', down: 'Down', unknown: 'Hard to tell'
  };
</script>

{#if list.length}
  <section class="foes" aria-label="Monsters and NPCs in sight" transition:fade={{ duration: still ? 0 : 180 }}>
    <h3>In sight <InfoTip label="About these">The monsters and NPCs your DM has shown you, and how hurt they look.</InfoTip></h3>
    <ul>
      {#each list as c (c.id)}
        <li class="foe {c.vital}" animate:flip={{ duration: still ? 0 : 240, easing: cubicOut }} transition:fade={{ duration: still ? 0 : 160 }}>
          <div class="foehead">
            <strong>{c.name}</strong>
            <span class="foekind" class:npc={c.kind === 'npc'}>{c.kind === 'npc' ? 'NPC' : 'Monster'}</span>
          </div>
          <span class="foelook"><i aria-hidden="true"></i>{LOOKS[c.vital]}</span>
          {#if c.conditions.length}
            <ul class="foeconds">
              {#each c.conditions as name (name)}
                <li style:--cc={lookOf(name)?.color ?? 'var(--dim)'}><span aria-hidden="true"></span>{name}</li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .foes { margin-top: 1rem; }
  h3 {
    margin: 0 0 0.625rem; display: flex; align-items: center; gap: 0.375rem;
    font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--label); font-weight: 600;
  }
  .foes > ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.625rem; grid-template-columns: repeat(auto-fill, minmax(min(15rem, 100%), 1fr)); }
  .foe {
    --vc: oklch(68% 0.15 150);
    display: grid; gap: 0.5rem; align-content: start; padding: 0.75rem 0.875rem; border-radius: var(--r);
    background: var(--surface); border: 1px solid var(--line-soft);
  }
  .foe.bloodied { --vc: oklch(72% 0.15 70); }
  .foe.critical { --vc: oklch(64% 0.2 35); }
  .foe.down { --vc: oklch(58% 0.2 25); border-color: color-mix(in oklch, oklch(62% 0.21 25) 45%, var(--line)); }
  .foe.unknown { --vc: var(--dim); }
  .foehead { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .foehead strong { overflow-wrap: anywhere; }
  .foekind {
    font-size: 0.625rem; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 0.125rem 0.4375rem; border-radius: 999px; border: 1px solid color-mix(in oklch, oklch(62% 0.21 25) 45%, var(--line));
    color: color-mix(in oklch, oklch(70% 0.17 25) 80%, var(--text));
  }
  .foekind.npc { border-color: var(--a-edge); color: var(--a); }
  .foelook { display: inline-flex; align-items: center; gap: 0.4375rem; font-size: 0.8125rem; color: var(--text); }
  .foelook i { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--vc); box-shadow: 0 0 0 3px color-mix(in oklch, var(--vc) 22%, transparent); }
  .foeconds { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.3125rem; }
  .foeconds li {
    display: inline-flex; align-items: center; gap: 0.3125rem; font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 999px;
    border: 1px solid color-mix(in oklch, var(--cc) 60%, var(--line)); background: color-mix(in oklch, var(--cc) 18%, var(--raised));
  }
  .foeconds li span { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--cc); }
</style>
