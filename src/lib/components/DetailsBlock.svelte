<script lang="ts">
  /**
   * Who the character is, as opposed to what they can do: the one-line details
   * and the long-form writing. Spellcasting lives on the Spells tab, since it
   * is about casting rather than about the person.
   */
  import EditableField from './EditableField.svelte';
  import Lightbox from './Lightbox.svelte';
  import { resolveImageUrl } from '$lib/rules/imageUrl';
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

  const portrait = $derived(resolveImageUrl(definition.identity.portraitUrl).url);
  const bannerSrc = $derived(resolveImageUrl(definition.identity.bannerUrl).url);
  /** A picture that failed to load falls back to the empty frame. */
  let broken = $state<Record<string, boolean>>({});
  /** The picture shown full screen, if any. */
  let viewing = $state<{ src: string; alt: string; from?: Element | null } | null>(null);
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
  <!-- Editing, the preview beside the link field does this job. -->
  {#if !editable}
    {#if portrait}
      <button class="portrait-btn" data-flip-ghost="details:portrait" data-ghost-scale="0.8" data-ghost-quick aria-label="View portrait full screen"
              onclick={(e) => (viewing = { src: portrait, alt: `Portrait of ${definition.identity.name}`, from: e.currentTarget })}>
        <img class="portrait" src={portrait} alt="Portrait of {definition.identity.name}" />
      </button>
    {:else}
      <!-- A placeholder keeps the row the same height whether or not there is art. -->
      <div class="portrait empty-portrait" data-flip-ghost="details:portrait" data-ghost-scale="0.8" data-ghost-quick aria-hidden="true">
        <svg viewBox="0 0 24 24" width="26" height="26">
          <circle cx="12" cy="9" r="4" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill="none" stroke="currentColor" stroke-width="1.5"
                stroke-linecap="round" />
        </svg>
      </div>
    {/if}
  {/if}

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

  <!-- The banner, opposite the portrait, the same way: press for full screen. -->
  {#if !editable}
    {#if bannerSrc && !broken[bannerSrc]}
      <button class="banner-btn" data-flip-ghost="details:banner" data-ghost-scale="0.8" data-ghost-quick aria-label="View banner full screen"
              onclick={(e) => (viewing = { src: bannerSrc, alt: `Banner of ${definition.identity.name}`, from: e.currentTarget })}>
        <img class="banner" src={bannerSrc} alt="Banner of {definition.identity.name}"
             onerror={() => (broken[bannerSrc] = true)} />
      </button>
    {:else}
      <div class="banner empty-portrait" data-flip-ghost="details:banner" data-ghost-scale="0.8" data-ghost-quick aria-hidden="true">
        <svg viewBox="0 0 24 24" width="26" height="26">
          <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="m3 16 5-5 4 4 3-3 6 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
          <circle cx="16" cy="9" r="1.5" fill="none" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </div>
    {/if}
  {/if}

</section>

{#if viewing}
  <Lightbox src={viewing.src} alt={viewing.alt} from={viewing.from} onclose={() => (viewing = null)} />
{/if}

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
  /* A fixed square. Stretching it to the row made the empty placeholder, which
     has no intrinsic size, come out rectangular. */
  .portrait {
    align-self: center;
    width: 5.5rem;
    height: 5.5rem;
    flex: none;
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
  .banner {
    align-self: center; width: 9.5rem; height: 5.5rem; flex: none;
    object-fit: cover; border-radius: var(--r); border: 1px solid var(--line); display: block;
  }
  .banner-btn {
    align-self: center; flex: none; padding: 0; border: 0; background: none;
    border-radius: var(--r); cursor: zoom-in; transition: transform 0.15s ease, opacity 0.15s ease;
  }
  .banner-btn:hover { opacity: 0.9; transform: scale(1.02); }
  @media (max-width: 560px) {
    /* On a phone the portrait and banner sit centred on their own rows. */
    .details { justify-content: center; }
    .portrait-btn, div.portrait { margin-inline: auto; }
    /* Under the details on a phone, the full width of the card. */
    .banner, .banner-btn { width: 100%; }
    .banner-btn .banner { height: 7rem; }
    div.banner { height: 5.5rem; }
  }
  .portrait-btn {
    align-self: center; flex: none; padding: 0; border: 0; background: none;
    border-radius: var(--r); cursor: zoom-in;
    transition: transform 0.15s ease, opacity 0.15s ease;
  }
  .portrait-btn:hover { opacity: 0.9; transform: scale(1.02); }
  .portrait-btn .portrait { display: block; }

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
