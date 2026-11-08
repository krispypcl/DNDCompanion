<script lang="ts">
  /**
   * The table's board, like a Jamboard: sticky notes, writing and drawing
   * that everyone in the campaign can add to, move and clear, and that
   * everyone with the page sees change as it happens (database/0008,
   * campaign_board). The board is 1600 × 1000 units, drawn to whatever width
   * the page gives it; on a phone it scrolls sideways rather than shrink to
   * nothing.
   */
  import { onMount, untrack } from 'svelte';
  import { fade, scale, slide } from 'svelte/transition';
  import { backOut, cubicOut } from 'svelte/easing';
  import { campaignMessage, campaignRepo, type BoardData, type BoardItem } from '$lib/data/campaigns';
  import { isConfigured, supabase } from '$lib/supabase';
  import { prefersReducedMotion } from '$lib/motion';

  let {
    campaignId,
    userId,
    canEdit
  }: { campaignId: string; userId: string | null; canEdit: boolean } = $props();

  const W = 1600;
  const H = 1000;
  type Tool = 'move' | 'pen' | 'note' | 'text' | 'erase';
  let tool = $state<Tool>('move');
  const NOTE_COLOURS = [
    { name: 'Yellow', c: 'oklch(88% 0.13 95)' },
    { name: 'Pink', c: 'oklch(82% 0.11 350)' },
    { name: 'Blue', c: 'oklch(83% 0.08 235)' },
    { name: 'Green', c: 'oklch(85% 0.11 150)' },
    { name: 'Orange', c: 'oklch(83% 0.12 60)' },
    { name: 'Purple', c: 'oklch(80% 0.1 300)' }
  ];
  const PEN_COLOURS = [
    { name: 'Chalk', c: 'var(--text)' },
    { name: 'Red', c: 'oklch(63% 0.21 25)' },
    { name: 'Gold', c: 'oklch(83% 0.15 90)' },
    { name: 'Green', c: 'oklch(70% 0.17 145)' },
    { name: 'Blue', c: 'oklch(66% 0.15 245)' },
    { name: 'Purple', c: 'oklch(64% 0.18 300)' }
  ];
  let noteColour = $state(NOTE_COLOURS[0].c);
  let penColour = $state(PEN_COLOURS[0].c);
  let penSize = $state(6);

  let items = $state<BoardItem[]>([]);
  let missing = $state(false);
  let error = $state<string | null>(null);
  const strokes = $derived(items.filter((i) => i.kind === 'stroke'));
  const cards = $derived(items.filter((i) => i.kind !== 'stroke').sort((a, b) => (a.data.z ?? 0) - (b.data.z ?? 0)));

  async function load() {
    const rows = await campaignRepo.board(campaignId);
    if (rows === null) {
      missing = true;
      return;
    }
    missing = false;
    items = rows;
  }

  /** Someone else's change, as it happens; our own echoes are already here. */
  function takeRemote(row: BoardItem) {
    const i = items.findIndex((x) => x.id === row.id);
    if (i < 0) items = [...items, row];
    else if (row.updated_at > items[i].updated_at && !(dragging?.id === row.id) && editingId !== row.id) {
      items[i] = row;
    }
  }
  onMount(() => {
    void load();
    if (!isConfigured) return;
    const channel = supabase
      .channel(`board-${campaignId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_board', filter: `campaign_id=eq.${campaignId}` },
        (p) => takeRemote(p.new as BoardItem))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_board', filter: `campaign_id=eq.${campaignId}` },
        (p) => takeRemote(p.new as BoardItem))
      // Deletes cannot be filtered: anything gone that is on this board goes.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'campaign_board' },
        (p) => {
          const gone = (p.old as { id?: string }).id;
          if (gone) items = items.filter((x) => x.id !== gone);
        })
      .subscribe();
    // In case an announcement was missed.
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), 20000);
    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  });

  async function add(kind: BoardItem['kind'], data: BoardData) {
    if (!userId) return null;
    error = null;
    try {
      const row = await campaignRepo.addToBoard(campaignId, userId, kind, data);
      if (!items.some((x) => x.id === row.id)) items = [...items, row];
      return row;
    } catch (e) {
      error = campaignMessage(e, 'The board wouldn’t take that! Try again.');
      return null;
    }
  }
  function patch(id: string, data: BoardData) {
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) return;
    items[i] = { ...items[i], data, updated_at: new Date().toISOString() };
  }
  async function save(id: string) {
    const item = items.find((x) => x.id === id);
    if (!item) return;
    try {
      await campaignRepo.updateBoard(id, item.data);
    } catch (e) {
      error = campaignMessage(e, 'That change slipped off the board! Try again.');
    }
  }
  async function remove(ids: string[]) {
    const before = items;
    items = items.filter((x) => !ids.includes(x.id));
    try {
      await campaignRepo.removeFromBoard(ids);
    } catch (e) {
      items = before;
      error = campaignMessage(e, 'That one is stuck to the board! Try again.');
    }
  }
  const topZ = () => Math.max(0, ...items.map((i) => i.data.z ?? 0)) + 1;

  // ── Where on the board a pointer is, in board units ──
  let boardEl = $state<HTMLDivElement>();
  function at(e: PointerEvent): [number, number] {
    const r = boardEl!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * W), Math.round(((e.clientY - r.top) / r.height) * H)];
  }

  // ── Drawing ──
  let drawing = $state<number[] | null>(null);
  function boardDown(e: PointerEvent) {
    if (!canEdit || e.button > 0) return;
    if (tool === 'pen') {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      drawing = at(e);
    } else if (tool === 'note' || tool === 'text') {
      const [x, y] = at(e);
      const w = tool === 'note' ? 220 : 320;
      const h = tool === 'note' ? 170 : 60;
      void add(tool, {
        x: Math.min(W - w, Math.max(0, x - w / 2)), y: Math.min(H - h, Math.max(0, y - 20)), w, h, text: '',
        color: tool === 'note' ? noteColour : penColour, size: tool === 'note' ? 22 : 34, z: topZ()
      }).then((row) => {
        if (row) {
          editingId = row.id;
          tool = 'move';
        }
      });
    }
  }
  function boardMove(e: PointerEvent) {
    if (drawing) {
      const [x, y] = at(e);
      const n = drawing.length;
      if (Math.hypot(x - drawing[n - 2], y - drawing[n - 1]) >= 3) drawing = [...drawing, x, y];
    } else if (dragging) moveDrag(e);
  }
  function boardUp() {
    if (drawing) {
      const pts = drawing.length >= 4 ? drawing : [...drawing, drawing[0] + 1, drawing[1] + 1];
      drawing = null;
      void add('stroke', { points: pts.slice(0, 4000), color: penColour, size: penSize });
    }
    if (dragging) endDrag();
  }
  const pathOf = (p: number[] = []) => {
    if (p.length < 2) return '';
    let d = `M${p[0]} ${p[1]}`;
    // Smoothed through the midpoints, so a quick line is not a zigzag.
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = (p[i] + p[i + 2]) / 2;
      const my = (p[i + 1] + p[i + 3]) / 2;
      d += ` Q${p[i]} ${p[i + 1]} ${mx} ${my}`;
    }
    d += ` L${p[p.length - 2]} ${p[p.length - 1]}`;
    return d;
  };
  /** The eraser takes a stroke it passes over (while pressed) or is tapped on. */
  let erasing = false;
  function eraseOver(id: string) {
    if (tool === 'erase' && erasing) void remove([id]);
  }

  // ── Moving notes and writing ──
  let dragging = $state<{ id: string; dx: number; dy: number; last: number } | null>(null);
  function startDrag(e: PointerEvent, item: BoardItem) {
    if (!canEdit || tool !== 'move' || editingId === item.id) return;
    e.preventDefault();
    e.stopPropagation();
    boardEl?.setPointerCapture(e.pointerId);
    const [x, y] = at(e);
    patch(item.id, { ...item.data, z: topZ() });
    dragging = { id: item.id, dx: x - (item.data.x ?? 0), dy: y - (item.data.y ?? 0), last: 0 };
  }
  function moveDrag(e: PointerEvent) {
    if (!dragging) return;
    const item = items.find((x) => x.id === dragging!.id);
    if (!item) return;
    const [x, y] = at(e);
    const w = item.data.w ?? 200;
    const h = item.data.h ?? 100;
    patch(item.id, {
      ...item.data,
      x: Math.min(W - w, Math.max(0, x - dragging.dx)),
      y: Math.min(H - h, Math.max(0, y - dragging.dy))
    });
    // Others see it move, a few times a second.
    const now = performance.now();
    if (now - dragging.last > 220) {
      dragging.last = now;
      void save(item.id);
    }
  }
  function endDrag() {
    const id = dragging?.id;
    dragging = null;
    if (id) void save(id);
  }

  // ── Writing on a note ──
  let editingId = $state<string | null>(null);
  let typing: ReturnType<typeof setTimeout> | undefined;
  function write(item: BoardItem, text: string) {
    patch(item.id, { ...item.data, text: text.slice(0, 2000) });
    clearTimeout(typing);
    typing = setTimeout(() => void save(item.id), 450);
  }
  function stopWriting(item: BoardItem) {
    clearTimeout(typing);
    editingId = null;
    const now = items.find((x) => x.id === item.id);
    if (now && !now.data.text?.trim()) void remove([item.id]);
    else void save(item.id);
  }
  function focusOnMount(node: HTMLTextAreaElement) {
    node.focus();
    node.select();
  }

  let clearing = $state(false);
  const pop = () => ({ duration: prefersReducedMotion() ? 0 : 220, start: 0.85, easing: backOut });
  const unfold = () => ({ duration: prefersReducedMotion() ? 0 : 220, easing: cubicOut });
  $effect(() => {
    // Leaving the move tool ends any writing.
    if (tool !== 'move' && untrack(() => editingId)) editingId = null;
  });
</script>

<section class="boardwrap" aria-label="Table board">
  <div class="head">
    <span class="cap">Table board</span>
    {#if canEdit && !missing}
      <div class="tools" role="toolbar" aria-label="Board tools">
        {#each [
          { t: 'move', label: 'Move and write', d: 'M8 3v18l5-6 3.5 7 2.5-1.2-3.5-7H21z' },
          { t: 'pen', label: 'Draw', d: 'M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10zM14 7l3 3' },
          { t: 'note', label: 'Sticky note', d: 'M5 4h14v10l-6 6H5zM13 20v-6h6' },
          { t: 'text', label: 'Writing', d: 'M5 6V4h14v2M12 4v16M9 20h6' },
          { t: 'erase', label: 'Eraser (tap or drag over)', d: 'M8 20h12M5.5 14.5l8-8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L12 18H8z' }
        ] as b (b.t)}
          <button class="tool" class:on={tool === b.t} aria-pressed={tool === b.t} aria-label={b.label} title={b.label}
                  onclick={() => (tool = b.t as Tool)}>
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d={b.d} fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        {/each}
        {#if tool === 'pen' || tool === 'text'}
          <span class="sep" aria-hidden="true"></span>
          <div class="swatches" transition:fade={{ duration: 140 }}>
            {#each PEN_COLOURS as p (p.name)}
              <button class="sw" style:--sw={p.c} aria-label={p.name} title={p.name} aria-pressed={penColour === p.c}
                      onclick={() => (penColour = p.c)}></button>
            {/each}
          </div>
          {#if tool === 'pen'}
            <div class="sizes" transition:fade={{ duration: 140 }}>
              {#each [3, 6, 12, 22] as size (size)}
                <button class="size" aria-label="Thickness {size}" title="Thickness" aria-pressed={penSize === size}
                        onclick={() => (penSize = size)}><i style:--d="{Math.max(3, size / 2)}px"></i></button>
              {/each}
            </div>
          {/if}
        {:else if tool === 'note'}
          <span class="sep" aria-hidden="true"></span>
          <div class="swatches" transition:fade={{ duration: 140 }}>
            {#each NOTE_COLOURS as n (n.name)}
              <button class="sw" style:--sw={n.c} aria-label={n.name} title={n.name} aria-pressed={noteColour === n.c}
                      onclick={() => (noteColour = n.c)}></button>
            {/each}
          </div>
        {/if}
        <span class="grow"></span>
        {#if items.length}
          {#if clearing}
            <span class="ask" transition:fade={{ duration: 140 }}>Clear the whole board?
              <button class="danger" onclick={() => { clearing = false; void remove(items.map((i) => i.id)); }}>Clear</button>
              <button onclick={() => (clearing = false)}>Keep</button>
            </span>
          {:else}
            <button class="clear" onclick={() => (clearing = true)}>Clear board</button>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
  {#if error}<p class="err" role="alert" transition:slide={unfold()}>{error}</p>{/if}

  {#if missing}
    <p class="none">The board isn’t set up yet. It arrives with the 0008 migration.</p>
  {:else}
    <div class="viewport">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="board tool-{tool}" class:live={canEdit} bind:this={boardEl}
           onpointerdown={(e) => { erasing = true; boardDown(e); }} onpointermove={boardMove}
           onpointerup={() => { erasing = false; boardUp(); }} onpointercancel={() => { erasing = false; drawing = null; endDrag(); }}
           onpointerleave={() => (erasing = false)}>
        <svg class="ink" viewBox="0 0 {W} {H}" preserveAspectRatio="none" aria-hidden="true">
          {#each strokes as s (s.id)}
            <path d={pathOf(s.data.points)} style:stroke={s.data.color} stroke-width={s.data.size ?? 6}
                  class:erasable={tool === 'erase'}
                  onpointerdown={() => tool === 'erase' && remove([s.id])} onpointerenter={() => eraseOver(s.id)}
                  in:fade={{ duration: 160 }} out:fade={{ duration: 160 }} />
          {/each}
          {#if drawing}<path d={pathOf(drawing)} style:stroke={penColour} stroke-width={penSize} />{/if}
        </svg>
        {#each cards as item (item.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="item {item.kind}" class:lifted={dragging?.id === item.id}
               style:left="{((item.data.x ?? 0) / W) * 100}%" style:top="{((item.data.y ?? 0) / H) * 100}%"
               style:width="{((item.data.w ?? 200) / W) * 100}%" style:min-height="{((item.data.h ?? 100) / H) * 100}%"
               style:--ic={item.data.color} style:--fs="{((item.data.size ?? 22) / W) * 100}cqw" style:z-index={item.data.z ?? 0}
               onpointerdown={(e) => {
                 if (tool === 'erase' && canEdit) { e.stopPropagation(); void remove([item.id]); }
                 else startDrag(e, item);
               }}
               ondblclick={() => canEdit && tool === 'move' && (editingId = item.id)}
               transition:scale={pop()}>
            {#if editingId === item.id}
              <textarea value={item.data.text ?? ''} aria-label={item.kind === 'note' ? 'Sticky note' : 'Writing'}
                        use:focusOnMount oninput={(e) => write(item, e.currentTarget.value)}
                        onblur={() => stopWriting(item)}
                        onkeydown={(e) => { if (e.key === 'Escape') (e.currentTarget as HTMLTextAreaElement).blur(); }}
                        onpointerdown={(e) => e.stopPropagation()}></textarea>
            {:else}
              <p>{item.data.text || ' '}</p>
            {/if}
            {#if canEdit && tool === 'move' && editingId !== item.id}
              <button class="pen" aria-label="Write on it" title="Write on it (or double-click)"
                      onpointerdown={(e) => e.stopPropagation()} onclick={() => (editingId = item.id)}>
                <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /></svg>
              </button>
            {/if}
          </div>
        {/each}
        {#if !items.length}
          <p class="hint" in:fade={{ duration: 200 }}>
            {canEdit ? 'Pick a tool above: drop sticky notes, write, or draw. Everyone at the table sees it live.' : 'Nothing on the board yet.'}
          </p>
        {/if}
      </div>
    </div>
  {/if}
</section>

<style>
  .boardwrap { margin-top: 2rem; }
  .head { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.625rem; }
  .cap { font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--label); font-weight: 600; }
  .tools { flex: 1; display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; min-width: 0; }
  .tool {
    width: 2rem; height: 2rem; display: grid; place-items: center; padding: 0; border-radius: var(--r-sm);
    border: 1px solid var(--line); background: var(--raised); color: var(--text); cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.08s ease;
  }
  .tool:hover { border-color: var(--a-edge); color: var(--a); }
  .tool:active { transform: translateY(1px); }
  .tool.on { border-color: var(--a-edge); color: var(--a); background: var(--a-wash); }
  .sep { width: 1px; height: 1.25rem; background: var(--line); margin: 0 0.25rem; }
  .swatches, .sizes { display: flex; gap: 0.25rem; align-items: center; }
  .sw {
    width: 1.25rem; height: 1.25rem; border-radius: 50%; padding: 0; cursor: pointer; background: var(--sw);
    border: 2px solid var(--surface); box-shadow: 0 0 0 1px var(--line); transition: box-shadow 0.15s ease, transform 0.15s ease;
  }
  .sw[aria-pressed='true'] { box-shadow: 0 0 0 2px var(--a); transform: scale(1.1); }
  .size {
    width: 1.75rem; height: 1.75rem; display: grid; place-items: center; padding: 0; cursor: pointer; border-radius: var(--r-sm);
    border: 1px solid transparent; background: none; color: var(--text);
  }
  .size i { display: block; width: var(--d); height: var(--d); border-radius: 50%; background: currentColor; }
  .size[aria-pressed='true'] { border-color: var(--a-edge); background: var(--a-wash); color: var(--a); }
  .grow { flex: 1; }
  .clear, .ask button {
    font: inherit; font-size: 0.8125rem; cursor: pointer; border-radius: var(--r-sm); padding: 0.3125rem 0.75rem;
    border: 1px solid var(--line); background: var(--raised); color: var(--text);
  }
  .clear:hover { color: var(--bad); border-color: var(--bad); }
  .ask { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: var(--dim); }
  .ask .danger { border-color: var(--bad); color: var(--bad); background: none; }
  .err { color: var(--bad); font-size: 0.8125rem; margin: 0 0 0.5rem; }
  .none { color: var(--dim); font-size: 0.875rem; }

  .viewport { overflow-x: auto; border-radius: var(--r); border: 1px solid var(--line-soft); }
  /* Dots, like a board's surface; frosted over the banner. */
  .board {
    position: relative; width: max(100%, 52rem); aspect-ratio: 16 / 10; container-type: inline-size; overflow: hidden;
    background-color: color-mix(in oklch, var(--surface) 70%, transparent);
    background-image: radial-gradient(circle, color-mix(in oklch, var(--text) 14%, transparent) 1px, transparent 1.3px);
    background-size: 2.5cqw 2.5cqw;
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    touch-action: pan-x pan-y;
  }
  .board.live.tool-pen, .board.live.tool-erase { touch-action: none; }
  .board.live.tool-pen { cursor: crosshair; }
  .board.live.tool-note, .board.live.tool-text { cursor: copy; }
  .board.live.tool-erase { cursor: cell; }
  .ink { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; }
  .ink path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .ink path.erasable { cursor: pointer; }
  .ink path.erasable:hover { opacity: 0.45; }

  .item { position: absolute; box-sizing: border-box; user-select: none; transition: box-shadow 0.2s ease, transform 0.2s ease; }
  .live.tool-move .item { cursor: grab; }
  .item.lifted { cursor: grabbing; transform: rotate(-1.2deg) scale(1.02); box-shadow: 0 1.2cqw 2.6cqw -1cqw rgb(0 0 0 / 0.55); }
  .note {
    padding: 0.9cqw 1cqw; border-radius: 0.3cqw; background: var(--ic);
    color: oklch(22% 0.02 286); box-shadow: 0 0.5cqw 1.2cqw -0.6cqw rgb(0 0 0 / 0.5);
  }
  .text { color: var(--ic, var(--text)); padding: 0.3cqw 0.4cqw; }
  .item p, .item textarea {
    margin: 0; font: inherit; font-size: var(--fs); line-height: 1.3; white-space: pre-wrap; overflow-wrap: anywhere;
  }
  .text p { font-weight: 600; }
  .item textarea {
    display: block; width: 100%; min-height: 100%; height: 100%; resize: none; border: 0; outline: none; padding: 0;
    background: none; color: inherit; field-sizing: content;
  }
  .text textarea { font-weight: 600; outline: 1px dashed color-mix(in oklch, var(--ic, var(--text)) 50%, transparent); }
  .pen {
    position: absolute; top: 0.25rem; right: 0.25rem; width: 1.375rem; height: 1.375rem; display: grid; place-items: center;
    padding: 0; border: 0; border-radius: 50%; cursor: pointer; opacity: 0; transition: opacity 0.15s ease;
    background: color-mix(in oklch, white 55%, transparent); color: oklch(25% 0.02 286);
  }
  .item:hover .pen, .pen:focus-visible { opacity: 1; }
  @media (hover: none) { .pen { opacity: 0.8; } }
  .hint { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; padding: 2rem; text-align: center; color: var(--dim); font-size: 0.875rem; pointer-events: none; }
  @media (max-width: 720px), (pointer: coarse) {
    .board { backdrop-filter: none; -webkit-backdrop-filter: none; background-color: color-mix(in oklch, var(--surface) 92%, transparent); }
  }
</style>
