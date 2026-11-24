<!--
  Ready-made rows from the shared library, under a name being typed. Versions
  of the same name are listed together, the one most sheets use first, and
  each later one says how it differs. Arrow keys move, Enter picks, Escape
  closes; picking fills the row (EntryTable does the filling).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { portal } from '#lib/actions.ts';
  import InfoTip from './InfoTip.svelte';
  import { differences, FIELD_LABELS, searchLibrary, summary, type LibraryKind, type Suggestion } from '#lib/library.ts';

  let {
    kind,
    input,
    query,
    onpick,
    onclose
  }: {
    kind: LibraryKind;
    /** The name box being typed in: the menu hangs from it and reads its keys. */
    input: HTMLInputElement;
    query: string;
    onpick: (s: Suggestion) => void;
    onclose: () => void;
  } = $props();

  let hits = $state<Suggestion[]>([]);
  let active = $state(-1);
  let place = $state({ left: 0, top: 0, width: 320, above: false, room: 320 });
  let menu = $state<HTMLElement>();
  const id = `library-${Math.random().toString(36).slice(2, 9)}`;

  type Line = { s: Suggestion; first: boolean; label: string; detail: string; count: number };

  /** Grouped by name, most used first within each; the groups in the order the database ranked them. */
  const lines = $derived.by<Line[]>(() => {
    const groups = new Map<string, Suggestion[]>();
    for (const s of hits) {
      const key = s.name.toLowerCase();
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    const out: Line[] = [];
    for (const list of groups.values()) {
      const sorted = [...list].sort((a, b) => b.uses - a.uses);
      const top = sorted[0];
      sorted.forEach((s, i) => {
        if (i === 0) {
          out.push({ s, first: true, label: s.name, detail: summary(kind, s.data), count: list.length });
        } else {
          const diff = differences(kind, s.data, top.data);
          const labels = FIELD_LABELS[kind];
          out.push({
            s,
            first: false,
            label: diff.length ? `Differs in ${diff.map((k) => labels[k]).join(', ')}` : 'Same fields, other wording',
            detail: summary(kind, s.data, diff),
            count: list.length
          });
        }
      });
    }
    return out;
  });

  // Look things up as the name is typed, a moment after the typing pauses.
  $effect(() => {
    const q = query;
    let stale = false;
    const t = setTimeout(async () => {
      const found = await searchLibrary(kind, q);
      if (stale) return;
      hits = found;
      active = -1;
      if (!found.length) onclose();
      else position();
    }, 180);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  });

  function position() {
    const r = input.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(Math.max(r.width, 320), window.innerWidth - 2 * margin);
    const left = Math.min(Math.max(r.left, margin), window.innerWidth - width - margin);
    const below = window.innerHeight - r.bottom - margin;
    const above = below < 220 && r.top > below;
    const room = Math.max(160, Math.min(360, (above ? r.top : below) - 8));
    place = { left, top: above ? r.top - 4 : r.bottom + 4, width, above, room };
  }

  function pick(i: number) {
    const line = lines[i];
    if (line) onpick(line.s);
  }

  onMount(() => {
    const key = (e: KeyboardEvent) => {
      if (!lines.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        active = (active + step + lines.length + 1) % (lines.length + 1);
        if (active === lines.length) active = -1;
        menu?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && active >= 0) {
        e.preventDefault();
        pick(active);
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        onclose();
      } else if (e.key === 'Tab') {
        onclose();
      }
    };
    const blur = () => setTimeout(() => document.activeElement !== input && onclose(), 120);
    const move = () => position();
    input.addEventListener('keydown', key);
    input.addEventListener('blur', blur);
    input.setAttribute('aria-controls', id);
    input.setAttribute('aria-autocomplete', 'list');
    window.addEventListener('scroll', move, { passive: true, capture: true });
    window.addEventListener('resize', move);
    return () => {
      input.removeEventListener('keydown', key);
      input.removeEventListener('blur', blur);
      input.removeAttribute('aria-controls');
      input.removeAttribute('aria-autocomplete');
      input.removeAttribute('aria-activedescendant');
      window.removeEventListener('scroll', move, { capture: true });
      window.removeEventListener('resize', move);
    };
  });

  $effect(() => {
    if (active >= 0) input.setAttribute('aria-activedescendant', `${id}-${active}`);
    else input.removeAttribute('aria-activedescendant');
  });

  const sheets = (n: number) => `${n} ${n === 1 ? 'sheet' : 'sheets'}`;
</script>

{#if lines.length}
  <!-- svelte-ignore a11y_no_static_element_interactions (only keeps focus in the name box; the options are the listbox below) -->
  <div
    use:portal
    bind:this={menu}
    class="library-menu"
    class:above={place.above}
    style:left="{place.left}px"
    style:top="{place.top}px"
    style:width="{place.width}px"
    style:max-height="{place.room}px"
    onpointerdown={(e) => {
      // Keep the name box focused, so picking doesn't count as leaving it.
      if (!(e.target as Element).closest('.tip')) e.preventDefault();
    }}
  >
    <div class="library-head">
      <span>From the shared library</span>
      <InfoTip label="About the shared library">
        Rows other players have written, ready to use. Pick one to fill this row, then change
        anything you like. Names stay hidden, except for players you share a campaign with.
        Versions of the same name are listed together, the most used first.
      </InfoTip>
    </div>
    <ul role="listbox" {id} aria-label="Ready-made rows">
      {#each lines as line, i (line.s.id)}
        <li
          id="{id}-{i}"
          data-i={i}
          role="option"
          aria-selected={i === active}
          class:first={line.first}
          class:variant={!line.first}
          class:active={i === active}
          onpointerenter={() => (active = i)}
          onclick={() => pick(i)}
          onkeydown={() => {}}
        >
          <span class="lib-main">
            <span class="lib-label">{line.label}</span>
            {#if line.detail}<span class="lib-detail">{line.detail}</span>{/if}
          </span>
          <span class="lib-meta">
            <span class="lib-uses">{sheets(line.s.uses)}</span>
            {#if line.s.mine}<span class="lib-who">Yours</span>
            {:else if line.s.author}<span class="lib-who" title="In a campaign with you">{line.s.author}</span>{/if}
          </span>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .library-menu {
    position: fixed;
    z-index: 75;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r);
    box-shadow: 0 14px 36px rgb(0 0 0 / 0.45);
    animation: library-in 0.16s cubic-bezier(0.22, 1, 0.36, 1);
    transform-origin: 50% 0;
  }
  .library-menu.above {
    translate: 0 -100%;
    transform-origin: 50% 100%;
  }
  :global([data-mode='light']) .library-menu { box-shadow: 0 14px 32px rgb(20 20 40 / 0.14); }
  @keyframes library-in {
    from { opacity: 0; transform: translateY(-4px); }
  }

  .library-head {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem 0.375rem;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--label);
    border-bottom: 1px solid var(--line-soft);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0.25rem;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  li {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.4375rem 0.5rem;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    cursor: pointer;
    transition: background-color 0.12s var(--ease-out), border-color 0.12s var(--ease-out);
  }
  li.variant { padding-left: 1.25rem; }
  li.first:not(:first-child) { margin-top: 0.25rem; }
  li.active { background: var(--hover-bg); border-color: var(--a-edge); }
  li:active { transform: translateY(1px); }

  .lib-main { display: grid; gap: 0.125rem; min-width: 0; }
  .lib-label { font-size: 0.8125rem; color: var(--text); overflow-wrap: anywhere; }
  li.first .lib-label { font-weight: 600; }
  li.variant .lib-label { color: var(--dim); }
  li.active .lib-label { color: var(--a); }
  .lib-detail { font-size: 0.75rem; color: var(--dim); overflow-wrap: anywhere; }

  .lib-meta { flex: none; display: grid; justify-items: end; gap: 0.125rem; font-size: 0.6875rem; color: var(--faint); white-space: nowrap; }
  .lib-who {
    color: var(--a);
    border: 1px solid var(--a-edge);
    border-radius: 999px;
    padding: 0 0.375rem;
  }
  @media (prefers-reduced-motion: reduce) {
    .library-menu { animation: none; }
  }
</style>
