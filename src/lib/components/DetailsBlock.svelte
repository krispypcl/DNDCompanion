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

  const portrait = $derived(definition.identity.portraitUrl?.trim() ?? '');
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
  {:else}
    <!-- A placeholder keeps the row the same height whether or not there is art. -->
    <div class="portrait empty-portrait" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="26" height="26">
        <circle cx="12" cy="9" r="4" fill="none" stroke="currentColor" stroke-width="1.5" />
        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill="none" stroke="currentColor" stroke-width="1.5"
              stroke-linecap="round" />
      </svg>
    </div>
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
    align-items: stretch;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--line-soft);
  }
  /* Square, and as tall as the two rows of details beside it. */
  .portrait {
    align-self: stretch;
    height: auto;
    width: auto;
    aspect-ratio: 1;
    min-width: 4rem;
    max-width: 5.5rem;
    max-height: 5.5rem;
    object-fit: cover;
    border-radius: var(--r);
    border: 1px solid var(--line);
    flex: none;
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
  .empty-portrait { display: grid; place-items: center; color: var(--faint); background: var(--raised); }
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
