import { describe, expect, it, vi } from 'vitest';
import { backdrop } from '#lib/actions.ts';

/** A backdrop with a window on it, as the dialogs draw them. */
function setUp() {
  const scrim = document.createElement('div');
  const win = document.createElement('div');
  scrim.appendChild(win);
  document.body.appendChild(scrim);
  const onpress = vi.fn();
  const action = backdrop(scrim, onpress);
  /** A press: down on one element, the click landing where both ends meet. */
  const press = (from: Element, clickOn: Element) => {
    from.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    clickOn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  };
  return { scrim, win, onpress, press, done: () => (action.destroy(), scrim.remove()) };
}

describe('backdrop', () => {
  it('closes the window when the backdrop itself is pressed', () => {
    const { scrim, onpress, press, done } = setUp();
    press(scrim, scrim);
    expect(onpress).toHaveBeenCalledOnce();
    done();
  });

  it('stays open when a selection starts in the window and ends past its edge', () => {
    const { scrim, win, onpress, press, done } = setUp();
    // The browser sends that click to the backdrop, the two ends' shared parent.
    press(win, scrim);
    expect(onpress).not.toHaveBeenCalled();
    done();
  });

  it('leaves presses inside the window alone', () => {
    const { win, onpress, press, done } = setUp();
    press(win, win);
    expect(onpress).not.toHaveBeenCalled();
    done();
  });
});
