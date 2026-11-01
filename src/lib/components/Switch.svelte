<script lang="ts">
  /** An on/off switch: a pill with a knob that slides across. */
  let {
    checked,
    label,
    title,
    disabled = false,
    onchange
  }: {
    checked: boolean;
    label: string;
    title?: string;
    disabled?: boolean;
    onchange: (next: boolean) => void;
  } = $props();
</script>

<button class="switch" role="switch" aria-checked={checked} {title} {disabled} onclick={() => onchange(!checked)}>
  <span class="label">{label}</span>
  <span class="track" aria-hidden="true"><span class="knob"></span></span>
</button>

<style>
  .switch {
    display: inline-flex; align-items: center; gap: 0.5rem;
    background: none; border: 0; padding: 0.125rem 0; cursor: pointer;
    font: inherit; font-size: 0.8125rem; color: var(--dim);
    transition: color 0.18s ease;
  }
  .switch:hover:not(:disabled), .switch[aria-checked='true'] { color: var(--text); }
  .switch:disabled { cursor: default; opacity: 0.5; }
  .track {
    position: relative; width: 2.125rem; height: 1.25rem; flex: none;
    border-radius: 999px; background: var(--track); border: 1px solid var(--line);
    transition: background-color 0.22s ease, border-color 0.22s ease;
  }
  .knob {
    position: absolute; top: 1px; left: 1px; width: calc(1.25rem - 4px); height: calc(1.25rem - 4px);
    border-radius: 50%; background: var(--text);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.35);
    transition: transform 0.24s cubic-bezier(0.3, 1.4, 0.5, 1), background-color 0.22s ease;
  }
  .switch[aria-checked='true'] .track { background: var(--a); border-color: var(--a); }
  .switch[aria-checked='true'] .knob { transform: translateX(0.875rem); background: #fff; }
  .switch:focus-visible { outline: none; }
  .switch:focus-visible .track { outline: 2px solid var(--a); outline-offset: 2px; }
  @media (max-width: 700px) {
    .switch { font-size: 0.875rem; padding: 0.375rem 0; }
  }
</style>
