<script lang="ts">
  import EntryLink from './EntryLink.svelte';
  import InfoTip from './InfoTip.svelte';
  import { walkingSpeed } from '#lib/rules/derived.ts';
  /**
   * Who the character is, as opposed to what they can do: the one-line details
   * and the long-form writing. Spellcasting lives on the Spells tab, since it
   * is about casting rather than about the person.
   */
  import EditableField from './EditableField.svelte';
  import type { Definition, Traits } from '#lib/types.ts';

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
    { key: 'ancestry', label: 'Species', placeholder: 'Human, Elf, Dwarf' },
    { key: 'ancestrySource', label: 'Species source', placeholder: "PHB'24" },
    { key: 'background', label: 'Background', placeholder: 'Acolyte, Sage, Soldier' },
    { key: 'backgroundSource', label: 'Background source', placeholder: "PHB'24" }
  ] as const;

  /** One-liners. All free text: an age may be "24" or "unknown". */
  const DETAILS = [
    { key: 'alignment', label: 'Alignment', placeholder: 'Lawful Good' },
    { key: 'gender', label: 'Gender', placeholder: 'How they identify' },
    { key: 'age', label: 'Age', placeholder: 'In years' },
    { key: 'size', label: 'Size', placeholder: 'Small or Medium' },
    { key: 'height', label: 'Height', placeholder: 'Feet and inches' },
    { key: 'weight', label: 'Weight', placeholder: 'In pounds' },
    { key: 'faith', label: 'Faith', placeholder: 'A god, a cause, or none' },
    { key: 'skin', label: 'Skin', placeholder: 'Tone and markings' },
    { key: 'eyes', label: 'Eyes', placeholder: 'Color' },
    { key: 'hair', label: 'Hair', placeholder: 'Color and style' }
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
        <!-- Editing, the species or background on 5e.tools beside its box. -->
        {#if editable && (field.key === 'ancestry' || field.key === 'background') && definition.identity[field.key]?.trim()}
          <EntryLink
            name={definition.identity[field.key] ?? ''}
            source={field.key === 'ancestry' ? definition.identity.ancestrySource : definition.identity.backgroundSource}
            category={field.key === 'ancestry' ? 'races' : 'backgrounds'}
            hover="self"
          />
        {/if}
      </dd>
    </div>
  {/each}
  {#if editable}
    <!-- The walking speed: the species' own when 5e.tools knows it, typed in
         only for a species it does not (homebrew). The Speed box adds what
         items and features give. -->
    {@const walk = walkingSpeed(definition)}
    <div data-flip-ghost="origin:speed">
      <dt>Walking speed
        <InfoTip label="About walking speed">
          {#if walk.from === 'species'}
            {definition.identity.ancestry} walks {walk.feet} ft., from 5e.tools. Change the species and this follows.
            Items and features that add speed do so in the Speed box.
          {:else}
            5e.tools doesn’t know this species, so type its walking speed here (30 ft. if left blank). A species it
            knows fills this in by itself.
          {/if}
        </InfoTip>
      </dt>
      <dd>
        {#if walk.from === 'species'}
          <span class="fromspecies">{walk.feet} ft.</span>
        {:else}
          <EditableField value={definition.combat?.speed ?? ''} editable={true} type="number" label="Walking speed" hint="30"
                         onchange={(v) => onchange({ ...definition, combat: { ...definition.combat, speed: v === '' ? 30 : Number(v) } })} />
        {/if}
      </dd>
    </div>
  {/if}
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
    margin: 0 0 1.25rem; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.75rem 1.25rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--line-soft);
  }
  .origin > div { text-align: center; min-width: 0; }
  .origin.reading { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 760px) { .origin:not(.reading) { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
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
  .details dl {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.75rem 1.25rem;
    flex: 1 1 18rem;
    min-width: 0;
  }
  /* The species row never grows: in a tab laid out as a column (the writing
     below makes it one), a growing row took all the spare height and pushed
     the details to the bottom. */
  .origin { flex: none; }
  .fromspecies { display: inline-block; padding: 0.15rem 0.3rem; border: 1px solid transparent; font-size: 0.9375rem; }
  dt { display: flex; align-items: center; justify-content: center; gap: 0.125rem; }
  @media (max-width: 900px) { .details dl { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 560px) { .details dl { grid-template-columns: repeat(2, 1fr); } }
  /* Every detail hangs from the top of its row, whatever its neighbors hold. */
  .details dl { align-items: start; align-content: start; }
  dl > div { text-align: center; display: flex; flex-direction: column; justify-content: flex-start; align-self: start; }
  dt {
    font-size: 0.6875rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--label);
    font-weight: 600;
    margin-bottom: 0.125rem;
  }
  dd { margin: 0; font-size: 0.9375rem; display: flex; justify-content: center; align-items: flex-start; text-align: center; }
  dd :global(.field) { width: 100%; field-sizing: fixed; }
  dd :global(.lookup) { flex: none; align-self: center; margin-left: 0.25rem; }
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
