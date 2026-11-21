<!--
  Writing a stat block (rules/statblock): the top lines, the six scores,
  the defenses and senses, then the traits, actions, bonus actions,
  reactions and legendary actions, each a list of named entries to add to
  or take from. For a homebrew monster or NPC, or to change one from a book.
  Every text box grows with its words (actions fitText), so nothing hides
  behind a scrollbar; the one-line ones wrap rather than scroll sideways.
-->
<script lang="ts">
  import { fitText } from '#lib/actions.ts';
  import { SECTIONS, type Section, type StatBlock } from '#lib/rules/statblock.ts';
  import StatScores from './StatScores.svelte';

  let {
    value = $bindable(),
    spread = false,
    scores = true
  }: {
    value: StatBlock;
    /** A wide window: the parts side by side and the features in columns. */
    spread?: boolean;
    /** The six scores here; off when the window shows them elsewhere (beside the name). */
    scores?: boolean;
  } = $props();

  const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
  const TOP: [keyof StatBlock, string, string][] = [
    ['type', 'Type', 'Fey (Goblinoid)'],
    ['alignment', 'Alignment', 'Chaotic Neutral'],
    ['ac', 'Armor class', '17 (chain shirt, shield)'],
    ['hp', 'Hit points', '21 (6d6)'],
    ['speed', 'Speed', '30 ft., climb 30 ft.'],
    ['cr', 'Challenge', '1']
  ];
  const LINES: [keyof StatBlock, string, string][] = [
    ['saves', 'Saving throws', 'Dex +4, Wis +2'],
    ['skills', 'Skills', 'Stealth +6'],
    ['vulnerabilities', 'Vulnerabilities', ''],
    ['resistances', 'Resistances', 'Cold'],
    ['immunities', 'Immunities', 'Poison'],
    ['conditionImmunities', 'Condition immunities', 'Charmed'],
    ['senses', 'Senses', 'Darkvision 60 ft., Passive Perception 9'],
    ['languages', 'Languages', 'Common, Goblin']
  ];
  /** One of each, with its article: "Add an action". */
  const ONE: Record<Section, string> = { traits: 'a trait', actions: 'an action', bonus: 'a bonus action', reactions: 'a reaction', legendary: 'a legendary action' };

  const text = (k: keyof StatBlock) => (typeof value[k] === 'string' ? (value[k] as string) : '');
  /** A line of the stat block: one line, however it wraps on screen. */
  function setText(k: keyof StatBlock, v: string) {
    value = { ...value, [k]: v.replace(/\s*\n\s*/g, ' ') };
  }
  const oneLine = (e: KeyboardEvent) => {
    if (e.key === 'Enter') e.preventDefault();
  };
  function addFeature(k: Section) {
    value = { ...value, [k]: [...(value[k] ?? []), { name: '', text: '' }] };
  }
  function setFeature(k: Section, i: number, part: 'name' | 'text', v: string) {
    value = { ...value, [k]: (value[k] ?? []).map((f, j) => (j === i ? { ...f, [part]: v } : f)) };
  }
  function dropFeature(k: Section, i: number) {
    value = { ...value, [k]: (value[k] ?? []).filter((_, j) => j !== i) };
  }
</script>

<div class="sbe" class:spread>
  <div class="sbegrid">
    <label><span>Size</span>
      <select value={text('size')} onchange={(e) => setText('size', e.currentTarget.value)}>
        <option value="">Any</option>
        {#each SIZES as s (s)}<option>{s}</option>{/each}
      </select>
    </label>
    {#each TOP as [k, label, hint] (k)}
      {@render line(k, label, hint)}
    {/each}
  </div>

  {#if scores}<StatScores bind:value />{/if}

  <div class="sbegrid two">
    {#each LINES as [k, label, hint] (k)}
      {@render line(k, label, hint)}
    {/each}
  </div>

  <div class="sbesections">
  {#each SECTIONS as [k, title] (k)}
    <section class="sbesection">
      <h3>{title}</h3>
      {#each value[k] ?? [] as f, i (i)}
        <div class="sbefeature">
          <input class="fname" value={f.name} placeholder="Name" maxlength="120" aria-label="{title}: name"
                 oninput={(e) => setFeature(k, i, 'name', e.currentTarget.value)} />
          <button type="button" class="fdrop" aria-label="Remove {f.name || ONE[k]}" title="Remove" onclick={() => dropFeature(k, i)}>×</button>
          <textarea rows="2" value={f.text} placeholder="What it does" maxlength="3000" aria-label="{title}: what it does"
                    use:fitText={f.text} oninput={(e) => setFeature(k, i, 'text', e.currentTarget.value)}></textarea>
        </div>
      {/each}
      <button type="button" class="smallbtn quiet" onclick={() => addFeature(k)}>Add {ONE[k]}</button>
    </section>
  {/each}
  </div>
</div>

{#snippet line(k: keyof StatBlock, label: string, hint: string)}
  <label><span>{label}</span>
    <textarea class="sbeline" rows="1" value={text(k)} placeholder={hint} maxlength="400" use:fitText={text(k)}
              onkeydown={oneLine} oninput={(e) => setText(k, e.currentTarget.value)}></textarea>
  </label>
{/snippet}

<style>
  .sbe { display: grid; gap: 1rem; }
  .sbesections { display: grid; gap: 1rem; }
  /* Spread (a wide window): the basics and scores beside the longer lines,
     then the traits and actions in as many columns as fit, each kept whole. */
  @media (min-width: 900px) {
    .sbe.spread { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 1.5rem; align-items: start; }
    .sbe.spread > .sbegrid:first-child { grid-column: 1; grid-row: 1; grid-template-columns: repeat(auto-fill, minmax(min(10rem, 100%), 1fr)); }
    .sbe.spread > :global(.sbescores) { grid-column: 1; grid-row: 2; }
    .sbe.spread > .sbegrid.two { grid-column: 2; grid-row: 1 / span 2; grid-template-columns: repeat(auto-fill, minmax(min(14rem, 100%), 1fr)); }
    .sbe.spread > .sbesections { grid-column: 1 / -1; display: block; columns: 3 18rem; column-gap: 1.5rem; }
    .sbe.spread .sbesection { break-inside: avoid; margin-bottom: 1rem; }
  }
  .sbegrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(12rem, 100%), 1fr)); gap: 0.625rem; }
  .sbegrid.two { grid-template-columns: repeat(auto-fill, minmax(min(16rem, 100%), 1fr)); }
  label { display: grid; gap: 0.25rem; font-size: 0.75rem; color: var(--label); min-width: 0; }
  input, select, textarea {
    font: inherit; font-size: 0.8125rem; color: var(--text); min-width: 0; width: 100%;
    padding: 0.375rem 0.5rem; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  input, select, textarea { transition: border-color 0.15s ease; }
  input:hover, select:hover, textarea:hover { border-color: var(--a-edge); }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--a-edge); }
  textarea { display: block; box-sizing: border-box; overflow: hidden; }
  /* A line wraps as it grows; it is never dragged taller by hand. */
  .sbeline { resize: none; line-height: 1.4; }
  .sbesection { display: grid; gap: 0.5rem; }
  .sbesection h3 { margin: 0; padding-bottom: 0.25rem; border-bottom: 1px solid var(--a-edge); font-size: 0.75rem; font-weight: 650; letter-spacing: 0.1em; text-transform: uppercase; color: var(--a); }
  .sbesection > .smallbtn { justify-self: start; }
  .sbefeature { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.375rem; }
  .sbefeature textarea { grid-column: 1 / -1; resize: none; line-height: 1.45; }
  .fname { font-weight: 600; }
  .fdrop {
    width: 2rem; padding: 0; border: 1px solid transparent; border-radius: var(--r-sm); background: none; color: var(--dim);
    font-size: 1.05rem; cursor: pointer; transition: color 0.15s ease, border-color 0.15s ease;
  }
  .fdrop:hover { color: var(--bad); border-color: color-mix(in oklch, var(--bad) 50%, transparent); }
</style>
