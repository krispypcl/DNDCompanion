<script lang="ts">
  /**
   * The sheet laid out for paper, after the D&D Beyond / official character
   * sheet: the same boxes in the same places, in black ink on white, so a
   * player who knows that sheet finds everything where they expect it.
   *
   * It is always in the page but only ever shown by the printer: Ctrl+P
   * prints it too, not only the Print button. Writing the reader may not see
   * is never passed in, so a visitor's print leaves private text out.
   */
  import { spellAttack, spellDc } from '$lib/rules/casting';
  import { signed as sign } from '$lib/actions';
  import { portal } from '$lib/actions';
  import { ABILITIES, SKILLS, type Ability, type Definition, type SkillName, type State } from '$lib/types';
  import {
    characterLevel,
    classList,
    armorClass,
    modifierOf,
    passiveScore,
    proficiencyBonus,
    saveBonus,
    skillTotal,
    weightCarried
  } from '$lib/rules/derived';
  import { countedForPrint, spellBlocks, MAX_BOXES } from '$lib/rules/print';
  import { resolveImageUrl } from '$lib/rules/imageUrl';
  import { splitPages } from '$lib/rules/pages';
  import { toHtml } from '$lib/rules/richtext';

  let {
    definition: def,
    state,
    notes = '',
    backstory = ''
  }: { definition: Definition; state: State; notes?: string; backstory?: string } = $props();

  const NAMES: Record<Ability, string> = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'
  };
  const SKILL_NAMES: Record<SkillName, string> = {
    acrobatics: 'Acrobatics', animalHandling: 'Animal Handling', arcana: 'Arcana', athletics: 'Athletics',
    deception: 'Deception', history: 'History', insight: 'Insight', intimidation: 'Intimidation',
    investigation: 'Investigation', medicine: 'Medicine', nature: 'Nature', perception: 'Perception',
    performance: 'Performance', persuasion: 'Persuasion', religion: 'Religion',
    sleightOfHand: 'Sleight of Hand', stealth: 'Stealth', survival: 'Survival'
  };
  const id = $derived(def.identity);
  const classes = $derived(classList(def));
  const classAndLevel = $derived(
    classes.length
      ? classes.map((c) => [c.name, c.subclass ? `(${c.subclass})` : '', c.level].filter(Boolean).join(' ')).join(' / ')
      : `Level ${characterLevel(def)}`
  );
  const initiative = $derived(def.combat?.initiative ?? modifierOf(def, 'dex'));
  const counted = $derived(countedForPrint(def, state));
  const blocks = $derived(spellBlocks(def, counted.slots));
  const casting = $derived(def.spellcastingAbility);
  const saveDc = $derived(spellDc(def));
  const spellAtk = $derived(spellAttack(def));
  const hasSpellPage = $derived(blocks.length > 0 || Boolean(casting));
  const portrait = $derived(resolveImageUrl(id.portraitUrl).url);
  const t = $derived(def.traits ?? {});
  const html = (text: string) => splitPages(text).filter((p) => p.trim()).map(toHtml).join('');
  const hitDiceLeft = $derived(state.hitDiceUsed ? `${state.hitDiceUsed} spent` : '');
  const COINS = ['cp', 'sp', 'ep', 'gp', 'pp'] as const;

</script>

{#snippet bubble(on: boolean, double = false)}
  <svg class="bub" viewBox="0 0 10 10" aria-hidden="true">
    <circle cx="5" cy="5" r="4" fill={on && !double ? '#000' : '#fff'} stroke="#000" stroke-width="0.9" />
    {#if double}<circle cx="5" cy="5" r="2.4" fill="#000" />{/if}
  </svg>
{/snippet}

{#snippet boxes(max: number, used: number)}
  {#if max > 0 && max <= MAX_BOXES}
    <span class="ticks">
      {#each Array(max) as _, i (i)}
        <svg viewBox="0 0 10 10" aria-hidden="true"><rect x="0.6" y="0.6" width="8.8" height="8.8" rx="1.5"
             fill={i < used ? '#000' : '#fff'} stroke="#000" stroke-width="0.9" /></svg>
      {/each}
    </span>
  {:else}
    <span class="count">{used} / {max} used</span>
  {/if}
{/snippet}

{#snippet text(value: string | undefined, rich = false)}
  {#if rich}<div class="rich">{@html html(value ?? '')}</div>
  {:else}<div class="plain">{value ?? ''}</div>{/if}
{/snippet}

<div class="printsheet" use:portal aria-hidden="true">
  <!-- ── Page 1 ─────────────────────────────────────────────────────── -->
  <section class="page">
    <header class="head">
      <div class="namebox">
        <div class="nm">{id.name || ' '}</div>
        <small>Character Name</small>
      </div>
      <div class="facts">
        <div><b>{classAndLevel}</b><small>Class &amp; Level</small></div>
        <div><b>{id.background ?? ''}</b><small>Background</small></div>
        <div><b>{id.player ?? ''}</b><small>Player Name</small></div>
        <div><b>{id.ancestry ?? ''}</b><small>Species</small></div>
        <div><b>{id.alignment ?? ''}</b><small>Alignment</small></div>
        <div><b> </b><small>Experience Points</small></div>
      </div>
    </header>

    <div class="cols">
      <div class="col">
        <div class="split">
          <div class="abilities">
            {#each ABILITIES as a (a)}
              <div class="ab">
                <small>{NAMES[a]}</small>
                <b>{sign(modifierOf(def, a))}</b>
                <span class="score">{def.abilities[a] ?? 10}</span>
              </div>
            {/each}
          </div>
          <div class="stack">
            <div class="pill"><span class="v">{state.inspiration || ''}</span><small>Heroic Inspiration</small></div>
            <div class="pill"><span class="v">{sign(proficiencyBonus(def))}</span><small>Proficiency Bonus</small></div>
            <div class="box list">
              {#each ABILITIES as a (a)}
                <div class="row">{@render bubble(Boolean(def.saves?.[a]))}<u>{sign(saveBonus(def, a))}</u><span>{NAMES[a]}</span></div>
              {/each}
              <h4>Saving Throws</h4>
            </div>
            <div class="box list">
              {#each Object.keys(SKILLS) as s (s)}
                {@const p = def.skills?.[s as SkillName]}
                <div class="row">{@render bubble(Boolean(p?.proficient || p?.expertise), Boolean(p?.expertise))}<u>{sign(skillTotal(def, s as SkillName))}</u><span>{SKILL_NAMES[s as SkillName]} <i>({SKILLS[s as SkillName].toUpperCase().slice(0, 3)})</i></span></div>
              {/each}
              <h4>Skills</h4>
            </div>
          </div>
        </div>
        <div class="pill wide"><span class="v">{passiveScore(def, 'perception')}</span><small>Passive Wisdom (Perception)</small></div>
        <div class="pill wide"><span class="v">{passiveScore(def, 'investigation')}</span><small>Passive Intelligence (Investigation)</small></div>
        <div class="pill wide"><span class="v">{passiveScore(def, 'insight')}</span><small>Passive Wisdom (Insight)</small></div>
        <div class="box grow prose">
          {#if def.senses}<p><b>Senses.</b> {def.senses}</p>{/if}
          {#if t.proficiencies}<p><b>Proficiencies.</b> <span class="plain">{t.proficiencies}</span></p>{/if}
          {#if t.languages}<p><b>Languages.</b> {t.languages}</p>{/if}
          <h4>Other Proficiencies &amp; Languages</h4>
        </div>
      </div>

      <div class="col">
        <div class="tray">
          <div class="trio">
            <div class="shield"><b>{armorClass(def).total}</b><small>Armor Class</small></div>
            <div class="sq"><b>{sign(initiative)}</b><small>Initiative</small></div>
            <div class="sq"><b>{def.combat?.speed ?? ''}{def.combat?.speed ? ' ft.' : ''}</b><small>Speed</small></div>
          </div>
          <div class="box hp">
            <p class="line">Hit Point Maximum <u>{def.combat?.hpMax ?? ''}</u></p>
            <b class="big">{state.hpCurrent}</b>
            <h4>Current Hit Points</h4>
          </div>
          <div class="box hp small">
            <b class="big">{state.hpTemp || ''}</b>
            <h4>Temporary Hit Points</h4>
          </div>
          <div class="duo">
            <div class="box">
              <p class="line">Total <u>{def.combat?.hitDice ?? ''}</u></p>
              <b class="mid">{hitDiceLeft}</b>
              <h4>Hit Dice</h4>
            </div>
            <div class="box saves">
              <p>Successes {#each [0, 1, 2] as i (i)}{@render bubble(state.deathSaves.successes > i)}{/each}</p>
              <p>Failures {#each [0, 1, 2] as i (i)}{@render bubble(state.deathSaves.failures > i)}{/each}</p>
              <h4>Death Saves</h4>
            </div>
          </div>
        </div>

        <div class="box attacks">
          <table>
            <thead><tr><th>Name</th><th>Atk Bonus / DC</th><th>Damage / Type</th></tr></thead>
            <tbody>
              {#each def.attacks ?? [] as at, i (i)}
                <tr><td>{at.name}</td><td>{at.bonus ?? ''}</td><td>{[at.damage, at.damageType].filter(Boolean).join(' ')}</td></tr>
                {#if at.notes}<tr class="note"><td colspan="3">{at.notes}</td></tr>{/if}
              {/each}
              {#each Array(Math.max(0, 3 - (def.attacks?.length ?? 0))) as _, i (i)}
                <tr class="blank"><td></td><td></td><td></td></tr>
              {/each}
            </tbody>
          </table>
          <h4>Attacks &amp; Spellcasting</h4>
        </div>

        <div class="box grow equip">
          <div class="coins">
            {#each COINS as c (c)}
              <div><small>{c.toUpperCase()}</small><b>{def.currency?.[c] ?? 0}</b></div>
            {/each}
          </div>
          <ul class="items">
            {#each def.equipment ?? [] as item, i (i)}
              <li>{item.qty && item.qty !== 1 ? `${item.qty} × ` : ''}{item.name}{#if item.attuned}<em> · attuned</em>{/if}{#if item.weight}<em> · {item.weight} lb</em>{/if}</li>
            {/each}
          </ul>
          {#if weightCarried(def)}<p class="carried">Carrying {weightCarried(def)} lb</p>{/if}
          <h4>Equipment</h4>
        </div>
      </div>

      <div class="col">
        <div class="tray persona">
          <div class="box">{@render text(t.personality)}<h4>Personality Traits</h4></div>
          <div class="box">{@render text(t.ideals)}<h4>Ideals</h4></div>
          <div class="box">{@render text(t.bonds)}<h4>Bonds</h4></div>
          <div class="box">{@render text(t.flaws)}<h4>Flaws</h4></div>
        </div>
        <div class="box grow prose features">
          {#if counted.resources.length}
            <div class="uses">
              {#each counted.resources as r, i (i)}
                <div class="use"><span>{r.label}{r.die ? ` (${r.die})` : ''}{#if r.reset}<em> · {r.reset}</em>{/if}</span>{@render boxes(r.max, r.used)}</div>
              {/each}
            </div>
          {/if}
          {#each def.features ?? [] as f, i (i)}
            <div class="feat"><b>{f.title || f.name}.</b> <span class="plain">{f.body}</span></div>
          {/each}
          {#if state.conditions?.length}<p><b>Conditions.</b> {state.conditions.join(', ')}</p>{/if}
          <h4>Features &amp; Traits</h4>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Page 2 ─────────────────────────────────────────────────────── -->
  <section class="page">
    <header class="head">
      <div class="namebox">
        <div class="nm">{id.name || ' '}</div>
        <small>Character Name</small>
      </div>
      <div class="facts six">
        <div><b>{id.age ?? ''}</b><small>Age</small></div>
        <div><b>{id.height ?? ''}</b><small>Height</small></div>
        <div><b>{id.weight ?? ''}</b><small>Weight</small></div>
        <div><b>{id.eyes ?? ''}</b><small>Eyes</small></div>
        <div><b>{id.skin ?? ''}</b><small>Skin</small></div>
        <div><b>{id.hair ?? ''}</b><small>Hair</small></div>
        <div><b>{id.gender ?? ''}</b><small>Gender</small></div>
        <div><b>{id.size ?? ''}</b><small>Size</small></div>
        <div><b>{id.faith ?? ''}</b><small>Faith</small></div>
      </div>
    </header>
    <div class="cols two">
      <div class="col">
        <div class="box appearance">
          {#if portrait}<img src={portrait} alt="" />{/if}
          {@render text(t.appearance)}
          <h4>Character Appearance</h4>
        </div>
        <div class="box grow prose">{@render text(backstory, true)}<h4>Character Backstory</h4></div>
      </div>
      <div class="col">
        <div class="box prose allies">{@render text(t.allies)}<h4>Allies &amp; Organizations</h4></div>
        <div class="box grow prose">{@render text(notes, true)}<h4>Notes</h4></div>
      </div>
    </div>
  </section>

  <!-- ── Page 3 ─────────────────────────────────────────────────────── -->
  {#if hasSpellPage}
    <section class="page">
      <header class="head spellhead">
        <div class="namebox">
          <div class="nm">{classes.map((c) => c.name).join(' / ') || ' '}</div>
          <small>Spellcasting Class</small>
        </div>
        <div class="facts three">
          <div><b>{casting ? NAMES[casting] : ''}</b><small>Spellcasting Ability</small></div>
          <div><b>{saveDc ?? ''}</b><small>Spell Save DC</small></div>
          <div><b>{spellAtk != null ? sign(spellAtk) : ''}</b><small>Spell Attack Bonus</small></div>
        </div>
      </header>
      <div class="spells">
        {#each blocks as b (b.title)}
          <div class="box spellbox">
            <div class="lvl">
              <span class="num">{b.level ?? '·'}</span>
              <span class="lt">{b.title}</span>
              {#if b.slots}<span class="slots">Slots {@render boxes(b.slots.max, b.slots.used)}</span>{/if}
            </div>
            <ul>
              {#each b.spells as s, i (i)}
                <li>
                  {#if b.level !== 0}{@render bubble(Boolean(s.prepared))}{/if}
                  <span class="sn">{s.name}</span>
                  <em>{[s.time, s.range, s.duration].filter(Boolean).join(' · ')}</em>
                </li>
              {/each}
              {#each Array(Math.max(0, 3 - b.spells.length)) as _, i (i)}<li class="blank"></li>{/each}
            </ul>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .printsheet { display: none; }

  @media print {
    :global(body > :not(.printsheet)) { display: none !important; }
    :global(html), :global(body) { background: #fff !important; color: #000 !important; height: auto !important; }
    @page { margin: 9mm; }

    .printsheet {
      display: block; color: #000; background: #fff; color-scheme: light;
      font: 8.5pt/1.3 'Helvetica Neue', Arial, sans-serif;
    }
  }

  /* Each page fills its sheet of paper, as the printed form does; the boxes
     that take writing stretch, and long writing still flows on. */
  .page { break-after: page; min-height: 99vh; display: flex; flex-direction: column; }
  .page > .cols { flex: 1; }
  .page:last-child { break-after: auto; }

  small, h4 {
    display: block; text-transform: uppercase; letter-spacing: 0.06em; font-size: 6.2pt; font-weight: 700; color: #000;
  }
  h4 { margin: 0.35em 0 0; text-align: center; }

  /* The header: a name scroll on the left, the facts on ruled lines beside it. */
  .head { display: grid; grid-template-columns: 34% 1fr; gap: 3mm; align-items: end; margin-bottom: 3mm; }
  .namebox { border: 1.2pt solid #000; border-radius: 2.5mm; padding: 2mm 3mm 1.5mm; }
  .nm { font-size: 15pt; font-weight: 700; border-bottom: 0.6pt solid #000; min-height: 1.3em; line-height: 1.2; }
  .namebox small { margin-top: 1mm; }
  .facts { border: 1.2pt solid #000; border-radius: 2.5mm; padding: 1.5mm 3mm; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5mm 3mm; }
  .facts.six { grid-template-columns: repeat(3, 1fr); }
  .facts b { font-size: 9pt; font-weight: 600; min-height: 1.3em; display: block; border-bottom: 0.6pt solid #000; overflow-wrap: anywhere; }
  .facts small { font-weight: 600; color: #333; padding-top: 0.5mm; font-size: 5.6pt; }

  .cols { display: grid; grid-template-columns: 1.08fr 1fr 1fr; gap: 3mm; align-items: stretch; }
  .cols.two { grid-template-columns: 1fr 1fr; }
  .col { display: flex; flex-direction: column; gap: 2.5mm; min-width: 0; }
  .grow { flex: 1; }

  .box { border: 1pt solid #000; border-radius: 2mm; padding: 1.6mm 2mm 1.2mm; display: flex; flex-direction: column; }
  .box > h4 { margin-top: auto; padding-top: 1mm; }
  .tray { border: 1pt solid #000; border-radius: 2.5mm; padding: 2mm; background: #fff; display: flex; flex-direction: column; gap: 2mm; }
  .tray .box { border-width: 0.8pt; }

  /* Abilities down the left, each a box with the modifier large and the score in an oval. */
  .split { display: grid; grid-template-columns: 19mm 1fr; gap: 2mm; }
  .abilities { display: flex; flex-direction: column; gap: 2mm; border: 1pt solid #000; border-radius: 2.5mm; padding: 1.5mm; }
  .ab { border: 1pt solid #000; border-radius: 2mm; text-align: center; padding: 1mm 0 0; display: flex; flex-direction: column; align-items: center; flex: 1; }
  .ab small { font-size: 4.7pt; letter-spacing: 0; }
  .ab b { font-size: 15pt; line-height: 1.15; }
  .score { border: 0.9pt solid #000; border-radius: 3mm; padding: 0 2mm; font-size: 8pt; font-weight: 600; background: #fff; margin-bottom: -2mm; }
  .stack { display: flex; flex-direction: column; gap: 2mm; min-width: 0; }
  .pill { display: flex; align-items: center; gap: 2mm; border: 1pt solid #000; border-radius: 4mm; padding: 0.6mm 2mm 0.6mm 0.6mm; }
  .pill .v { width: 7mm; height: 6mm; border: 1pt solid #000; border-radius: 2mm; display: grid; place-items: center; font-weight: 700; font-size: 9pt; flex: none; }
  .pill small { font-size: 5.8pt; }
  .pill.wide .v { width: 8mm; }
  .list .row { display: flex; align-items: center; gap: 1.2mm; font-size: 7.4pt; line-height: 1.45; white-space: nowrap; }
  .list .row span { overflow-wrap: anywhere; }
  .list u { text-decoration: none; border-bottom: 0.6pt solid #000; min-width: 5mm; text-align: center; font-weight: 600; }
  .list i { font-style: normal; color: #555; font-size: 6pt; }
  .bub { width: 2.4mm; height: 2.4mm; flex: none; vertical-align: -0.3mm; }

  .prose { font-size: 7.4pt; }
  .prose p { margin: 0 0 1mm; }
  .plain { white-space: pre-wrap; overflow-wrap: anywhere; }
  .rich :global(h3) { font-size: 8.5pt; margin: 1.5mm 0 0.5mm; }
  .rich :global(ul), .rich :global(ol) { margin: 0.5mm 0; padding-left: 4mm; }
  .rich { overflow-wrap: anywhere; }

  /* Armour class in a shield, initiative and speed in boxes. */
  .trio { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; }
  .trio > div { border: 1pt solid #000; text-align: center; padding: 1.2mm 0.5mm; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .trio b { font-size: 14pt; line-height: 1.1; }
  .trio small { font-size: 5.6pt; }
  .sq { border-radius: 2mm; }
  .shield { border-radius: 1.5mm 1.5mm 50% 50% / 1.5mm 1.5mm 35% 35%; padding-bottom: 2.4mm !important; }
  .line { margin: 0; font-size: 6.4pt; text-transform: uppercase; color: #333; display: flex; gap: 1.5mm; }
  .line u { text-decoration: none; border-bottom: 0.6pt solid #000; flex: 1; text-align: center; color: #000; font-size: 8pt; font-weight: 600; }
  .hp { text-align: center; min-height: 18mm; }
  .hp.small { min-height: 13mm; }
  .big { font-size: 18pt; flex: 1; display: grid; place-items: center; }
  .mid { font-size: 8pt; flex: 1; display: grid; place-items: center; font-weight: 500; }
  .duo { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; }
  .duo .box { min-height: 15mm; }
  .saves p { margin: 0.6mm 0; font-size: 6pt; text-transform: uppercase; display: flex; align-items: center; gap: 0.8mm; justify-content: flex-end; }

  table { width: 100%; border-collapse: collapse; font-size: 7.2pt; }
  th { font-size: 5.6pt; text-transform: uppercase; text-align: left; font-weight: 700; padding-bottom: 0.6mm; }
  td { border-bottom: 0.5pt solid #999; padding: 0.7mm 1mm 0.4mm 0; vertical-align: top; }
  tr.blank td { height: 4.2mm; }
  tr.note td { font-size: 6.4pt; color: #333; border-bottom-style: dotted; }

  .equip { min-height: 45mm; }
  .coins { float: left; display: flex; flex-direction: column; gap: 1.2mm; margin: 0 2.5mm 1mm 0; }
  .coins > div { display: flex; align-items: center; gap: 1mm; }
  .coins small { width: 4mm; font-size: 5.6pt; }
  .coins b { border: 0.9pt solid #000; border-radius: 1.5mm; min-width: 10mm; padding: 0.4mm 1mm; text-align: center; font-size: 7.6pt; }
  .equip { display: block; }
  .equip h4 { clear: both; }
  .items { list-style: none; margin: 0; padding: 0; font-size: 7.2pt; }
  .items li { border-bottom: 0.5pt solid #ccc; padding: 0.3mm 0; }
  .items em, .use em, li em { color: #555; font-style: normal; font-size: 6.2pt; }
  .carried { font-size: 6.4pt; margin: 1mm 0 0; color: #333; }

  .persona .box { min-height: 15mm; font-size: 7.4pt; }
  .persona .box:first-child { min-height: 19mm; }
  .features .feat { margin-bottom: 1.2mm; break-inside: avoid; }
  .uses { margin-bottom: 1.5mm; display: grid; gap: 0.8mm; }
  .use { display: flex; justify-content: space-between; gap: 2mm; align-items: center; border-bottom: 0.5pt solid #ccc; padding-bottom: 0.5mm; }
  .ticks { display: inline-flex; flex-wrap: wrap; gap: 0.6mm; justify-content: flex-end; }
  .ticks svg { width: 2.4mm; height: 2.4mm; }
  .count { font-size: 6.4pt; white-space: nowrap; }

  .appearance { min-height: 60mm; }
  .appearance img { max-width: 100%; max-height: 70mm; object-fit: contain; align-self: center; margin-bottom: 1.5mm; border-radius: 1mm; }
  .allies { min-height: 40mm; }

  /* The spell page: a box per level, flowing down three columns. */
  .spellhead .nm { font-size: 12pt; }
  .facts.three { grid-template-columns: repeat(3, 1fr); }
  .spells { columns: 3; column-gap: 3mm; flex: 1; }
  .spellbox { break-inside: avoid; margin-bottom: 3mm; display: block; }
  .lvl { display: flex; align-items: center; gap: 1.5mm; border-bottom: 0.8pt solid #000; padding-bottom: 1mm; margin-bottom: 1mm; }
  .num { width: 6mm; height: 6mm; border: 1pt solid #000; border-radius: 50%; display: grid; place-items: center; font-weight: 700; font-size: 9pt; flex: none; }
  .lt { font-size: 6.6pt; text-transform: uppercase; font-weight: 700; letter-spacing: 0.06em; }
  .slots { margin-left: auto; display: inline-flex; align-items: center; gap: 1mm; font-size: 5.6pt; text-transform: uppercase; }
  .spellbox ul { list-style: none; margin: 0; padding: 0; }
  .spellbox li { display: flex; align-items: baseline; gap: 1.2mm; border-bottom: 0.5pt solid #bbb; padding: 0.5mm 0; font-size: 7.4pt; min-height: 4mm; flex-wrap: wrap; }
  .spellbox li .bub { align-self: center; }
  .sn { font-weight: 600; }
  .spellbox li em { margin-left: auto; }
</style>
