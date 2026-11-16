<!--
  The DM's monsters and NPCs on the campaign page (database/0017): a card
  each, like a character's: its hit points (with damage and healing a press
  away), armour class, conditions and a short note, and its page on
  5e.tools. Added, several of a kind at once, and changed in a window over
  the dimmed page. Only the DM ever sees them.
-->
<script lang="ts">
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import { creatureRepo, CreaturesMissing, type Creature, type CreatureFields } from '$lib/data/creatures';
  import { creatureUrl, damage, heal, hpNow, numberedNames, type CreatureKind } from '$lib/rules/creatures';
  import { cleanName, lookOf } from '$lib/rules/conditions';
  import { vitalStatus } from '$lib/rules/hp';
  import { friendlyError } from '$lib/errors';
  import { prefersReducedMotion } from '$lib/motion';
  import CardHp from './CardHp.svelte';
  import DimModal from './DimModal.svelte';
  import ConditionGiver from './ConditionGiver.svelte';
  import InfoTip from './InfoTip.svelte';

  let { campaignId, ended = false, count = $bindable(0) }: { campaignId: string; ended?: boolean; count?: number } = $props();

  let creatures = $state<Creature[]>([]);
  let loading = $state(true);
  let missing = $state(false);
  let error = $state<string | null>(null);
  $effect(() => {
    count = creatures.length;
  });

  $effect(() => {
    const id = campaignId;
    loading = true;
    creatureRepo.list(id)
      .then((rows) => (creatures = rows))
      .catch((e) => {
        if (e instanceof CreaturesMissing) missing = true;
        else error = friendlyError(e, 'The monsters slipped their leash! Try again in a moment.');
      })
      .finally(() => (loading = false));
  });

  /** Changed here at once, saved behind; put back if the save fails. */
  async function change(c: Creature, patch: CreatureFields) {
    const before = creatures;
    creatures = creatures.map((x) => (x.id === c.id ? { ...x, ...patch } : x));
    try {
      await creatureRepo.update(c.id, patch);
    } catch (e) {
      creatures = before;
      error = friendlyError(e, 'That change rolled a natural 1! Try it again.');
    }
  }

  // ── Hit points: an amount, then Damage or Heal.
  let amounts = $state<Record<string, string>>({});
  function hit(c: Creature, kind: 'damage' | 'heal') {
    const n = Number(amounts[c.id]);
    if (!Number.isFinite(n) || n <= 0) return;
    amounts[c.id] = '';
    void change(c, kind === 'damage' ? damage(c, n) : heal(c, n));
  }

  // ── Conditions.
  let giving = $state<string | null>(null);
  const has = (list: string[], name: string) => list.some((x) => x.toLowerCase() === name.toLowerCase());
  function toggleCondition(c: Creature, name: string) {
    const next = has(c.conditions, name) ? c.conditions.filter((x) => x.toLowerCase() !== name.toLowerCase()) : [...c.conditions, name];
    void change(c, { conditions: next });
  }
  function addCondition(c: Creature, written: string) {
    const name = cleanName(written);
    if (name && !has(c.conditions, name)) void change(c, { conditions: [...c.conditions, name] });
  }

  // ── Adding and changing one: the same window.
  // Number fields bound with bind:value hold numbers once typed in, strings before.
  type Draft = { name: string; kind: CreatureKind; hp: string | number; ac: string | number; howMany: string | number; link: string };
  let editing = $state<{ id: string | null; draft: Draft } | null>(null);
  let saving = $state(false);
  const blank = (): Draft => ({ name: '', kind: 'monster', hp: '', ac: '', howMany: '1', link: '' });
  const num = (v: string | number | null | undefined) => {
    const s = String(v ?? '').trim();
    return s === '' || !Number.isFinite(Number(s)) ? null : Math.max(0, Math.round(Number(s)));
  };
  function startEdit(c: Creature) {
    editing = { id: c.id, draft: { name: c.name, kind: c.kind, hp: c.hp_max?.toString() ?? '', ac: c.ac?.toString() ?? '', howMany: '1', link: c.link } };
  }
  async function save() {
    if (!editing || !editing.draft.name.trim() || saving) return;
    const d = editing.draft;
    const hpMax = num(d.hp);
    saving = true;
    try {
      if (editing.id) {
        const c = creatures.find((x) => x.id === editing!.id);
        if (c) {
          // A new most keeps the hit points lost so far.
          const lost = c.hp_max === null ? 0 : c.hp_max - hpNow(c);
          await change(c, {
            name: d.name.trim(), kind: d.kind, ac: num(d.ac), link: d.link.trim(), hp_max: hpMax,
            hp_current: hpMax === null ? c.hp_current : Math.max(0, hpMax - lost)
          });
        }
      } else {
        const names = numberedNames(d.name, Number(d.howMany) || 1, creatures.map((x) => x.name));
        const top = creatures.reduce((m, x) => Math.max(m, x.position), 0);
        const rows: CreatureFields[] = names.map((name, i) => ({
          name, kind: d.kind, hp_max: hpMax, hp_current: hpMax, ac: num(d.ac), link: d.link.trim(), position: top + i + 1
        }));
        const made = await creatureRepo.add(campaignId, rows);
        creatures = [...creatures, ...made];
      }
      editing = null;
    } catch (e) {
      error = e instanceof CreaturesMissing ? null : friendlyError(e, 'That one refused to be summoned! Try again.');
      if (e instanceof CreaturesMissing) missing = true;
    } finally {
      saving = false;
    }
  }

  // ── Removing one (asked once, on the card).
  let confirming = $state<string | null>(null);
  async function remove(c: Creature) {
    const before = creatures;
    creatures = creatures.filter((x) => x.id !== c.id);
    confirming = null;
    try {
      await creatureRepo.remove(c.id);
    } catch (e) {
      creatures = before;
      error = friendlyError(e, 'It won’t leave the table! Try removing it again.');
    }
  }

  // ── A note, saved when you leave the field.
  function saveNote(c: Creature, value: string) {
    if (value !== c.notes) void change(c, { notes: value.slice(0, 4000) });
  }

  const giver = $derived(creatures.find((c) => c.id === giving) ?? null);
</script>

{#if missing}
  <p class="app-alert" role="status">
    The monster pens aren’t built yet! Monsters and NPCs need a one-time database update
    (<code>0017_monsters_and_npcs.sql</code>).
  </p>
{:else}
  <div class="creaturebar">
    <span class="creaturetally">
      {creatures.length === 1 ? '1 creature' : `${creatures.length} creatures`}
      <InfoTip label="About monsters and NPCs">Only you, the DM, can see these. Your players never do.</InfoTip>
    </span>
    {#if !ended}
      <button class="smallbtn accent" onclick={() => (editing = { id: null, draft: blank() })}>Add a monster or NPC</button>
    {/if}
  </div>

  {#if error}<p class="app-alert bad" role="alert">{error}</p>{/if}

  {#if loading}
    <div class="creaturegrid" aria-busy="true" aria-label="Loading the monsters and NPCs">
      {#each Array(3) as _, i (i)}
        <div class="creature skel"><i class="skeleton sk-name"></i><i class="skeleton sk-hp"></i><i class="skeleton sk-bar"></i><i class="skeleton sk-row"></i></div>
      {/each}
    </div>
  {:else if creatures.length === 0}
    <p class="creatureempty">No monsters or NPCs yet. Add the goblins before the party finds them.</p>
  {:else}
    <ul class="creaturegrid">
      {#each creatures as c, i (c.id)}
        {@const max = c.hp_max ?? 0}
        {@const now = hpNow(c)}
        {@const v = vitalStatus(now, max)}
        <li class="creature {v.vital}" style:--i={i} animate:flip={{ duration: prefersReducedMotion() ? 0 : 240, easing: cubicOut }}
            transition:fade={{ duration: prefersReducedMotion() ? 0 : 180 }}>
          <div class="creaturehead">
            <div class="creaturename">
              <strong>{c.name}</strong>
              <span class="kindtag" class:npc={c.kind === 'npc'}>{c.kind === 'npc' ? 'NPC' : 'Monster'}</span>
            </div>
            <div class="creaturetools">
              <a class="ctool" href={creatureUrl(c.name, c.link)} target="_blank" rel="noopener noreferrer"
                 aria-label="{c.name} on 5e.tools" title="Open on 5e.tools">
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M2.5 3.5c2-.8 3.8-.6 5.5.6 1.7-1.2 3.5-1.4 5.5-.6v9c-2-.8-3.8-.6-5.5.6-1.7-1.2-3.5-1.4-5.5-.6zM8 4.1v9" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /></svg>
              </a>
              {#if !ended}
                <button class="ctool" aria-label="Change {c.name}" title="Change name, hit points, AC" onclick={() => startEdit(c)}>
                  <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10zM14 7l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </button>
                {#if confirming === c.id}
                  <span class="confirmrm" transition:fade={{ duration: 120 }}>
                    <button class="smallbtn danger" onclick={() => remove(c)}>Remove</button>
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
            <div class="acbox" title="Armour class"><span class="k">AC</span><b>{c.ac ?? '—'}</b></div>
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
              <li style:--cc={lookOf(name)?.color ?? 'var(--dim)'} transition:fade={{ duration: 150 }}>
                <span class="cdot" aria-hidden="true"></span>{name}
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
{/if}

{#if giver}
  <DimModal id="creature-conds" title="Conditions for {giver.name}" onclose={() => (giving = null)}>
    <ConditionGiver given={giver.conditions} ontoggle={(name) => toggleCondition(giver, name)} onadd={(name) => addCondition(giver, name)}
                    ondone={() => (giving = null)} />
  </DimModal>
{/if}

{#if editing}
  <DimModal id="creature-edit" title={editing.id ? `Change ${editing.draft.name || 'it'}` : 'Add a monster or NPC'} onclose={() => (editing = null)}>
    <form class="cform" onsubmit={(e) => { e.preventDefault(); void save(); }}>
      <label class="wide"><span>Name</span>
        <input bind:value={editing.draft.name} maxlength="80" placeholder="Goblin" required /></label>
      <div class="wide kindpick" role="radiogroup" aria-label="Kind">
        {#each [['monster', 'Monster'], ['npc', 'NPC']] as [value, label] (value)}
          <button type="button" role="radio" aria-checked={editing.draft.kind === value} class:on={editing.draft.kind === value}
                  onclick={() => editing && (editing.draft.kind = value as CreatureKind)}>{label}</button>
        {/each}
      </div>
      <label><span>Hit points</span><input type="number" min="0" inputmode="numeric" bind:value={editing.draft.hp} placeholder="7" /></label>
      <label><span>Armour class</span><input type="number" min="0" inputmode="numeric" bind:value={editing.draft.ac} placeholder="15" /></label>
      {#if !editing.id}
        <label><span>How many</span><input type="number" min="1" max="20" inputmode="numeric" bind:value={editing.draft.howMany} /></label>
      {/if}
      <label class="wide"><span>5e.tools link (optional)</span>
        <input bind:value={editing.draft.link} maxlength="500" placeholder="Left empty, its name is searched" /></label>
      <div class="wide cformdo">
        <button type="button" class="smallbtn quiet" onclick={() => (editing = null)}>Cancel</button>
        <button class="smallbtn accent" disabled={!editing.draft.name.trim() || saving}>
          {saving ? 'Summoning…' : editing.id ? 'Save' : Number(editing.draft.howMany) > 1 ? `Add ${Math.min(20, Number(editing.draft.howMany))}` : 'Add'}
        </button>
      </div>
    </form>
  </DimModal>
{/if}

<style>
  .creaturebar { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; margin: 1rem 0 0.875rem; }
  .creaturetally { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: var(--dim); }
  .creatureempty { color: var(--dim); font-size: 0.875rem; margin: 0.5rem 0 0; }
  .creaturegrid {
    list-style: none; margin: 0; padding: 0; display: grid; gap: 0.875rem;
    grid-template-columns: repeat(auto-fill, minmax(min(22rem, 100%), 1fr));
  }
  .creature {
    position: relative; display: grid; gap: 0.75rem; align-content: start; min-width: 0;
    padding: 0.875rem; border-radius: var(--r); background: var(--surface); border: 1px solid var(--line-soft);
    transition: border-color 0.2s ease;
  }
  .creature:hover { border-color: var(--a-edge); }
  .creature:is(.critical, .down) { border-color: color-mix(in oklch, oklch(62% 0.21 25) 55%, var(--line)); }
  .creature.skel { min-height: 11rem; }
  .sk-name { width: 9rem; height: 1rem; }
  .sk-hp { width: 5rem; height: 1.75rem; }
  .sk-bar { height: 6px; }
  .sk-row { height: 2rem; }
  .creaturehead { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
  .creaturename { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; min-width: 0; }
  .creaturename strong { font-size: 1.0625rem; overflow-wrap: anywhere; }
  .kindtag {
    font-size: 0.625rem; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 0.125rem 0.4375rem; border-radius: 999px; border: 1px solid color-mix(in oklch, oklch(62% 0.21 25) 45%, var(--line));
    color: color-mix(in oklch, oklch(70% 0.17 25) 80%, var(--text));
  }
  .kindtag.npc { border-color: var(--a-edge); color: var(--a); }
  .creaturetools { display: flex; align-items: center; gap: 0.25rem; flex: none; }
  .ctool {
    width: 1.75rem; height: 1.75rem; display: grid; place-items: center; padding: 0; border-radius: var(--r-sm);
    border: 1px solid transparent; background: none; color: var(--dim); cursor: pointer; text-decoration: none; font-size: 1.05rem;
    transition: color 0.15s ease, border-color 0.15s ease, transform 0.08s ease;
  }
  .ctool:hover { color: var(--a); border-color: var(--a-edge); }
  .ctool.rm:hover { color: var(--bad); border-color: color-mix(in oklch, var(--bad) 50%, transparent); }
  .ctool:active { transform: translateY(1px); }
  .ctool:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
  .confirmrm { display: inline-flex; gap: 0.25rem; }
  .smallbtn.danger { color: var(--bad); border-color: color-mix(in oklch, var(--bad) 55%, transparent); }
  .smallbtn.danger:hover { background: color-mix(in oklch, var(--bad) 12%, transparent); }
  .creaturerow { display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap; }
  .acbox {
    display: grid; justify-items: center; min-width: 3.5rem; padding: 0.375rem 0.5rem; border-radius: var(--r-sm);
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
  .cform { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; }
  .cform label { display: grid; gap: 0.3125rem; font-size: 0.75rem; color: var(--label); }
  .cform .wide { grid-column: 1 / -1; }
  .cform input {
    font: inherit; font-size: 0.875rem; padding: 0.4375rem 0.5625rem; color: var(--text); min-width: 0;
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  .cform input:focus { outline: none; border-color: var(--a-edge); }
  .kindpick { display: inline-grid; grid-template-columns: 1fr 1fr; gap: 0.25rem; padding: 3px; border-radius: 999px; border: 1px solid var(--line); background: var(--raised); justify-self: start; }
  .kindpick button {
    font: inherit; font-size: 0.8125rem; padding: 0.3125rem 1rem; border-radius: 999px; border: 1px solid transparent;
    background: none; color: var(--dim); cursor: pointer; transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
  }
  .kindpick button.on { color: var(--text); background: var(--a-wash); border-color: var(--a-edge); }
  .cformdo { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem; }
  @media (max-width: 480px) { .cform { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
</style>
