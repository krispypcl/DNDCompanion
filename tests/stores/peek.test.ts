import { afterEach, describe, expect, it, vi } from 'vitest';
import { peek } from '#lib/stores/peek.svelte.ts';

const fireball = { name: 'Fireball', url: 'https://5e.tools/spells.html#fireball_xphb', anchor: new DOMRect() };
const shield = { name: 'Shield', url: 'https://5e.tools/spells.html#shield_xphb', anchor: new DOMRect() };

afterEach(() => {
  peek.close();
  peek.kept = [];
});

describe('peek windows', () => {
  it('opens each entry from the search in a window of its own, each a step along', () => {
    peek.open(fireball);
    peek.open(shield);
    expect(peek.kept.map((k) => k.target.name)).toEqual(['Fireball', 'Shield']);
    expect(peek.kept[1].top - peek.kept[0].top).toBe(28);
  });

  it('moves the window already open for an entry instead of opening a second one', () => {
    peek.open(fireball);
    peek.open(shield);
    const first = peek.kept[0];
    peek.open(fireball);
    expect(peek.kept).toHaveLength(2);
    const again = peek.kept.at(-1)!;
    expect(again.id).toBe(first.id); // the same window, so it glides rather than reopening
    expect(again.moves).toBe(1);
    expect(again.target.name).toBe('Fireball'); // and it comes to the front
  });

  it('keeps a hover peek open, and other names shut, while the pointer heads for it', () => {
    vi.useFakeTimers();
    peek.box = () => new DOMRect(300, 100, 400, 300);
    peek.show(fireball);
    peek.hoverOut({ x: 100, y: 200 });
    // On the way to the window: a name crossed there doesn't open, and the window stays.
    peek.hoverIn(() => shield, { x: 180, y: 200 });
    for (let x = 180; x < 300; x += 20) {
      vi.advanceTimersByTime(150);
      peek.moved({ x, y: 200 });
    }
    expect(peek.target?.name).toBe('Fireball');
    // Heading elsewhere lets it close.
    peek.moved({ x: 120, y: 40 });
    vi.advanceTimersByTime(400);
    expect(peek.target).toBeNull();
    vi.useRealTimers();
    peek.box = () => null;
  });

  it('moves the kept window to where a peek of the same entry was dragged', () => {
    peek.open(fireball);
    const first = peek.kept[0];
    peek.show(fireball, { tapped: true });
    peek.keep(new DOMRect(40, 50, 380, 300));
    expect(peek.kept).toHaveLength(1);
    expect(peek.kept[0]).toMatchObject({ id: first.id, left: 40, top: 50, width: 380, moves: 1 });
    expect(peek.target).toBeNull();
  });
});
