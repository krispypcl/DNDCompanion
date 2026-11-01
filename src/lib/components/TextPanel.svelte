<script lang="ts">
  /**
   * One long-form writing (notes, backstory) and, for its owner, the two
   * choices about it: whether anyone else can read it, and whether it stays
   * blurred until hovered.
   */
  import EditableField from './EditableField.svelte';
  import Reveal from './Reveal.svelte';

  let {
    label,
    value,
    editable,
    owner,
    isPublic,
    hover,
    onbody,
    onpublic,
    onhover
  }: {
    label: string;
    value: string;
    /** Edit mode: the words themselves can change. */
    editable: boolean;
    /** The owner sees the two switches, in either mode. */
    owner: boolean;
    /** Null when the database cannot keep private text; there is no switch then. */
    isPublic: boolean | null;
    hover: boolean;
    onbody: (next: string) => void;
    onpublic: (next: boolean) => void;
    onhover: (next: boolean) => void;
  } = $props();
</script>

{#if owner}
  <div class="options" role="group" aria-label="{label} options">
    {#if isPublic !== null}
      <button
        class="opt"
        aria-pressed={!isPublic}
        onclick={() => onpublic(!isPublic)}
        title={isPublic
          ? 'Anyone with the link can read this. Press to make it private.'
          : 'Only you can read this. Everyone else sees it as empty.'}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
          <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            {#if isPublic}
              <path d="M8 11V8a4 4 0 0 1 7.5-2" />
            {:else}
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            {/if}
          </g>
        </svg>
        Private
      </button>
    {/if}
    <button
      class="opt"
      aria-pressed={hover}
      onclick={() => onhover(!hover)}
      title="Blur this until it is hovered over, or tapped on a phone"
    >
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="2.6" />
        </g>
      </svg>
      Reveal on hover
    </button>
    {#if isPublic !== null}
      <span class="hint" role="status">
        {isPublic ? 'Anyone with the link can read this.' : 'Only you can read this.'}
      </span>
    {/if}
  </div>
{/if}

<div class="notes">
  <Reveal enabled={hover && !editable}>
    <EditableField {value} {editable} type="textarea" {label} placeholder="Nothing written yet."
                   onchange={(v) => onbody(String(v))} />
  </Reveal>
</div>

<style>
  .options { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin: 0 0 0.75rem; }
  .opt {
    display: inline-flex; align-items: center; gap: 0.375rem;
    background: var(--raised); border: 1px solid var(--line); color: var(--dim);
    border-radius: 999px; padding: 0.25rem 0.75rem; font: inherit; font-size: 0.78rem;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
  }
  .opt:hover { border-color: var(--a-edge); color: var(--text); }
  .opt[aria-pressed='true'] { border-color: var(--a-edge); color: var(--a); background: var(--a-wash); }
  .hint { color: var(--dim); font-size: 0.78rem; }

  /* Every other tab starts its content at the panel's edge; the notes field
     insets its text by its own padding and border, so pull the box back by
     exactly that and widen it to match. The text then lines up with the table
     in Combat, in both states. */
  .notes { margin: calc(-0.15rem - 1px) calc(-0.3rem - 1px) 0; }
  .notes :global(.field) {
    field-sizing: fixed;
    width: 100%;
    white-space: pre-wrap; overflow-wrap: anywhere;
  }
  @media (max-width: 700px) {
    .opt { padding: 0.4375rem 0.875rem; font-size: 0.8125rem; }
    .hint { flex-basis: 100%; }
  }
</style>
