<!--
  Writing a stat block (rules/statblock): the top lines, the six scores,
  the defences and senses, then the traits, actions, bonus actions,
  reactions and legendary actions, each a list of named entries to add to
  or take from. For a homebrew monster or NPC, or to change one from a book.
-->
<script lang="ts">
  import { ABILITIES, SECTIONS, modifier, signedMod, type Section, type StatBlock } from '#lib/rules/statblock.ts';

  let { value = $bindable() }: { value: StatBlock } = $props();

  const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
  const TOP: [keyof StatBlock, string, string][] = [
    ['type', 'Type', 'Fey (Goblinoid)'],
    ['alignment', 'Alignment', 'Chaotic Neutral'],
    ['ac', 'Armour class', '17 (chain shirt, shield)'],
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
  const ONE: Record<Section, string> = { traits: 'trait', actions: 'action', bonus: 'bonus action', reactions: 'reaction', legendary: 'legendary action' };

  const text = (k: keyof StatBlock) => (typeof value[k] === 'string' ? (value[k] as string) : '');
  function setText(k: keyof StatBlock, v: string) {
    value = { ...value, [k]: v };
  }
  function setScore(a: (typeof ABILITIES)[number], v: string) {
    const n = Number(v);
    value = { ...value, [a]: v === '' || !Number.isFinite(n) ? undefined : n };
  }
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

<div class="sbe">
  <div class="sbegrid">
    <label><span>Size</span>
      <select value={text('size')} onchange={(e) => setText('size', e.currentTarget.value)}>
        <option value="">Any</option>
        {#each SIZES as s (s)}<option>{s}</option>{/each}
      </select>
    </label>
    {#each TOP as [k, label, hint] (k)}
      <label><span>{label}</span><input value={text(k)} placeholder={hint} maxlength="400" oninput={(e) => setText(k, e.currentTarget.value)} /></label>
    {/each}
  </div>

  <div class="sbescores" role="group" aria-label="Ability scores">
    {#each ABILITIES as a (a)}
      <label><span>{a.toUpperCase()}</span>
        <input class="numfield" type="number" min="1" max="30" inputmode="numeric" value={value[a] ?? ''} placeholder="10"
               oninput={(e) => setScore(a, e.currentTarget.value)} />
        <i>{signedMod(modifier(value[a]))}</i>
      </label>
    {/each}
  </div>

  <div class="sbegrid two">
    {#each LINES as [k, label, hint] (k)}
      <label><span>{label}</span><input value={text(k)} placeholder={hint} maxlength="400" oninput={(e) => setText(k, e.currentTarget.value)} /></label>
    {/each}
  </div>

  {#each SECTIONS as [k, title] (k)}
    <section class="sbesection">
      <h3>{title}</h3>
      {#each value[k] ?? [] as f, i (i)}
        <div class="sbefeature">
          <input class="fname" value={f.name} placeholder="Name" maxlength="120" aria-label="{title}: name"
                 oninput={(e) => setFeature(k, i, 'name', e.currentTarget.value)} />
          <button type="button" class="fdrop" aria-label="Remove {f.name || `this ${ONE[k]}`}" title="Remove" onclick={() => dropFeature(k, i)}>×</button>
          <textarea rows="2" value={f.text} placeholder="What it does" maxlength="3000" aria-label="{title}: what it does"
                    oninput={(e) => setFeature(k, i, 'text', e.currentTarget.value)}></textarea>
        </div>
      {/each}
      <button type="button" class="smallbtn quiet" onclick={() => addFeature(k)}>Add a {ONE[k]}</button>
    </section>
  {/each}
</div>

<style>
  .sbe { display: grid; gap: 1rem; }
  .sbegrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(12rem, 100%), 1fr)); gap: 0.625rem; }
  .sbegrid.two { grid-template-columns: repeat(auto-fill, minmax(min(16rem, 100%), 1fr)); }
  label { display: grid; gap: 0.25rem; font-size: 0.75rem; color: var(--label); min-width: 0; }
  input, select, textarea {
    font: inherit; font-size: 0.8125rem; color: var(--text); min-width: 0; width: 100%;
    padding: 0.375rem 0.5rem; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--a-edge); }
  .sbescores { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.375rem; }
  .sbescores label { justify-items: center; text-align: center; padding: 0.375rem; border-radius: var(--r-sm); background: var(--raised); border: 1px solid var(--line-soft); }
  .sbescores span { font-weight: 650; letter-spacing: 0.08em; font-size: 0.625rem; }
  .sbescores input { text-align: center; padding: 0.25rem; }
  .sbescores i { font-style: normal; font-size: 0.6875rem; color: var(--dim); }
  .sbesection { display: grid; gap: 0.5rem; }
  .sbesection h3 { margin: 0; padding-bottom: 0.25rem; border-bottom: 1px solid var(--a-edge); font-size: 0.75rem; font-weight: 650; letter-spacing: 0.1em; text-transform: uppercase; color: var(--a); }
  .sbesection > .smallbtn { justify-self: start; }
  .sbefeature { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.375rem; }
  .sbefeature textarea { grid-column: 1 / -1; resize: vertical; line-height: 1.45; }
  .fname { font-weight: 600; }
  .fdrop {
    width: 2rem; padding: 0; border: 1px solid transparent; border-radius: var(--r-sm); background: none; color: var(--dim);
    font-size: 1.05rem; cursor: pointer; transition: color 0.15s ease, border-color 0.15s ease;
  }
  .fdrop:hover { color: var(--bad); border-color: color-mix(in oklch, var(--bad) 50%, transparent); }
  @media (max-width: 480px) { .sbescores { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
