<!--
  The DM's monsters and NPCs on the campaign page (database/0017, 0018, 0020):
  a card each, like a character's: its portrait (the DM's picture, or a
  5e.tools monster's token art) ringed by its conditions' colours, its hit
  points (damage and healing a press away), armour class, conditions (the
  DM's own in colours they choose) and a short note; its stat block in a
  window of its own; whether the players can see it; and its place, moved
  by dragging the card. Added from 5e.tools, from the DM's own homebrew, or
  written new with a stat block, in a window over the dimmed page.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import type { Creature } from '#lib/data/creatures.ts';
  import type { CreatureTable } from '#lib/creatureTable.svelte.ts';
  import { creatureUrl, damage, heal, hpNow, type CreatureKind } from '#lib/rules/creatures.ts';
  import { cleanName, defaultLook, isStandard, lookKey, lookOf } from '#lib/rules/conditions.ts';
  import { resolveImageUrl } from '#lib/rules/imageUrl.ts';
  import type { ConditionLook } from '#lib/types.ts';
  import { vitalStatus } from '#lib/rules/hp.ts';
  import { peekTarget } from '#lib/rules/peek.ts';
  import { cleanStatBlock, kindLine, leadingNumber, type StatBlock } from '#lib/rules/statblock.ts';
  import { search, type IndexRow } from '#lib/rules/spotlight.ts';
  import { peek, themeAt } from '#lib/stores/peek.svelte.ts';
  import { prefersReducedMotion } from '#lib/motion.ts';
  import { reorder } from '#lib/reorder.ts';
  import CardHp from './CardHp.svelte';
  import DimModal from './DimModal.svelte';
  import ConditionGiver from './ConditionGiver.svelte';
  import ConditionLookPicker from './ConditionLookPicker.svelte';
  import ConditionRing from './ConditionRing.svelte';
  import InfoTip from './InfoTip.svelte';
  import SectionHead from './SectionHead.svelte';
  import StatBlockEditor from './StatBlockEditor.svelte';
  import StatWindow from './StatWindow.svelte';

  let {
    table,
    ended = false,
    tools
  }: {
    table: CreatureTable;
    ended?: boolean;
    /** More buttons for each card (Owlbear's Place token). */
    tools?: Snippet<[Creature]>;
  } = $props();
  const still = prefersReducedMotion();

  // ── Order, by dragging a card (lib/reorder): shown as it moves, kept on letting go.
  let preview = $state<string[] | null>(null);
  const shown = $derived.by(() => {
    if (!preview) return table.list;
    const by = new Map(table.list.map((c) => [c.id, c]));
    return preview.map((id) => by.get(id)).filter((c): c is Creature => Boolean(c));
  });

  // ── Hit points: an amount, then Damage or Heal.
  let amounts = $state<Record<string, string | number>>({});
  function hit(c: Creature, kind: 'damage' | 'heal') {
    const n = Number(amounts[c.id]);
    if (!Number.isFinite(n) || n <= 0) return;
    amounts[c.id] = '';
    void table.change(c, kind === 'damage' ? damage(c, n) : heal(c, n));
  }

  // ── Conditions.
  let giving = $state<string | null>(null);
  const giver = $derived(table.list.find((c) => c.id === giving) ?? null);
  const has = (list: string[], name: string) => list.some((x) => x.toLowerCase() === name.toLowerCase());
  function toggleCondition(c: Creature, name: string) {
    const next = has(c.conditions, name) ? c.conditions.filter((x) => x.toLowerCase() !== name.toLowerCase()) : [...c.conditions, name];
    void table.change(c, { conditions: next });
  }
  function addCondition(c: Creature, written: string) {
    const name = cleanName(written);
    if (!name || has(c.conditions, name)) return;
    void table.change(c, { conditions: [...c.conditions, name] });
    // One of the DM's own: ask its colour, starting from the first swatch.
    if (!isStandard(name)) {
      if (!(lookKey(name) in (c.condition_looks ?? {}))) setLook(c, name, defaultLook());
      tinting = { id: c.id, name };
    }
  }
  /** The condition whose colour the DM is choosing, on which creature. */
  let tinting = $state<{ id: string; name: string } | null>(null);
  const tinted = $derived(tinting ? table.list.find((c) => c.id === tinting!.id) ?? null : null);
  const lookFor = (c: Creature, name: string): ConditionLook => c.condition_looks?.[lookKey(name)] ?? { color: '', motion: 'pulse' };
  function setLook(c: Creature, name: string, patch: Partial<ConditionLook>) {
    const cur = table.list.find((x) => x.id === c.id) ?? c;
    void table.change(cur, { condition_looks: { ...(cur.condition_looks ?? {}), [lookKey(name)]: { ...lookFor(cur, name), ...patch } } });
  }
  const colourOf = (c: Creature, name: string) => lookOf(name, c.condition_looks ?? {})?.color;
  const ringOf = (c: Creature) => c.conditions.flatMap((n) => { const color = colourOf(c, n); return color ? [{ key: n.toLowerCase(), color }] : []; });

  // ── Its page on 5e.tools: in a pop-up when the app can draw it, else in a new tab.
  function openPage(c: Creature, e: MouseEvent) {
    const url = creatureUrl(c.name, c.link);
    if (!peekTarget(url)) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    peek.open({ name: c.name, url, anchor: el.getBoundingClientRect(), ...themeAt(el) });
  }

  // ── Stat block windows: several may be open, each where it was put; the last pressed on top.
  // (Raised by a number, never moved in the list: they live at the end of the page.)
  let windows = $state<{ id: string; left: number; top: number; z: number }[]>([]);
  let topZ = 0;
  function openStats(c: Creature) {
    if (windows.some((w) => w.id === c.id)) return front(c.id);
    const step = (windows.length % 6) * 28;
    const width = Math.min(416, window.innerWidth - 24);
    windows = [...windows, { id: c.id, left: Math.max(12, window.innerWidth - width - 24 - step), top: 72 + step, z: ++topZ }];
  }
  function front(id: string) {
    const w = windows.find((x) => x.id === id);
    if (w && w.z !== topZ) w.z = ++topZ;
  }
  const closeStats = (id: string) => (windows = windows.filter((w) => w.id !== id));
  const opened = $derived.by(() => {
    const byZ = [...windows].sort((a, b) => a.z - b.z).map((w) => w.id);
    return windows.flatMap((w) => {
      const c = table.list.find((x) => x.id === w.id);
      return c ? [{ w, c, rank: byZ.indexOf(w.id) }] : [];
    });
  });

  // ── Adding, and changing one: one window, three ways in.
  // Number fields bound with bind:value hold numbers once typed in, strings before.
  type Draft = { name: string; kind: CreatureKind; hp: string | number; ac: string | number; howMany: string | number; link: string; portrait: string; statblock: StatBlock; keep: boolean };
  type Way = 'book' | 'homebrew' | 'write';
  type Editing = { id: string | null; homebrewId?: string; way: Way; draft: Draft };
  const WAYS: [Way, string][] = [['book', 'From 5e.tools'], ['homebrew', 'Your homebrew'], ['write', 'Write one']];
  let editing = $state<Editing | null>(null);
  let saving = $state(false);
  const blank = (): Draft => ({ name: '', kind: 'monster', hp: '', ac: '', howMany: 1, link: '', portrait: '', statblock: {}, keep: false });
  const num = (v: string | number | null | undefined) => {
    const s = String(v ?? '').trim();
    return s === '' || !Number.isFinite(Number(s)) ? null : Math.max(0, Math.round(Number(s)));
  };
  const count = (v: string | number) => Math.max(1, Math.min(20, Math.round(Number(v)) || 1));
  function startAdd() {
    editing = { id: null, way: 'book', draft: blank() };
  }
  function startEdit(c: Creature) {
    editing = {
      id: c.id, way: 'write',
      draft: { name: c.name, kind: c.kind, hp: c.hp_max ?? '', ac: c.ac ?? '', howMany: 1, link: c.link, portrait: c.portrait ?? '', statblock: c.statblock ?? {}, keep: false }
    };
  }
  function editHomebrew(id: string) {
    const h = table.homebrew.find((x) => x.id === id);
    if (!h) return;
    editing = {
      id: null, homebrewId: h.id, way: 'write',
      draft: { ...blank(), name: h.name, kind: h.kind, portrait: h.portrait ?? '', statblock: h.statblock, keep: true }
    };
  }
  async function save() {
    if (!editing || !editing.draft.name.trim() || saving) return;
    const e = editing;
    const d = e.draft;
    const statblock = cleanStatBlock({ ...d.statblock, source: d.statblock.source || 'Homebrew' });
    // Hit points and armour class from the boxes, else from the stat block.
    const hpMax = num(d.hp) ?? leadingNumber(statblock.hp);
    const ac = num(d.ac) ?? leadingNumber(statblock.ac);
    const name = d.name.trim();
    const portrait = d.portrait.trim();
    saving = true;
    try {
      if (d.keep && !(await table.keepHomebrew({ id: e.homebrewId, kind: d.kind, name, statblock, portrait }))) return;
      if (e.id) {
        const c = table.list.find((x) => x.id === e.id);
        if (c) {
          // A new most keeps the hit points lost so far.
          const lost = c.hp_max === null ? 0 : c.hp_max - hpNow(c);
          await table.change(c, {
            name, kind: d.kind, ac, link: d.link.trim(), hp_max: hpMax, statblock, portrait,
            hp_current: hpMax === null ? c.hp_current : Math.max(0, hpMax - lost)
          });
        }
      } else if (e.homebrewId) {
        // Changing a homebrew one: saved above, back to the list.
        editing = { id: null, way: 'homebrew', draft: blank() };
        return;
      } else {
        const made = await table.add({ name, kind: d.kind, hp_max: hpMax, ac, link: d.link.trim(), statblock, portrait }, count(d.howMany));
        if (!made.length) return;
      }
      editing = null;
    } finally {
      saving = false;
    }
  }

  // From 5e.tools: the monsters in the search index (loaded on first use).
  let index = $state<IndexRow[] | null>(null);
  let bookQuery = $state('');
  let howMany = $state<string | number>(1);
  let adding = $state<string | null>(null);
  $effect(() => {
    if (editing?.way === 'book' && !index) import('#lib/data/search-index.json').then((m) => (index = m.default as IndexRow[]));
  });
  const bookHits = $derived(index ? search(index, bookQuery, 20, ['m']) : []);
  async function addBook(name: string, source: string) {
    adding = `${name}|${source}`;
    const made = await table.addFromFive(name, source, count(howMany));
    adding = null;
    if (made.length) editing = null;
  }
  async function addBrew(id: string) {
    adding = id;
    const made = await table.addHomebrew(id, count(howMany));
    adding = null;
    if (made.length) editing = null;
  }

  // ── Removing one (asked once, on the card).
  let confirming = $state<string | null>(null);
  function saveNote(c: Creature, value: string) {
    if (value !== c.notes) void table.change(c, { notes: value.slice(0, 4000) });
  }
</script>

<SectionHead title="Monsters & NPCs" infoLabel="About monsters and NPCs">
  {#snippet info()}
    Only you see these, unless you reveal one with its eye: your players then see its name, portrait, conditions and how
    hurt it looks, never its numbers or notes. Drag a card to move it.
  {/snippet}
  {#if table.notice}<span class="creaturenotice" role="status" transition:fade={{ duration: still ? 0 : 160 }}>{table.notice}</span>{/if}
  {#snippet end()}
    {#if !ended}<button class="smallbtn accent" onclick={startAdd}>Add a monster or NPC</button>{/if}
  {/snippet}
</SectionHead>

{#if table.error}<p class="app-alert bad" role="alert">{table.error}</p>{/if}

{#if table.loading}
  <div class="creaturegrid" aria-busy="true" aria-label="Loading the monsters and NPCs">
    {#each Array(3) as _, i (i)}
      <div class="creature skel"><i class="skeleton sk-name"></i><i class="skeleton sk-hp"></i><i class="skeleton sk-bar"></i><i class="skeleton sk-row"></i></div>
    {/each}
  </div>
{:else if table.list.length === 0}
  <p class="creatureempty">No monsters or NPCs yet. Add the goblins before the party finds them.</p>
{:else}
  <ul class="creaturegrid" use:reorder={{
    enabled: !ended, keys: table.list.map((c) => c.id), scale: 1.02,
    onpreview: (keys) => (preview = keys),
    oncommit: (keys) => { preview = null; void table.reorder(keys); }
  }}>
    {#each shown as c (c.id)}
      {@const max = c.hp_max ?? 0}
      {@const now = hpNow(c)}
      {@const v = vitalStatus(now, max)}
      {@const kind = kindLine(c.statblock ?? {})}
      {@const ring = ringOf(c)}
      {@const pic = resolveImageUrl(c.portrait).url}
      <li class="creature {v.vital}" class:revealed={c.visible} data-key={c.id}
          animate:flip={{ duration: still ? 0 : 240, easing: cubicOut }} transition:fade={{ duration: still ? 0 : 180 }}>
        <div class="creaturehead">
          <span class="cportrait" class:ringed={ring.length > 0} class:npc={c.kind === 'npc'}>
            {#if pic}<img src={pic} alt="" draggable="false" loading="lazy" />{:else}
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {#if c.kind === 'npc'}<circle cx="12" cy="8.5" r="3.75" /><path d="M4.75 20c.6-3.9 3.6-6.25 7.25-6.25s6.65 2.35 7.25 6.25" />
                {:else}<path d="M8.25 8.5 5 3.25l.75 6.25M15.75 8.5 19 3.25l-.75 6.25" /><circle cx="12" cy="14" r="6.25" /><path d="M9.75 13.5h.01M14.25 13.5h.01M10 17.25h4" />{/if}
              </svg>
            {/if}
            <ConditionRing bands={ring} />
          </span>
          <div class="creaturename">
            <strong>{c.name}</strong>
            <span class="kindtag" class:npc={c.kind === 'npc'}>{c.kind === 'npc' ? 'NPC' : 'Monster'}</span>
            {#if kind || c.statblock?.cr}<span class="creaturekind">{kind}{#if c.statblock?.cr}{kind ? ', ' : ''}CR {c.statblock.cr}{/if}</span>{/if}
          </div>
          <div class="creaturetools">
            {#if tools}{@render tools(c)}{/if}
            {#if !ended}
              <button class="ctool eye" class:on={c.visible} aria-pressed={c.visible}
                      aria-label={c.visible ? `Hide ${c.name} from your players` : `Reveal ${c.name} to your players`}
                      title={c.visible ? 'Your players can see it. Press to hide it.' : 'Hidden from your players. Press to reveal it.'}
                      onclick={() => table.change(c, { visible: !c.visible })}>
                {#if c.visible}
                  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /><circle cx="12" cy="12" r="2.75" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
                {:else}
                  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM4 4l16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                {/if}
              </button>
            {/if}
            <button class="ctool" aria-label="{c.name}’s stat block" title="Stat block (and its 5e.tools page)" onclick={() => openStats(c)}>
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M6 3.5h9l3 3v14H6zM9 9h6M9 12.5h6M9 16h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
            {#if !ended}
              <button class="ctool" aria-label="Change {c.name}" title="Change it and its stat block" onclick={() => startEdit(c)}>
                <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10zM14 7l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </button>
              {#if confirming === c.id}
                <span class="confirmrm" transition:fade={{ duration: 120 }}>
                  <button class="smallbtn danger" onclick={() => { confirming = null; closeStats(c.id); void table.remove(c); }}>Remove</button>
                  <button class="smallbtn quiet" onclick={() => (confirming = null)}>Keep</button>
                </span>
              {:else}
                <button class="ctool rm" aria-label="Remove {c.name}" title="Remove" onclick={() => (confirming = c.id)}>×</button>
              {/if}
            {/if}
          </div>
        </div>

        {#if c.hp_max !== null}
          <CardHp cur={now} {max} temp={c.hp_temp} vital={v.vital} label={v.label} />
        {/if}

        <div class="creaturerow">
          <div class="acbox" title="Armour class"><span class="k">AC</span><b>{c.ac ?? '–'}</b></div>
          {#if c.initiative !== null}<div class="acbox" title="Initiative"><span class="k">INIT</span><b>{c.initiative}</b></div>{/if}
          {#if !ended && c.hp_max !== null}
            <div class="hpctl">
              <input type="number" inputmode="numeric" min="1" placeholder="0" aria-label="Amount for {c.name}"
                     bind:value={amounts[c.id]} onkeydown={(e) => { if (e.key === 'Enter') hit(c, 'damage'); }} />
              <button class="smallbtn hurt" onclick={() => hit(c, 'damage')}>Damage</button>
              <button class="smallbtn" onclick={() => hit(c, 'heal')}>Heal</button>
            </div>
          {/if}
        </div>

        <ul class="cconds">
          {#each c.conditions as name (name)}
            {@const colour = colourOf(c, name)}
            <li style:--cc={colour ?? 'var(--dim)'} class:plain={!colour} transition:fade={{ duration: still ? 0 : 150 }}>
              {#if !ended && !isStandard(name)}
                <!-- One of the DM's own: its dot opens its colour. -->
                <button class="cdot tint" aria-label="Choose {name}’s colour" title="Colour" onclick={() => (tinting = { id: c.id, name })}></button>
              {:else}
                <span class="cdot" aria-hidden="true"></span>
              {/if}{name}
              {#if !ended}<button class="cx" aria-label="Take {name} away from {c.name}" onclick={() => toggleCondition(c, name)}>×</button>{/if}
            </li>
          {/each}
          {#if !ended}
            <li class="add">
              <button class="plus" aria-label="Give {c.name} a condition" title="Give a condition" onclick={() => (giving = c.id)}>
                <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M6 1.5v9M1.5 6h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
              </button>
            </li>
          {/if}
        </ul>

        <textarea class="cnote" rows="2" placeholder="A note: tactics, loot, what it wants" aria-label="Note on {c.name}"
                  readonly={ended} value={c.notes} onblur={(e) => saveNote(c, e.currentTarget.value)}></textarea>
      </li>
    {/each}
  </ul>
{/if}

{#each opened as { w, c, rank } (w.id)}
  <StatWindow name={c.name} statblock={c.statblock ?? {}} left={w.left} top={w.top} z={rank} onclose={() => closeStats(w.id)} onfront={() => front(w.id)}
              link={c.link.trim() || null} onlink={(e) => openPage(c, e)} />
{/each}

{#if giver}
  <!-- Giving conditions; a new one of the DM's own asks its colour in the same window. -->
  <DimModal id="creature-conds" title="Conditions for {giver.name}" onclose={() => { giving = null; tinting = null; }}>
    <ConditionGiver given={giver.conditions} ontoggle={(name) => toggleCondition(giver, name)} onadd={(name) => addCondition(giver, name)}
                    ondone={() => { giving = null; tinting = null; }} />
    {#if tinted && tinted.id === giver.id && tinting && has(giver.conditions, tinting.name)}
      <div class="lookin">
        <ConditionLookPicker colorOnly name={tinting.name} who={giver.name} look={lookFor(giver, tinting.name)}
                             onchange={(patch) => setLook(giver, tinting!.name, patch)} ondone={() => (tinting = null)} />
      </div>
    {/if}
  </DimModal>
{:else if tinted && tinting && has(tinted.conditions, tinting.name)}
  <DimModal id="creature-look" title="{tinting.name} on {tinted.name}" onclose={() => (tinting = null)}>
    <ConditionLookPicker colorOnly name={tinting.name} who={tinted.name} look={lookFor(tinted, tinting.name)}
                         onchange={(patch) => setLook(tinted, tinting!.name, patch)} ondone={() => (tinting = null)} />
  </DimModal>
{/if}

{#if editing}
  {@const e = editing}
  <DimModal id="creature-edit" wide onclose={() => (editing = null)}
            title={e.id ? `Change ${e.draft.name || 'it'}` : e.homebrewId ? `Change ${e.draft.name || 'it'} in your homebrew` : 'Add a monster or NPC'}>
    {#if !e.id && !e.homebrewId}
      <div class="ways" role="tablist" aria-label="Where it comes from">
        {#each WAYS as [way, label] (way)}
          <button type="button" role="tab" aria-selected={e.way === way} class:on={e.way === way} onclick={() => (e.way = way)}>{label}</button>
        {/each}
      </div>
    {/if}

    {#if e.way === 'book'}
      <div class="pickrow">
        <!-- svelte-ignore a11y_autofocus -->
        <input class="pickquery" bind:value={bookQuery} placeholder="Goblin, Owlbear, Adult Red Dragon" aria-label="Find a monster on 5e.tools" autofocus />
        <label class="howmany"><span>How many</span><input type="number" min="1" max="20" inputmode="numeric" bind:value={howMany} /></label>
      </div>
      <ul class="picklist themed-scroll">
        {#each bookHits as h (h.url)}
          <li transition:fade={{ duration: still ? 0 : 120 }}>
            <span class="pickname">{h.name}<span class="pickwords">{h.words}<span class="pickbook">{h.source}</span></span></span>
            <button class="smallbtn accent" disabled={adding !== null} onclick={() => addBook(h.name, h.source)}>
              {adding === `${h.name}|${h.source}` ? 'Summoning' : count(howMany) > 1 ? `Add ${count(howMany)}` : 'Add'}
            </button>
          </li>
        {:else}
          <li class="pickempty">{bookQuery.trim().length < 2 ? 'Type a monster’s name.' : index ? 'No monster by that name in the books.' : 'Opening the bestiary'}</li>
        {/each}
      </ul>
    {:else if e.way === 'homebrew'}
      <div class="pickrow">
        <p class="pickhint">Your own monsters and NPCs, for any of your campaigns.</p>
        <label class="howmany"><span>How many</span><input type="number" min="1" max="20" inputmode="numeric" bind:value={howMany} /></label>
      </div>
      <ul class="picklist themed-scroll">
        {#each table.homebrew as h (h.id)}
          {@const hk = kindLine(h.statblock)}
          <li transition:fade={{ duration: still ? 0 : 120 }}>
            <span class="pickname">{h.name}<span class="pickwords">{h.kind === 'npc' ? 'NPC' : 'Monster'}{hk ? `, ${hk}` : ''}{h.statblock.cr ? `, CR ${h.statblock.cr}` : ''}</span></span>
            <button class="smallbtn quiet" onclick={() => editHomebrew(h.id)}>Change</button>
            <button class="smallbtn quiet" onclick={() => table.forgetHomebrew(h.id)} title="Take it out of your homebrew">Forget</button>
            <button class="smallbtn accent" disabled={adding !== null} onclick={() => addBrew(h.id)}>
              {adding === h.id ? 'Summoning' : count(howMany) > 1 ? `Add ${count(howMany)}` : 'Add'}
            </button>
          </li>
        {:else}
          <li class="pickempty">No homebrew yet. Write one, and keep it in your homebrew.</li>
        {/each}
      </ul>
    {:else}
      <form class="cform" onsubmit={(ev) => { ev.preventDefault(); void save(); }}>
        <label class="wide"><span>Name</span><input bind:value={e.draft.name} maxlength="80" placeholder="Mud Imp" required /></label>
        <div class="wide kindpick" role="radiogroup" aria-label="Kind">
          {#each [['monster', 'Monster'], ['npc', 'NPC']] as [value, label] (value)}
            <button type="button" role="radio" aria-checked={e.draft.kind === value} class:on={e.draft.kind === value}
                    onclick={() => (e.draft.kind = value as CreatureKind)}>{label}</button>
          {/each}
        </div>
        {#if !e.homebrewId}
          <label><span>Hit points</span><input type="number" min="0" inputmode="numeric" bind:value={e.draft.hp} placeholder="From its stat block" /></label>
          <label><span>Armour class</span><input type="number" min="0" inputmode="numeric" bind:value={e.draft.ac} placeholder="From its stat block" /></label>
          {#if !e.id}
            <label><span>How many</span><input type="number" min="1" max="20" inputmode="numeric" bind:value={e.draft.howMany} /></label>
          {/if}
          <label class="wide"><span>5e.tools link (optional)</span>
            <input bind:value={e.draft.link} maxlength="500" placeholder="Left empty, its name is searched" /></label>
        {/if}
        <label class="wide"><span>Portrait (a picture link, optional)</span>
          <input bind:value={e.draft.portrait} maxlength="2000" placeholder="Google Drive, Imgur, Pinterest, Dropbox or any image link" /></label>
        <div class="wide sbwrap">
          <h3 class="sbtitle">Stat block</h3>
          <StatBlockEditor bind:value={e.draft.statblock} />
        </div>
        {#if !e.homebrewId}
          <label class="wide keep"><input type="checkbox" bind:checked={e.draft.keep} />
            <span>Keep it in your homebrew too</span>
            <InfoTip label="About your homebrew">Kept there, it’s yours to add to any of your campaigns, from Your homebrew when adding, or from the search.</InfoTip>
          </label>
        {/if}
        <div class="wide cformdo">
          <button type="button" class="smallbtn quiet" onclick={() => (editing = e.homebrewId ? { id: null, way: 'homebrew', draft: blank() } : null)}>Cancel</button>
          <button class="smallbtn accent" disabled={!e.draft.name.trim() || saving}>
            {saving ? 'Saving' : e.id || e.homebrewId ? 'Save' : count(e.draft.howMany) > 1 ? `Add ${count(e.draft.howMany)}` : 'Add'}
          </button>
        </div>
      </form>
    {/if}
  </DimModal>
{/if}

<style>
  .creaturenotice { font-size: 0.8125rem; color: var(--a); }
  .creatureempty { color: var(--dim); font-size: 0.875rem; margin: 0.5rem 0 0; }
  .creaturegrid {
    list-style: none; margin: 0; padding: 0; display: grid; gap: 0.875rem; position: relative;
    grid-template-columns: repeat(auto-fill, minmax(min(22rem, 100%), 1fr));
  }
  .creature {
    position: relative; display: grid; gap: 0.75rem; align-content: start; min-width: 0;
    padding: 0.875rem; border-radius: var(--r); background: var(--surface); border: 1px solid var(--line-soft);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .creature:hover { border-color: var(--a-edge); }
  .creature.revealed { box-shadow: inset 3px 0 0 color-mix(in oklch, var(--a) 70%, transparent); }
  .creature:is(.critical, .down) { border-color: color-mix(in oklch, oklch(62% 0.21 25) 55%, var(--line)); }
  .creature.skel { min-height: 11rem; }
  .sk-name { width: 9rem; height: 1rem; }
  .sk-hp { width: 5rem; height: 1.75rem; }
  .sk-bar { height: 6px; }
  .sk-row { height: 2rem; }
  .creaturehead { display: flex; align-items: flex-start; gap: 0.75rem; }
  .creaturehead .creaturename { flex: 1; }
  .cportrait {
    position: relative; flex: none; width: 3.25rem; height: 3.25rem; border-radius: var(--r-sm); display: grid; place-items: center;
    border: 1px solid color-mix(in oklch, oklch(62% 0.21 25) 45%, var(--line)); background: var(--raised); color: var(--dim);
    transition: border-color 0.35s ease;
  }
  .cportrait.npc { border-color: var(--a-edge); }
  .cportrait.ringed { border-color: transparent; }
  .cportrait img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
  .cportrait svg { width: 1.625rem; height: 1.625rem; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
  .cdot.tint { padding: 0; border: 0; cursor: pointer; width: 0.625rem; height: 0.625rem; transition: transform 0.15s ease; }
  .cdot.tint:hover { transform: scale(1.25); }
  .cdot.tint:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
  .cconds li.plain .cdot { background: none; box-shadow: inset 0 0 0 1px var(--dim); }
  .lookin { margin-top: 0.75rem; }
  .creaturename { display: flex; align-items: center; gap: 0.25rem 0.5rem; flex-wrap: wrap; min-width: 0; }
  .creaturename strong { font-size: 1.0625rem; overflow-wrap: anywhere; }
  .creaturekind { flex-basis: 100%; font-size: 0.75rem; font-style: italic; color: var(--dim); }
  .kindtag {
    font-size: 0.625rem; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 0.125rem 0.4375rem; border-radius: 999px; border: 1px solid color-mix(in oklch, oklch(62% 0.21 25) 45%, var(--line));
    color: color-mix(in oklch, oklch(70% 0.17 25) 80%, var(--text));
  }
  .kindtag.npc { border-color: var(--a-edge); color: var(--a); }
  .creaturetools { display: flex; align-items: center; gap: 0.125rem; flex: none; }
  .ctool {
    width: 1.75rem; height: 1.75rem; display: grid; place-items: center; padding: 0; border-radius: var(--r-sm);
    border: 1px solid transparent; background: none; color: var(--dim); cursor: pointer; text-decoration: none; font-size: 1.05rem;
    transition: color 0.15s ease, border-color 0.15s ease, transform 0.08s ease;
  }
  .ctool:hover { color: var(--a); border-color: var(--a-edge); }
  .ctool.eye.on { color: var(--a); }
  .ctool.rm:hover { color: var(--bad); border-color: color-mix(in oklch, var(--bad) 50%, transparent); }
  .ctool:active { transform: translateY(1px); }
  .ctool:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
  .confirmrm { display: inline-flex; gap: 0.25rem; }
  .smallbtn.danger { color: var(--bad); border-color: color-mix(in oklch, var(--bad) 55%, transparent); }
  .smallbtn.danger:hover { background: color-mix(in oklch, var(--bad) 12%, transparent); }
  .creaturerow { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .acbox {
    display: grid; justify-items: center; min-width: 3.25rem; padding: 0.375rem 0.5rem; border-radius: var(--r-sm);
    background: var(--raised); border: 1px solid var(--line-soft);
  }
  .acbox .k { font-size: 0.5625rem; font-weight: 650; letter-spacing: 0.08em; color: var(--label); }
  .acbox b { font-size: 1.125rem; font-variant-numeric: tabular-nums; }
  .hpctl { display: flex; align-items: center; gap: 0.375rem; flex: 1; min-width: 12rem; }
  .hpctl input {
    width: 4.5rem; font: inherit; font-size: 0.875rem; padding: 0.3125rem 0.5rem; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  .hpctl input:focus { outline: none; border-color: var(--a-edge); }
  .smallbtn.hurt:hover { border-color: color-mix(in oklch, var(--bad) 55%, transparent); color: var(--bad); }
  .cconds { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.375rem; align-items: center; }
  .cconds li:not(.add) {
    --cc: var(--dim);
    display: inline-flex; align-items: center; gap: 0.3125rem; font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 999px; color: var(--text);
    border: 1px solid color-mix(in oklch, var(--cc) 60%, var(--line)); background: color-mix(in oklch, var(--cc) 18%, var(--raised));
  }
  .cdot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--cc); box-shadow: 0 0 0 1px color-mix(in oklch, var(--text) 25%, transparent); }
  .cx { margin: 0 -0.25rem 0 0; padding: 0 0.125rem; border: 0; background: none; color: var(--dim); font-size: 0.875rem; line-height: 1; cursor: pointer; }
  .cx:hover { color: var(--bad); }
  .plus {
    width: 1.375rem; height: 1.375rem; padding: 0; display: grid; place-items: center; border-radius: 999px;
    border: 1px dashed var(--line); background: none; color: var(--dim); cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  .plus:hover { color: var(--a); border-color: var(--a-edge); }
  .cnote {
    width: 100%; resize: vertical; min-height: 2.5rem; font: inherit; font-size: 0.8125rem; line-height: 1.45; color: var(--text);
    padding: 0.4375rem 0.5625rem; border: 1px solid var(--line-soft); border-radius: var(--r-sm); background: var(--raised);
  }
  .cnote:focus { outline: none; border-color: var(--a-edge); }

  .ways { display: inline-grid; grid-auto-flow: column; gap: 0.25rem; padding: 3px; margin-bottom: 1rem; border-radius: 999px; border: 1px solid var(--line); background: var(--raised); max-width: 100%; }
  .ways button, .kindpick button {
    font: inherit; font-size: 0.8125rem; padding: 0.3125rem 0.875rem; border-radius: 999px; border: 1px solid transparent; white-space: nowrap;
    background: none; color: var(--dim); cursor: pointer; transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
  }
  .ways button:hover, .kindpick button:hover { color: var(--text); }
  .ways button.on, .kindpick button.on { color: var(--text); background: var(--a-wash); border-color: var(--a-edge); }
  .pickrow { display: flex; gap: 0.75rem; align-items: flex-end; }
  .pickhint { flex: 1; margin: 0; font-size: 0.8125rem; color: var(--dim); align-self: center; }
  .pickquery {
    flex: 1; min-width: 0; font: inherit; font-size: 0.9375rem; padding: 0.5rem 0.625rem; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  .pickquery:focus { outline: none; border-color: var(--a-edge); }
  .howmany { display: grid; gap: 0.25rem; font-size: 0.75rem; color: var(--label); }
  .howmany input {
    width: 5rem; font: inherit; font-size: 0.875rem; padding: 0.4375rem 0.5rem; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  .howmany input:focus { outline: none; border-color: var(--a-edge); }
  .picklist { list-style: none; margin: 0.75rem 0 0; padding: 0; height: min(22rem, 50vh); overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 0.25rem; }
  .picklist li { display: flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.375rem 0.375rem 0.625rem; border-radius: var(--r-sm); border: 1px solid var(--line-soft); background: var(--raised); }
  .pickname { flex: 1; min-width: 0; display: grid; font-weight: 600; font-size: 0.875rem; overflow-wrap: anywhere; }
  .pickwords { display: flex; gap: 0.5rem; font-weight: 400; font-size: 0.75rem; color: var(--dim); }
  .pickbook { color: var(--faint); font-variant: all-small-caps; letter-spacing: 0.04em; }
  .picklist li.pickempty { color: var(--dim); font-size: 0.8125rem; justify-content: center; border-style: dashed; background: none; padding: 1rem; }
  .cform { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; }
  .cform label { display: grid; gap: 0.3125rem; font-size: 0.75rem; color: var(--label); }
  .cform .wide { grid-column: 1 / -1; }
  .cform > label > input:not([type='checkbox']) {
    font: inherit; font-size: 0.875rem; padding: 0.4375rem 0.5625rem; color: var(--text); min-width: 0;
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  .cform > label > input:focus { outline: none; border-color: var(--a-edge); }
  .kindpick { display: inline-grid; grid-template-columns: 1fr 1fr; gap: 0.25rem; padding: 3px; border-radius: 999px; border: 1px solid var(--line); background: var(--raised); justify-self: start; }
  .sbwrap { border-top: 1px solid var(--line-soft); padding-top: 0.875rem; margin-top: 0.25rem; }
  .sbtitle { margin: 0 0 0.75rem; font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--label); font-weight: 600; }
  .cform label.keep { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; color: var(--text); }
  .keep input { accent-color: var(--a); width: 1rem; height: 1rem; margin: 0; }
  .cformdo { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem; }
  @media (max-width: 480px) {
    .cform { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .pickrow { flex-wrap: wrap; }
    .ways { grid-auto-flow: row; grid-template-columns: repeat(3, auto); }
    .ways button { padding: 0.3125rem 0.5rem; }
  }
</style>
