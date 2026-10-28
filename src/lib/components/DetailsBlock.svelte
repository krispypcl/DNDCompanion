<script lang="ts">
  /**
   * Who the character is, as opposed to what they can do: the one-line details
   * and the long-form writing. Spellcasting lives on the Spells tab, since it
   * is about casting rather than about the person.
   */
  import EditableField from './EditableField.svelte';
  import { abilityModifier } from '$lib/rules/derived';
  import type { Definition, Traits } from '$lib/types';

  let {
    definition,
    editable,
    onchange
  }: {
    definition: Definition;
    editable: boolean;
    onchange: (next: Definition) => void;
  } = $props();

  /** One-liners. All free text: an age may be "24" or "unknown". */
  const DETAILS = [
    { key: 'alignment', label: 'Alignment', placeholder: 'Chaotic neutral' },
    { key: 'gender', label: 'Gender', placeholder: 'Male' },
    { key: 'age', label: 'Age', placeholder: '24' },
    { key: 'size', label: 'Size', placeholder: 'Medium' },
    { key: 'height', label: 'Height', placeholder: '5’5″' },
    { key: 'weight', label: 'Weight', placeholder: '140 lb' },
    { key: 'faith', label: 'Faith', placeholder: 'None' },
    { key: 'skin', label: 'Skin', placeholder: 'Red' },
    { key: 'eyes', label: 'Eyes', placeholder: 'Amber' },
    { key: 'hair', label: 'Hair', placeholder: 'Brown, slicked back' }
  ] as const;

  const WRITING: { key: keyof Traits; label: string; placeholder: string }[] = [
    { key: 'appearance', label: 'Character appearance', placeholder: 'Scars, bearing, what people notice first.' },
    { key: 'personality', label: 'Personality traits', placeholder: 'How they behave at the table.' },
    { key: 'ideals', label: 'Ideals', placeholder: 'What they believe in.' },
    { key: 'bonds', label: 'Bonds', placeholder: 'Who and what they will not abandon.' },
    { key: 'flaws', label: 'Flaws', placeholder: 'What gets them into trouble.' },
    { key: 'allies', label: 'Allies & organizations', placeholder: 'Who they can call on.' }
  ];

  const portrait = $derived(definition.identity.portraitUrl?.trim() ?? '');
  const dexMod = $derived(abilityModifier(definition.abilities?.dex ?? 10));
  const traits = $derived(definition.traits ?? {});
  const shownDetails = $derived(DETAILS.filter((f) => editable || definition.identity[f.key]));
  const shownWriting = $derived(WRITING.filter((f) => editable || traits[f.key]));

  function patchIdentity(key: string, value: string) {
    onchange({ ...definition, identity: { ...definition.identity, [key]: value } });
  }

  function patchTrait(key: keyof Traits, value: string) {
    onchange({ ...definition, traits: { ...traits, [key]: value } });
  }
</script>

<section class="details">
  {#if portrait}
    <img class="portrait" src={portrait} alt="Portrait of {definition.identity.name}" />
  {/if}

  <dl>
    {#each shownDetails as field (field.key)}
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
        <EditableField
          value={definition.combat?.initiative ?? ''}
          display={definition.combat?.initiative == null
            ? dexMod >= 0 ? `+${dexMod}` : String(dexMod)
            : undefined}
          {editable}
          type="number"
          label="Initiative bonus"
          placeholder={String(dexMod)}
          onchange={(v) =>
            onchange({
              ...definition,
              combat: { ...definition.combat, initiative: v === '' ? undefined : Number(v) }
            })}
        />
      </dd>
    </div>

    <div>
      <dt>Ability save DC</dt>
      <dd>
        <EditableField
          value={definition.abilitySaveDc ?? ''}
          {editable}
          type="number"
          label="Ability save DC"
          placeholder="8 + prof + mod"
          onchange={(v) =>
            onchange({ ...definition, abilitySaveDc: v === '' ? undefined : Number(v) })}
        />
      </dd>
    </div>
  </dl>

  {#if editable}
    <div class="wide">
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

{#if shownWriting.length > 0}
  <div class="writing">
    {#each shownWriting as field (field.key)}
      <section>
        <h3>{field.label}</h3>
        <EditableField
          value={traits[field.key] ?? ''}
          {editable}
          type="textarea"
          rows={4}
          label={field.label}
          placeholder={field.placeholder}
          onchange={(v) => patchTrait(field.key, String(v))}
        />
      </section>
    {/each}
  </div>
{/if}

<style>
  .details {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
    align-items: flex-start;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--line-soft);
  }
  .portrait {
    width: 5.5rem;
    height: 5.5rem;
    object-fit: cover;
    border-radius: var(--r);
    border: 1px solid var(--line);
    flex: none;
  }
  dl {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.75rem 1.25rem;
    flex: 1 1 18rem;
    min-width: 0;
  }
  dl > div { text-align: center; }
  dt {
    font-size: 0.6875rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--label);
    font-weight: 600;
    margin-bottom: 0.125rem;
  }
  dd { margin: 0; font-size: 0.9375rem; }
  dd :global(.field) { width: 100%; field-sizing: fixed; }
  /* The URL is long and reads left to right; the writing below is prose. */
  .wide { flex: 1 1 100%; min-width: 0; text-align: left; }
  .wide :global(.field) { width: 100%; field-sizing: fixed; }

  .writing {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1.25rem;
    margin-top: 1.25rem;
  }
  .writing h3 {
    font-size: 0.6875rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--label);
    font-weight: 600;
    margin: 0 0 0.375rem;
  }
  .writing :global(.field) {
    width: 100%;
    field-sizing: fixed;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    display: block;
  }
</style>
