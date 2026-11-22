<!--
  On a phone's main menu, until it is installed or put away: a small card
  offering the app for the home screen. Android's offer installs it in one
  press (lib/install); otherwise "Show Me" opens the steps for this phone,
  an iPhone's Share then Add to Home Screen, or Android's menu then Install.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { canPrompt, installed, onInstallChange, platform, promptInstall } from '#lib/install.ts';
  import { prefersReducedMotion } from '#lib/motion.ts';
  import DimModal from './DimModal.svelte';

  const KEY = 'dndcompanion:installTip';
  let hidden = $state(true);
  let offered = $state(false);
  let showing = $state(false);
  const os = platform();

  onMount(() => {
    let away = false;
    try {
      away = localStorage.getItem(KEY) === 'hidden';
    } catch {
      // No storage (a private window): it shows, and hiding it lasts for the visit.
    }
    hidden = away || installed();
    offered = canPrompt();
    return onInstallChange(() => {
      offered = canPrompt();
      if (installed()) hidden = true;
    });
  });

  function putAway() {
    hidden = true;
    showing = false;
    try {
      localStorage.setItem(KEY, 'hidden');
    } catch {
      // Hidden for this visit only.
    }
  }

  async function install() {
    if (await promptInstall()) putAway();
  }

  const STEPS: Record<typeof os, { icon: 'share' | 'add' | 'menu' | 'install' | 'done'; text: string }[]> = {
    ios: [
      { icon: 'share', text: 'Tap Share, the square with an arrow, at the bottom of Safari (at the top on an iPad).' },
      { icon: 'add', text: 'Scroll down the list and tap Add to Home Screen.' },
      { icon: 'done', text: 'Tap Add. DND Companion now opens from your home screen, full screen.' }
    ],
    android: [
      { icon: 'menu', text: 'Tap the menu, the three dots at the top right of Chrome.' },
      { icon: 'install', text: 'Tap Add to Home screen, or Install app.' },
      { icon: 'done', text: 'Tap Install. DND Companion now opens from your home screen, full screen.' }
    ],
    other: [
      { icon: 'menu', text: 'Open your browser’s menu, or its Share button.' },
      { icon: 'add', text: 'Look for Add to Home Screen, or Install app, and tap it.' },
      { icon: 'done', text: 'Confirm. DND Companion now opens from your home screen, full screen.' }
    ]
  };
</script>

{#if !hidden}
  <div class="installtip" out:slide={{ duration: prefersReducedMotion() ? 0 : 220, easing: cubicOut }}>
    <svg class="installmark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M12 7.5v7M9 11.5l3 3 3-3M10.5 18.5h3" />
      </g>
    </svg>
    <b class="installtitle">Play as an app</b>
    {#if offered}
      <button class="smallbtn accent" onclick={install}>Install</button>
    {:else}
      <button class="smallbtn accent" onclick={() => (showing = true)} aria-haspopup="dialog">Show Me</button>
    {/if}
    <button class="closex" aria-label="Hide this tip" title="Hide this tip" onclick={putAway}>×</button>
  </div>
{/if}

{#if showing}
  <DimModal id="install-steps" title="Install DND Companion" closer onclose={() => (showing = false)}>
    <ol class="installsteps">
      {#each STEPS[os] as step, i (i)}
        <li>
          <span class="stepicon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              {#if step.icon === 'share'}<path d="M12 3v11M8 6.5 12 3l4 3.5M8.5 9.5H6.5v11h11v-11h-2" />
              {:else if step.icon === 'add'}<rect x="4" y="4" width="16" height="16" rx="3.5" /><path d="M12 8.5v7M8.5 12h7" />
              {:else if step.icon === 'menu'}<path d="M12 5.5h.01M12 12h.01M12 18.5h.01" stroke-width="2.6" />
              {:else if step.icon === 'install'}<rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M12 7.5v7M9 11.5l3 3 3-3" />
              {:else}<path d="m5 12.5 4.5 4.5L19 7.5" stroke-width="2" />{/if}
            </g></svg>
          </span>
          <span class="steptext"><b>{i + 1}.</b> {step.text}</span>
        </li>
      {/each}
    </ol>
    {#if offered}
      <button class="smallbtn accent installnow" onclick={install}>Install Now</button>
    {/if}
  </DimModal>
{/if}

<style>
  .installtip {
    display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 0.75rem;
    margin-top: 1rem; padding: 0.625rem 0.625rem 0.625rem 0.875rem; border-radius: var(--r);
    border: 1px solid var(--a-edge); background: color-mix(in oklab, var(--a) 7%, var(--surface));
  }
  .installmark { color: var(--a); }
  .installtitle { font-size: 0.9375rem; font-weight: 600; line-height: 1.3; }
  .installtip .closex { width: 2.25rem; height: 2.25rem; }
  .installsteps { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.875rem; }
  .installsteps li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.875rem; align-items: center; }
  .stepicon {
    display: grid; place-items: center; width: 2.5rem; height: 2.5rem; border-radius: var(--r-sm);
    border: 1px solid var(--a-edge); background: var(--a-wash); color: var(--a);
  }
  .steptext { font-size: 0.9375rem; line-height: 1.45; }
  .steptext b { color: var(--a); margin-right: 0.125rem; }
  .installnow { width: 100%; margin-top: 1.25rem; min-height: 2.75rem; font-size: 0.9375rem; }
</style>
