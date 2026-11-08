<script lang="ts">
  /**
   * Who the character is, as opposed to what they can do: the one-line details
   * and the long-form writing. Spellcasting lives on the Spells tab, since it
   * is about casting rather than about the person.
   */
  import EditableField from './EditableField.svelte';
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

  const ORIGIN = [
    { key: 'ancestry', label: 'Species', placeholder: 'Tiefling (Glasya)' },
    { key: 'ancestrySource', label: 'Species source', placeholder: 'mtf' },
    { key: 'background', label: 'Background', placeholder: 'Criminal' },
    { key: 'backgroundSource', label: 'Background source', placeholder: 'xphb' }
  ] as const;

  /** One-liners. All free text: an age may be "24" or "unknown". */
  const DETAILS = [
    { key: 'alignment', label: 'Alignment', placeholder: 'Lawful good' },
    { key: 'gender', label: 'Gender', placeholder: 'Male' },
    { key: 'age', label: 'Age', placeholder: '22' },
    { key: 'size', label: 'Size', placeholder: 'Medium' },
    { key: 'height', label: 'Height', placeholder: '6’0″' },
    { key: 'weight', label: 'Weight', placeholder: '180 lb' },
    { key: 'faith', label: 'Faith', placeholder: 'None' },
    { key: 'skin', label: 'Skin', placeholder: 'Tan' },
    { key: 'eyes', label: 'Eyes', placeholder: 'Brown' },
    { key: 'hair', label: 'Hair', placeholder: 'Black' }
  ] as const;

  const WRITING: { key: keyof Traits; label: string; placeholder: string }[] = [
    { key: 'appearance', label: 'Character appearance', placeholder: 'Build, bearing, what people notice first.' },
    { key: 'personality', label: 'Personality traits', placeholder: 'How they behave at the table.' },
    { key: 'ideals', label: 'Ideals', placeholder: 'What they believe in.' },
    { key: 'bonds', label: 'Bonds', placeholder: 'Who and what they will not abandon.' },
    { key: 'flaws', label: 'Flaws', placeholder: 'What gets them into trouble.' },
    { key: 'allies', label: 'Allies & organizations', placeholder: 'Who they can call on.' }
  ];

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

<!-- Species and background, each beside the book it comes from: the book is
     what lets the header link straight to the entry on 5e.tools. -->
<!-- The books are only for editing: reading, the links beside the names
     already use them. -->
<dl class="origin" class:reading={!editable}>
  {#each ORIGIN.filter((f) => editable || !f.key.endsWith('Source')) as field (field.key)}
    <div data-flip-ghost="origin:{field.key}">
      <dt>{field.label}</dt>
      <dd>
        <EditableField
          value={definition.identity[field.key] ?? ''}
          {editable}
          label={field.label}
          hint={field.placeholder}
          onchange={(v) => patchIdentity(field.key, String(v).trim())}
        />
      </dd>
    </div>
  {/each}
</dl>

<section class="details">
  <dl>
    {#each shownDetails as field (field.key)}
      <div data-flip-ghost="details:{field.key}">
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

  </dl>

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
          grow={true}
          label={field.label}
          placeholder={field.placeholder}
          onchange={(v) => patchTrait(field.key, String(v))}
        />
      </section>
    {/each}
  </div>
{/if}

<style>
  .origin {
    margin: 0 0 1.25rem; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem 1.25rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--line-soft);
  }
  .origin > div { text-align: center; min-width: 0; }
  .origin.reading { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 560px) { .origin { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .details {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
    align-items: stretch;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--line-soft);
  }
  /* Ten details, two rows of five. */
  dl {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.75rem 1.25rem;
    flex: 1 1 18rem;
    min-width: 0;
  }
  @media (max-width: 900px) { dl { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 560px) { dl { grid-template-columns: repeat(2, 1fr); } }
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
