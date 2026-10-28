<script lang="ts">
  /**
   * The written details that are not numbers: portrait, background, player,
   * alignment, and an initiative bonus for the cases where it is not just the
   * DEX modifier. Read-only viewers see only the fields that have a value.
   */
  import EditableField from './EditableField.svelte';
  import { abilityModifier } from '$lib/rules/derived';
  import type { Definition } from '$lib/types';

  let {
    definition,
    editable,
    onchange
  }: {
    definition: Definition;
    editable: boolean;
    onchange: (next: Definition) => void;
  } = $props();

  const FIELDS = [
    { key: 'background', label: 'Background', placeholder: 'Criminal' },
    { key: 'alignment', label: 'Alignment', placeholder: 'Chaotic neutral' },
    { key: 'player', label: 'Player', placeholder: 'Your name' }
  ] as const;

  const portrait = $derived(definition.identity.portraitUrl?.trim() ?? '');
  const dexMod = $derived(abilityModifier(definition.abilities?.dex ?? 10));
  const initiative = $derived(definition.combat?.initiative ?? dexMod);
  const shown = $derived(FIELDS.filter((f) => editable || definition.identity[f.key]));

  function patchIdentity(key: string, value: string) {
    onchange({ ...definition, identity: { ...definition.identity, [key]: value } });
  }
</script>

<!-- Always rendered: initiative falls back to the DEX modifier, so there is
     always at least one value here. -->
<section class="details">
  {#if portrait}
    <img class="portrait" src={portrait} alt="Portrait of {definition.identity.name}" />
  {/if}

  <dl>
    {#each shown as field (field.key)}
      <div>
        <dt>{field.label}</dt>
        <dd>
          <EditableField
            value={definition.identity[field.key] ?? ''}
            {editable}
            label={field.label}
            placeholder={field.placeholder}
            onchange={(v) => patchIdentity(field.key, String(v))}
          />
        </dd>
      </div>
    {/each}

    <div>
      <dt>Initiative</dt>
      <dd>
        {#if editable}
          <EditableField
            value={definition.combat?.initiative ?? ''}
            editable={true}
            type="number"
            label="Initiative bonus"
            placeholder={String(dexMod)}
            onchange={(v) =>
              onchange({
                ...definition,
                combat: {
                  ...definition.combat,
                  initiative: v === '' ? undefined : Number(v)
                }
              })}
          />
        {:else}
          <span class="num">{initiative >= 0 ? `+${initiative}` : initiative}</span>
        {/if}
      </dd>
    </div>
  </dl>

  {#if editable}
    <div class="portrait-field">
      <dt>Portrait URL</dt>
      <EditableField
        value={definition.identity.portraitUrl ?? ''}
        editable={true}
        label="Portrait URL"
        placeholder="https://…"
        onchange={(v) => patchIdentity('portraitUrl', String(v))}
      />
    </div>
  {/if}
</section>

<style>
  .details {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
    align-items: flex-start;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--line);
  }
  .portrait {
    width: 5.5rem;
    height: 5.5rem;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid var(--line);
    flex: none;
  }
  dl {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.6rem 1.25rem;
    flex: 1 1 16rem;
    min-width: 0;
  }
  dt {
    font-size: 0.66rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--dim);
    margin-bottom: 0.1rem;
  }
  dd { margin: 0; font-size: 0.95rem; }
  .num { font-variant-numeric: tabular-nums; }
  .portrait-field { flex: 1 1 100%; min-width: 0; }
  .portrait-field :global(input) { width: 100%; }
</style>
