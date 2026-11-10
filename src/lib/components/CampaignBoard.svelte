<script lang="ts">
  /**
   * The table's board, like a Jamboard: sticky notes, writing and drawing
   * that everyone in the campaign can add to, move and clear, and that
   * everyone with the page sees change as it happens (campaign_board).
   *
   * A board has pages (database/0009), each an endless sheet: dragged
   * around, zoomed in and out (buttons, Ctrl + scroll, or two fingers), and
   * on its own paper (plain, dots, grid or lines). Opening a page fits the
   * part that has anything on it, with a little room around it. Units are
   * pixels at 100%.
   */
  import { onMount, untrack } from 'svelte';
  import { fade, scale, slide } from 'svelte/transition';
  import { backOut, cubicOut } from 'svelte/easing';
  import { campaignMessage, campaignRepo, type BoardData, type BoardItem } from '$lib/data/campaigns';
  import { isConfigured, supabase } from '$lib/supabase';
  import { prefersReducedMotion } from '$lib/motion';
  import { INKS, PAPERS } from '$lib/palette';
  import InfoTip from './InfoTip.svelte';
  import { get } from 'svelte/store';
  import { isPalm, keepStylus, penOnly, sawPen } from '$lib/pen';
  import { swept } from '$lib/rules/ink';

  let {
    campaignId,
    userId,
    canEdit
  }: { campaignId: string; userId: string | null; canEdit: boolean } = $props();

  type Tool = 'move' | 'pen' | 'note' | 'text' | 'erase';
  type Paper = NonNullable<BoardData['paper']>;
  let tool = $state<Tool>('move');
  let noteColour = $state(PAPERS[0].c);
  let penColour = $state(INKS[0].c);
  let penSize = $state(6);

  let items = $state<BoardItem[]>([]);
  let missing = $state(false);
  let error = $state<string | null>(null);

  // ── Pages ──
  const MAIN = 'main';
  const pageRows = $derived(items.filter((i) => i.kind === 'page'));
  const mainRow = $derived(pageRows.find((p) => p.data.main));
  const pages = $derived([
    { id: MAIN, name: mainRow?.data.name || 'Page 1', paper: (mainRow?.data.paper ?? 'dots') as Paper, row: mainRow },
    ...pageRows
      .filter((p) => !p.data.main)
      .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0) || a.updated_at.localeCompare(b.updated_at))
      .map((p, i) => ({ id: p.id, name: p.data.name || `Page ${i + 2}`, paper: (p.data.paper ?? 'dots') as Paper, row: p as BoardItem | undefined }))
  ]);
  const PAGE_KEY = `dndcompanion:board-page:${untrack(() => campaignId)}`;
  let pageId = $state(MAIN);
  try {
    pageId = localStorage.getItem(PAGE_KEY) || MAIN;
  } catch {
    /* no storage: the first page */
  }
  const page = $derived(pages.find((p) => p.id === pageId) ?? pages[0]);
  $effect(() => {
    // A page someone else removed: back to the first.
    if (!pages.some((p) => p.id === pageId)) pageId = MAIN;
  });
  $effect(() => {
    try {
      localStorage.setItem(PAGE_KEY, pageId);
    } catch {
      /* fine */
    }
  });
  const onPage = (i: BoardItem) => i.kind !== 'page' && (i.data.page ?? MAIN) === page.id;
  const strokes = $derived(items.filter((i) => i.kind === 'stroke' && onPage(i)));
  const cards = $derived(items.filter((i) => (i.kind === 'note' || i.kind === 'text') && onPage(i)).sort((a, b) => (a.data.z ?? 0) - (b.data.z ?? 0)));
  const here = $derived(items.filter(onPage));

  async function load() {
    const rows = await campaignRepo.board(campaignId);
    if (rows === null) {
      missing = true;
      return;
    }
    missing = false;
    // What is still being saved stays, even if this read came back without it.
    items = [...rows, ...items.filter((x) => pendingIds.has(x.id) && !rows.some((r) => r.id === x.id))];
    loaded = true;
  }
  let loaded = $state(false);

  /** Someone else's change, as it happens; our own echoes are already here. */
  function takeRemote(row: BoardItem) {
    const i = items.findIndex((x) => x.id === row.id);
    // Our own new row, still on its way back to us: the save brings it.
    if (i < 0 && row.created_by === userId && pendingIds.size) return;
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

  /**
   * Added at once, saved after: a line stays where it was drawn (no gap while
   * it is saved, no fade in), and a note can be written on straight away. It
   * shows under a stand-in id until the database gives it its own (the app
   * may not choose ids: campaign_board's insert grant leaves id out), and
   * keeps its place in the page (`_key`) when the real id arrives, so a note
   * being written on keeps its cursor. It goes again only if the save fails.
   */
  const pendingIds = new Set<string>();
  const drawnHere = new Set<string>();
  const keyOf = (item: BoardItem) => (item as BoardItem & { _key?: string })._key ?? item.id;
  async function add(kind: BoardItem['kind'], data: BoardData) {
    if (!userId) return null;
    error = null;
    const tmp = `tmp-${crypto.randomUUID()}`;
    pendingIds.add(tmp);
    drawnHere.add(tmp);
    const local = { id: tmp, _key: tmp, campaign_id: campaignId, kind, data, created_by: userId, updated_at: new Date().toISOString() } as BoardItem;
    items = [...items, local];
    try {
      const row = await campaignRepo.addToBoard(campaignId, userId, kind, data);
      pendingIds.delete(tmp);
      drawnHere.add(row.id);
      const i = items.findIndex((x) => x.id === tmp);
      if (i < 0) {
        // Taken away again (an empty note) before it was saved.
        void campaignRepo.removeFromBoard([row.id]).catch(() => {});
        return null;
      }
      const now = items[i];
      const changed = JSON.stringify(now.data) !== JSON.stringify(data);
      // The real row may already be here (a read, or the live feed): keep one.
      items = items.filter((x) => x.id !== row.id);
      const j = items.findIndex((x) => x.id === tmp);
      items[j] = { ...now, id: row.id, updated_at: row.updated_at } as BoardItem;
      if (editingId === tmp) editingId = row.id;
      if (pageId === tmp) pageId = row.id;
      if (dragging?.id === tmp) dragging = { ...dragging, id: row.id };
      // Written on (or moved) while it was being saved: save that too.
      if (changed) void save(row.id);
      return items[j];
    } catch (e) {
      pendingIds.delete(tmp);
      items = items.filter((x) => x.id !== tmp);
      if (pageId === tmp) pageId = MAIN;
      error = campaignMessage(e, 'The board wouldn’t take that! Try again.');
      return null;
    }
  }
  /** What was made on this page appears as it is; what others add fades or pops in. */
  function appear(_node: Element, { id }: { id: string }) {
    return drawnHere.has(id) ? { duration: 0 } : { duration: 160, css: (t: number) => `opacity: ${t}` };
  }
  function popIn(node: Element, { id }: { id: string }) {
    return drawnHere.has(id) ? { duration: 0 } : scale(node, pop());
  }
  function patch(id: string, data: BoardData) {
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) return;
    items[i] = { ...items[i], data, updated_at: new Date().toISOString() };
  }
  async function save(id: string) {
    const item = items.find((x) => x.id === id);
    // Still being saved: the save, when it lands, carries what changed.
    if (!item || pendingIds.has(id)) return;
    try {
      await campaignRepo.updateBoard(id, item.data);
    } catch (e) {
      error = campaignMessage(e, 'That change slipped off the board! Try again.');
    }
  }
  async function remove(ids: string[]) {
    if (!ids.length) return;
    const before = items;
    items = items.filter((x) => !ids.includes(x.id));
    // Stand-ins were never saved: nothing to remove from the database.
    const saved = ids.filter((id) => !id.startsWith('tmp-'));
    if (!saved.length) return;
    try {
      await campaignRepo.removeFromBoard(saved);
    } catch (e) {
      items = before;
      error = campaignMessage(e, 'That one is stuck to the board! Try again.');
    }
  }
  const topZ = () => Math.max(0, ...here.map((i) => i.data.z ?? 0)) + 1;
  const stamp = (data: BoardData): BoardData => (page.id === MAIN ? data : { ...data, page: page.id });

  /** A page's name or paper: the first page gets a row of its own the first time. */
  async function setPage(id: string, change: Partial<BoardData>) {
    const p = pages.find((x) => x.id === id);
    if (!p) return;
    if (p.row) {
      patch(p.row.id, { ...p.row.data, ...change });
      await save(p.row.id);
    } else {
      await add('page', { main: true, name: p.name, paper: p.paper, ...change });
    }
  }
  async function newPage() {
    const order = Math.max(0, ...pageRows.map((p) => p.data.order ?? 0)) + 1;
    const saved = add('page', { name: `Page ${pages.length + 1}`, paper: page.paper, order });
    // It is on the board already (add puts it there before saving): open it now.
    const made = items[items.length - 1];
    if (made?.kind === 'page') pageId = made.id;
    if (!(await saved)) pageId = MAIN;
  }
  let renaming = $state<string | null>(null);
  let deleting = $state<string | null>(null);
  async function deletePage(id: string) {
    deleting = null;
    const row = pages.find((p) => p.id === id)?.row;
    const on = items.filter((i) => i.kind !== 'page' && i.data.page === id).map((i) => i.id);
    pageId = MAIN;
    await remove([...on, ...(row ? [row.id] : [])]);
  }

  // ── The view: where on the endless page, and how near ──
  type View = { x: number; y: number; z: number };
  let view = $state<View>({ x: 0, y: 0, z: 1 });
  const views = new Map<string, View>();
  let vp = $state<HTMLDivElement>();
  let vw = $state(800);
  let vh = $state(500);
  $effect(() => {
    if (!vp) return;
    const ro = new ResizeObserver(() => {
      vw = vp!.clientWidth;
      vh = vp!.clientHeight;
    });
    ro.observe(vp);
    return () => ro.disconnect();
  });
  const MIN_Z = 0.15;
  const MAX_Z = 3;
  const clampZ = (z: number) => Math.min(MAX_Z, Math.max(MIN_Z, z));

  /** The part of the page with anything on it, with room around it. */
  function fit() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const i of here) {
      if (i.kind === 'stroke') {
        const p = i.data.points ?? [];
        const pad = (i.data.size ?? 6) / 2;
        for (let k = 0; k + 1 < p.length; k += 2) {
          minX = Math.min(minX, p[k] - pad); maxX = Math.max(maxX, p[k] + pad);
          minY = Math.min(minY, p[k + 1] - pad); maxY = Math.max(maxY, p[k + 1] + pad);
        }
      } else {
        const x = i.data.x ?? 0, y = i.data.y ?? 0;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + (i.data.w ?? 200)); maxY = Math.max(maxY, y + (i.data.h ?? 100));
      }
    }
    if (!Number.isFinite(minX)) {
      view = { x: 0, y: 0, z: 1 };
      return;
    }
    const pad = 60;
    const bw = maxX - minX + pad * 2;
    const bh = maxY - minY + pad * 2;
    const z = clampZ(Math.min(vw / bw, vh / bh, 1.25));
    view = { x: minX - pad - (vw / z - bw) / 2, y: minY - pad - (vh / z - bh) / 2, z };
  }
  // Each page fits itself the first time it is opened here; after that it
  // stays where it was left.
  let shownPage = '';
  $effect(() => {
    const id = page.id;
    if (!loaded || !vp || id === shownPage) return;
    untrack(() => {
      if (shownPage) views.set(shownPage, view);
      shownPage = id;
      const kept = views.get(id);
      if (kept) view = kept;
      else fit();
    });
  });
  function zoomAt(sx: number, sy: number, factor: number) {
    const z = clampZ(view.z * factor);
    const wx = view.x + sx / view.z;
    const wy = view.y + sy / view.z;
    view = { x: wx - sx / z, y: wy - sy / z, z };
  }
  const zoomBy = (factor: number) => zoomAt(vw / 2, vh / 2, factor);

  /** A point on the page, from a point on the screen. */
  /** A point on the board, to a tenth of a unit (whole units made pen lines
      step when zoomed in). */
  function at(e: { clientX: number; clientY: number }): [number, number] {
    const r = vp!.getBoundingClientRect();
    const k = (n: number) => Math.round(n * 10) / 10;
    return [k(view.x + (e.clientX - r.left) / view.z), k(view.y + (e.clientY - r.top) / view.z)];
  }

  // ── Wheel: Ctrl + scroll zooms; plain scroll moves the page once the board
  // has been pressed (until then it scrolls the site, as everywhere else) ──
  let active = $state(false);
  function wheel(node: HTMLElement) {
    const on = (e: WheelEvent) => {
      const r = node.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0025 * (e.deltaMode === 1 ? 16 : 1)));
      } else if (active) {
        e.preventDefault();
        const k = e.deltaMode === 1 ? 16 : 1;
        view = { ...view, x: view.x + (e.shiftKey ? e.deltaY : e.deltaX) * k / view.z, y: view.y + (e.shiftKey ? 0 : e.deltaY) * k / view.z };
      }
    };
    const outside = (e: PointerEvent) => {
      if (!node.contains(e.target as Node)) active = false;
    };
    node.addEventListener('wheel', on, { passive: false });
    window.addEventListener('pointerdown', outside);
    return { destroy: () => { node.removeEventListener('wheel', on); window.removeEventListener('pointerdown', outside); } };
  }

  // ── Pointers: one draws, drags or pans; two pinch ──
  //
  // With a stylus (an Apple Pencil on an iPad) the hand holding it rests on
  // the glass too, and each touch of the palm arrived as one more pointer:
  // a palm down first started a stroke or moved the board, and the pen then
  // made "two fingers", so it zoomed instead of drawing. Once a pen has been
  // used here, only the pen draws: while it is down, touches are ignored,
  // and a palm's accidental pan is put back when the pen lands. Fingers
  // still pan and pinch while the pen is lifted.
  const penHere = () => get(penOnly);
  /** The toggle shows once this device has a pencil, or chose pencil-only before. */
  let pencilSeen = $state(get(penOnly));
  $effect(() => penOnly.subscribe((on) => { if (on) pencilSeen = true; }));
  let penDown: number | null = null;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: { d: number; mx: number; my: number; view: View } | null = null;
  let panning = $state<{ sx: number; sy: number; view: View } | null>(null);
  let drawing = $state<number[] | null>(null);
  /** The eraser's last point while it is down, and the lines it has gone over so far. */
  let erasing: [number, number] | null = null;
  let sweptIds = $state<Set<string>>(new Set());
  /** Every line between the eraser's last point and this one goes. */
  function sweep(to: [number, number]) {
    const from = erasing ?? to;
    erasing = to;
    const list = strokes.filter((x) => !sweptIds.has(x.id));
    const hits = swept(list.map((x) => ({ p: x.data.points ?? [], w: x.data.size ?? 6 })), from, to, 7 / view.z);
    if (hits.length) sweptIds = new Set([...sweptIds, ...hits.map((i) => list[i].id)]);
  }
  /** Lifting the eraser takes the lines away for good (one save for the whole swipe). */
  function endSweep() {
    erasing = null;
    if (!sweptIds.size) return;
    const ids = [...sweptIds];
    void remove(ids).finally(() => (sweptIds = new Set()));
  }
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  };
  function down(e: PointerEvent) {
    active = true;
    if (e.button > 0) return;
    if (e.pointerType === 'pen') {
      sawPen();
      penDown = e.pointerId;
      // Whatever the palm started is undone: the pen alone carries on.
      if (pointers.size) {
        if (panning) view = panning.view;
        if (pinch) view = pinch.view;
        pointers.clear();
        pinch = null;
        panning = null;
        drawing = null;
      }
    } else if (e.pointerType === 'touch' && ((penHere() && penDown !== null) || (canEdit && tool === 'pen' && isPalm(e)))) {
      // The hand holding the pen, or a palm: not a finger meaning anything.
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    vp?.setPointerCapture(e.pointerId);
    if (pointers.size === 2) {
      // Two fingers: whatever one finger began, they zoom and move instead.
      drawing = null;
      erasing = null;
      sweptIds = new Set();
      panning = null;
      dragging = null;
      pinch = { ...spread(), view };
      return;
    }
    if (pointers.size > 2) return;
    const fingerOnly = penHere() && e.pointerType === 'touch';
    if (canEdit && tool === 'pen' && !fingerOnly) {
      e.preventDefault();
      drawing = at(e);
    } else if (canEdit && (tool === 'note' || tool === 'text')) {
      // The press must not move focus on: the new note's box takes it.
      e.preventDefault();
      const [x, y] = at(e);
      const w = tool === 'note' ? 220 : 320;
      const h = tool === 'note' ? 170 : 60;
      void add(tool, stamp({
        x: x - w / 2, y: y - 20, w, h, text: '',
        color: tool === 'note' ? noteColour : penColour, size: tool === 'note' ? 22 : 34, z: topZ()
      }));
      // On the board at once (saved behind it): write on it straight away.
      const made = items[items.length - 1];
      if (made && made.kind === tool) {
        editingId = made.id;
        tool = 'move';
      }
    } else if (canEdit && tool === 'erase' && !fingerOnly) {
      e.preventDefault();
      erasing = null;
      sweep(at(e));
    } else {
      panning = { sx: e.clientX, sy: e.clientY, view };
    }
  }
  function move(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const now = spread();
      const r = vp!.getBoundingClientRect();
      const z = clampZ(pinch.view.z * (now.d / pinch.d));
      // The point under the fingers' middle stays under it.
      const wx = pinch.view.x + (pinch.mx - r.left) / pinch.view.z;
      const wy = pinch.view.y + (pinch.my - r.top) / pinch.view.z;
      view = { x: wx - (now.mx - r.left) / z, y: wy - (now.my - r.top) / z, z };
      return;
    }
    if (drawing) {
      // A pen reports far more often than the screen redraws; the points in
      // between come grouped with each move, and a quick curve needs them.
      const all = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      const next = [...drawing];
      for (const ev of all.length ? all : [e]) {
        const [x, y] = at(ev);
        const n = next.length;
        if (Math.hypot(x - next[n - 2], y - next[n - 1]) >= 1.5 / view.z) next.push(x, y);
      }
      if (next.length !== drawing.length) drawing = next;
    } else if (erasing) {
      const all = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      for (const ev of all.length ? all : [e]) sweep(at(ev));
    } else if (dragging) {
      moveDrag(e);
    } else if (panning) {
      view = { ...panning.view, x: panning.view.x - (e.clientX - panning.sx) / view.z, y: panning.view.y - (e.clientY - panning.sy) / view.z };
    }
  }
  function up(e: PointerEvent) {
    if (e.pointerId === penDown) penDown = null;
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size > 0) return;
    if (erasing) endSweep();
    panning = null;
    if (drawing) {
      const pts = drawing.length >= 4 ? drawing : [...drawing, drawing[0] + 1, drawing[1] + 1];
      drawing = null;
      void add('stroke', stamp({ points: pts.slice(0, 4000), color: penColour, size: penSize }));
    }
    if (dragging) endDrag();
  }
  function cancel(e: PointerEvent) {
    // Safari sometimes calls off a pencil's stroke part way (it took it for a
    // gesture of its own): what was drawn so far is kept, not lost.
    if (e.pointerId === penDown && drawing && drawing.length >= 4 && pointers.size === 1) {
      penDown = null;
      return up(e);
    }
    if (e.pointerId === penDown) penDown = null;
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    pinch = null;
    panning = null;
    drawing = null;
    if (erasing) endSweep();
    endDrag();
  }

  const pathOf = (p: number[] = []) => {
    if (p.length < 2) return '';
    let d = `M${p[0]} ${p[1]}`;
    // Smoothed through the midpoints, so a quick line is not a zigzag.
    for (let i = 2; i < p.length - 2; i += 2) {
      d += ` Q${p[i]} ${p[i + 1]} ${(p[i] + p[i + 2]) / 2} ${(p[i + 1] + p[i + 3]) / 2}`;
    }
    return d + ` L${p[p.length - 2]} ${p[p.length - 1]}`;
  };

  // ── Moving notes and writing ──
  let dragging = $state<{ id: string; dx: number; dy: number; last: number } | null>(null);
  function startDrag(e: PointerEvent, item: BoardItem) {
    if (!canEdit || tool !== 'move' || editingId === item.id || e.button > 0) return;
    e.stopPropagation();
    e.preventDefault();
    active = true;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    vp?.setPointerCapture(e.pointerId);
    const [x, y] = at(e);
    patch(item.id, { ...item.data, z: topZ() });
    dragging = { id: item.id, dx: x - (item.data.x ?? 0), dy: y - (item.data.y ?? 0), last: 0 };
  }
  function moveDrag(e: PointerEvent) {
    if (!dragging) return;
    const item = items.find((x) => x.id === dragging!.id);
    if (!item) return;
    const [x, y] = at(e);
    patch(item.id, { ...item.data, x: x - dragging.dx, y: y - dragging.dy });
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
  function focusOnMount(node: HTMLTextAreaElement | HTMLInputElement) {
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
  /** The paper moves and grows with the page. */
  const paperStyle = $derived.by(() => {
    const step = 40 * view.z;
    return `--step:${step}px; --px:${-view.x * view.z}px; --py:${-view.y * view.z}px; --dot:${Math.max(0.8, 1.3 * Math.min(1.5, view.z))}px;`;
  });
  const PAPER_NAMES: Record<Paper, string> = { plain: 'Plain', dots: 'Dots', grid: 'Grid', lines: 'Lines' };
</script>

<section class="boardwrap" aria-label="Table board">
  <div class="head">
    <span class="cap">Table board
      <InfoTip label="How the board works">Everyone in the campaign can add to it, and sees changes as they happen: drop sticky notes,
        write, or draw with the tools. Drag the page to look
        around (or scroll, once you have clicked the board); Ctrl + scroll or two fingers zoom. Double-click a page's name to rename it.
        Each page opens fitted to what is on it.</InfoTip>
    </span>
    {#if !missing}
      <!-- The board's pages. -->
      <div class="pages" role="tablist" aria-label="Board pages">
        {#each pages as p (p.id)}
          {#if renaming === p.id}
            <input class="pagename" value={p.name} aria-label="Page name" maxlength="40" use:focusOnMount
                   onkeydown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') renaming = null; }}
                   onblur={(e) => { const v = e.currentTarget.value.trim(); renaming = null; if (v && v !== p.name) void setPage(p.id, { name: v }); }} />
          {:else}
            <button class="pagetab" class:on={p.id === page.id} role="tab" aria-selected={p.id === page.id}
                    title={canEdit ? 'Double-click to rename' : p.name}
                    onclick={() => (pageId = p.id)} ondblclick={() => canEdit && (renaming = p.id)}
                    in:scale={pop()}>{p.name}</button>
          {/if}
        {/each}
        {#if canEdit}
          <button class="pagetab add" aria-label="Add a page" title="Add a page" onclick={newPage}>+</button>
        {/if}
      </div>
    {/if}
  </div>
  {#if canEdit && !missing}
    <div class="tools" role="toolbar" aria-label="Board tools">
      {#each [
        { t: 'move', label: 'Move and write (drag the page to look around)', d: 'M8 3v18l5-6 3.5 7 2.5-1.2-3.5-7H21z' },
        { t: 'pen', label: 'Draw', d: 'M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10zM14 7l3 3' },
        { t: 'note', label: 'Sticky note', d: 'M5 4h14v10l-6 6H5zM13 20v-6h6' },
        { t: 'text', label: 'Writing', d: 'M5 6V4h14v2M12 4v16M9 20h6' },
        { t: 'erase', label: 'Eraser (tap a line, or swipe across lines)', d: 'M8 20h12M5.5 14.5l8-8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L12 18H8z' }
      ] as b (b.t)}
        <button class="tool" class:on={tool === b.t} aria-pressed={tool === b.t} aria-label={b.label} title={b.label}
                onclick={() => (tool = b.t as Tool)}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d={b.d} fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      {/each}
      {#if tool === 'pen' || tool === 'text'}
        <span class="sep" aria-hidden="true"></span>
        <div class="swatches" transition:fade={{ duration: 140 }}>
          {#each INKS as p (p.name)}
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
          {#if pencilSeen}
            <button class="tool penonly" class:on={$penOnly} aria-pressed={$penOnly} transition:fade={{ duration: 140 }}
                    aria-label="Only the pencil draws" title={$penOnly ? 'Only the pencil draws (fingers move the page)' : 'Fingers draw too'}
                    onclick={() => penOnly.update((on) => !on)}>
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M5 19l1.2-4.2L16 5l3 3-9.8 9.8zM14 7l3 3M4 21h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
          {/if}
        {/if}
      {:else if tool === 'note'}
        <span class="sep" aria-hidden="true"></span>
        <div class="swatches" transition:fade={{ duration: 140 }}>
          {#each PAPERS as n (n.name)}
            <button class="sw" style:--sw={n.c} aria-label={n.name} title={n.name} aria-pressed={noteColour === n.c}
                    onclick={() => (noteColour = n.c)}></button>
          {/each}
        </div>
      {/if}
      <span class="grow"></span>
      <select class="paper" aria-label="Paper" value={page.paper} onchange={(e) => setPage(page.id, { paper: e.currentTarget.value as Paper })}>
        {#each Object.entries(PAPER_NAMES) as [v, label] (v)}<option value={v}>{label}</option>{/each}
      </select>
      {#if deleting === page.id}
        <span class="ask" transition:fade={{ duration: 140 }}>Delete “{page.name}” and all on it?
          <button class="danger" onclick={() => deletePage(page.id)}>Delete</button>
          <button onclick={() => (deleting = null)}>Keep</button>
        </span>
      {:else if clearing}
        <span class="ask" transition:fade={{ duration: 140 }}>Clear this page?
          <button class="danger" onclick={() => { clearing = false; void remove(here.map((i) => i.id)); }}>Clear</button>
          <button onclick={() => (clearing = false)}>Keep</button>
        </span>
      {:else}
        {#if here.length}<button class="clear" onclick={() => (clearing = true)}>Clear page</button>{/if}
        {#if page.id !== MAIN}<button class="clear" onclick={() => (deleting = page.id)}>Delete page</button>{/if}
      {/if}
    </div>
  {/if}

  {#if missing}
    <p class="none">The board couldn’t be read just now. It will try again shortly.</p>
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="board tool-{tool} paper-{page.paper}" class:live={canEdit} class:panning={Boolean(panning)} class:active
         bind:this={vp} use:wheel use:keepStylus style={paperStyle}
         onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={cancel}>
      <div class="world" style:transform="scale({view.z}) translate({-view.x}px, {-view.y}px)">
        <svg class="ink" width="1" height="1" aria-hidden="true">
          {#each strokes.filter((x) => !sweptIds.has(x.id)) as s (keyOf(s))}
            <path d={pathOf(s.data.points)} style:stroke={s.data.color} stroke-width={s.data.size ?? 6}
                  class:erasable={canEdit && tool === 'erase'}
                  in:appear={{ id: s.id }} out:fade={{ duration: 160 }} />
          {/each}
          {#if drawing}<path d={pathOf(drawing)} style:stroke={penColour} stroke-width={penSize} />{/if}
        </svg>
        {#each cards as item (keyOf(item))}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="item {item.kind}" class:lifted={dragging?.id === item.id}
               style:left="{item.data.x ?? 0}px" style:top="{item.data.y ?? 0}px"
               style:width="{item.data.w ?? 200}px" style:min-height="{item.data.h ?? 100}px"
               style:--ic={item.data.color} style:font-size="{item.data.size ?? 22}px" style:z-index={item.data.z ?? 0}
               onpointerdown={(e) => {
                 if (tool === 'erase' && canEdit) { e.stopPropagation(); void remove([item.id]); }
                 else startDrag(e, item);
               }}
               ondblclick={() => canEdit && tool === 'move' && (editingId = item.id)}
               in:popIn={{ id: item.id }} out:scale={pop()}>
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
      </div>
      {#if loaded && !here.length}
        <p class="hint" in:fade={{ duration: 200 }}>
          {canEdit ? 'An empty page. Pick a tool above to begin.' : 'Nothing on this page yet.'}
        </p>
      {/if}
      <!-- Zoom, in the corner. -->
      <div class="zoom" role="group" aria-label="Zoom" onpointerdown={(e) => e.stopPropagation()}>
        <button aria-label="Zoom out" title="Zoom out (Ctrl + scroll)" onclick={() => zoomBy(1 / 1.25)} disabled={view.z <= MIN_Z}>−</button>
        <button class="pct" title="Back to 100%" onclick={() => zoomBy(1 / view.z)}>{Math.round(view.z * 100)}%</button>
        <button aria-label="Zoom in" title="Zoom in (Ctrl + scroll)" onclick={() => zoomBy(1.25)} disabled={view.z >= MAX_Z}>+</button>
        <button aria-label="Fit everything on this page" title="Fit everything" onclick={fit}>
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </div>
    </div>
  {/if}
  <!-- Under the board, so a message never moves the board itself. -->
  {#if error}<p class="err" role="alert" transition:slide={unfold()}>{error}</p>{/if}
</section>

<style>
  .boardwrap { margin-top: 2rem; }
  .head { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .cap { font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--label); font-weight: 600; }
  .pages { display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; min-width: 0; }
  .pagetab, .pagename {
    font: inherit; font-size: 0.8125rem; border-radius: 999px; padding: 0.25rem 0.75rem;
    border: 1px solid var(--line); background: var(--raised); color: var(--dim); cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
  }
  .pagetab:hover { border-color: var(--a-edge); color: var(--text); }
  .pagetab.on { border-color: var(--a-edge); background: var(--a-wash); color: var(--a); }
  .pagetab.add { width: 1.875rem; padding: 0.25rem 0; text-align: center; }
  .pagename { width: 9rem; color: var(--text); cursor: text; outline: none; border-color: var(--a-edge); }
  .tools { display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; margin-bottom: 0.625rem; }
  .tool {
    width: 2rem; height: 2rem; display: grid; place-items: center; padding: 0; border-radius: var(--r-sm);
    border: 1px solid var(--line); background: var(--raised); color: var(--text); cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.08s ease;
  }
  .tool:hover { border-color: var(--a-edge); color: var(--a); }
  .tool:active { transform: translateY(1px); }
  .tool.on { border-color: var(--a-edge); color: var(--a); background: var(--a-wash); }
  .sep { width: 1px; height: 1.25rem; background: var(--line); margin: 0 0.25rem; }
  .swatches, .sizes { display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; }
  .sw {
    width: 1.25rem; height: 1.25rem; border-radius: 50%; padding: 0; cursor: pointer; background: var(--sw);
    border: 2px solid var(--surface); box-shadow: 0 0 0 1px var(--line); transition: box-shadow 0.15s ease, transform 0.15s ease;
  }
  .sw[aria-pressed='true'] { box-shadow: 0 0 0 2px var(--a); transform: scale(1.1); }
  .sw:hover { box-shadow: 0 0 0 2px var(--a-edge); transform: scale(1.08); }
  .sw:active { transform: scale(0.96); }
  .size {
    width: 1.75rem; height: 1.75rem; display: grid; place-items: center; padding: 0; cursor: pointer; border-radius: var(--r-sm);
    border: 1px solid transparent; background: none; color: var(--text);
  }
  .size i { display: block; width: var(--d); height: var(--d); border-radius: 50%; background: currentColor; }
  .size[aria-pressed='true'] { border-color: var(--a-edge); background: var(--a-wash); color: var(--a); }
  .size { transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.08s ease; }
  .size:hover { border-color: var(--a-edge); color: var(--a); }
  .size:active { transform: translateY(1px); }
  .grow { flex: 1; }
  .clear, .ask button, .paper {
    font: inherit; font-size: 0.8125rem; cursor: pointer; border-radius: var(--r-sm); padding: 0.3125rem 0.75rem;
    border: 1px solid var(--line); background: var(--raised); color: var(--text);
  }
  .paper { padding: 0.3125rem 0.5rem; }
  .clear, .ask button, .paper, .pagetab {
    transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.08s ease;
  }
  .clear:hover { color: var(--bad); border-color: var(--bad); }
  .paper:hover, .ask button:hover { border-color: var(--a-edge); color: var(--a); }
  .ask .danger:hover { border-color: var(--bad); color: var(--bad); background: color-mix(in oklch, var(--bad) 10%, transparent); }
  .clear:active, .ask button:active, .pagetab:active, .zoom button:active:not(:disabled) { transform: translateY(1px); }
  .tool:focus-visible, .sw:focus-visible, .size:focus-visible, .clear:focus-visible, .ask button:focus-visible,
  .paper:focus-visible, .pagetab:focus-visible, .zoom button:focus-visible, .pen:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
  .ask { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: var(--dim); }
  .ask .danger { border-color: var(--bad); color: var(--bad); background: none; }
  .err { color: var(--bad); font-size: 0.8125rem; margin: 0.5rem 0 0; }
  .none { color: var(--dim); font-size: 0.875rem; }

  /* The window onto the page. Frosted over the banner; the paper is drawn on
     it and moves with the page. */
  .board {
    position: relative; height: min(36rem, 70vh); overflow: hidden; border-radius: var(--r);
    border: 1px solid var(--line-soft); touch-action: none; cursor: grab; user-select: none;
    -webkit-user-select: none; -webkit-touch-callout: none;
    background-color: color-mix(in oklch, var(--surface) 70%, transparent);
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    background-position: var(--px) var(--py); background-size: var(--step) var(--step);
    transition: border-color 0.2s ease;
  }
  .board.active { border-color: var(--a-edge); }
  .board.panning { cursor: grabbing; }
  .paper-dots { background-image: radial-gradient(circle, color-mix(in oklch, var(--text) 18%, transparent) var(--dot), transparent calc(var(--dot) + 0.4px)); }
  .paper-grid {
    background-image:
      linear-gradient(to right, color-mix(in oklch, var(--text) 10%, transparent) 1px, transparent 1px),
      linear-gradient(to bottom, color-mix(in oklch, var(--text) 10%, transparent) 1px, transparent 1px);
  }
  .paper-lines { background-image: linear-gradient(to bottom, color-mix(in oklch, var(--text) 12%, transparent) 1px, transparent 1px); }
  .board.live.tool-pen { cursor: crosshair; }
  .board.live.tool-note, .board.live.tool-text { cursor: copy; }
  .board.live.tool-erase { cursor: cell; }
  .world { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-origin: 0 0; }
  .ink { position: absolute; left: 0; top: 0; overflow: visible; }
  .ink path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .ink path.erasable { cursor: pointer; }
  .ink path.erasable:hover { opacity: 0.45; }

  .item { position: absolute; box-sizing: border-box; user-select: none; transition: box-shadow 0.2s ease, transform 0.2s ease; }
  .live.tool-move .item { cursor: grab; }
  .item.lifted { cursor: grabbing; transform: rotate(-1.2deg) scale(1.02); box-shadow: 0 18px 40px -16px rgb(0 0 0 / 0.55); }
  .note {
    padding: 14px 16px; border-radius: 5px; background: var(--ic);
    color: oklch(22% 0.02 286); box-shadow: 0 8px 20px -10px rgb(0 0 0 / 0.5);
  }
  .text { color: var(--ic, var(--text)); padding: 5px 6px; }
  .item p, .item textarea {
    margin: 0; font: inherit; line-height: 1.3; white-space: pre-wrap; overflow-wrap: anywhere;
  }
  .text p { font-weight: 600; }
  .item textarea {
    display: block; width: 100%; min-height: 100%; height: 100%; resize: none; border: 0; outline: none; padding: 0;
    background: none; color: inherit; field-sizing: content;
  }
  .text textarea { font-weight: 600; outline: 1px dashed color-mix(in oklch, var(--ic, var(--text)) 50%, transparent); }
  .pen {
    position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; display: grid; place-items: center;
    padding: 0; border: 0; border-radius: 50%; cursor: pointer; opacity: 0; transition: opacity 0.15s ease;
    background: color-mix(in oklch, white 55%, transparent); color: oklch(25% 0.02 286);
  }
  .item:hover .pen, .pen:focus-visible { opacity: 1; }
  @media (hover: none) { .pen { opacity: 0.8; } }
  .hint { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; padding: 2rem; text-align: center; color: var(--dim); font-size: 0.875rem; pointer-events: none; }
  .zoom {
    position: absolute; right: 0.5rem; bottom: 0.5rem; display: flex; align-items: center; gap: 1px; padding: 2px;
    border-radius: var(--r-sm); border: 1px solid var(--line); background: color-mix(in oklch, var(--surface) 88%, transparent);
    cursor: default; z-index: 1;
  }
  .zoom button {
    min-width: 1.75rem; height: 1.75rem; display: grid; place-items: center; padding: 0 0.25rem; border: 0; border-radius: 4px;
    background: none; color: var(--text); font: inherit; font-size: 0.9375rem; cursor: pointer;
  }
  .zoom button:hover:not(:disabled) { background: var(--a-wash); color: var(--a); }
  .zoom button:disabled { opacity: 0.35; cursor: default; }
  .zoom .pct { font-size: 0.75rem; min-width: 2.75rem; font-variant-numeric: tabular-nums; color: var(--dim); }
  @media (max-width: 720px), (pointer: coarse) {
    .board {
      height: min(28rem, 65vh);
      backdrop-filter: none; -webkit-backdrop-filter: none; background-color: color-mix(in oklch, var(--surface) 92%, transparent);
    }
  }
</style>
