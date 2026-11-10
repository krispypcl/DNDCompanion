/**
 * A box that changes what it holds (buttons swapped for a field, a line for
 * a form) without the page jumping: its height eases from what it was to
 * what the new contents need, and the contents cross-fade in one place.
 *
 * Put `use:smoothHeight` on the box and its contents inside one child with
 * class `swap`; the swapped parts are direct children of `.swap` (they sit
 * on top of each other while one fades out and the other in). See app.css.
 */
export function smoothHeight(node: HTMLElement) {
  const inner = node.firstElementChild as HTMLElement | null;
  if (!inner) return {};
  let height = inner.offsetHeight;
  node.style.height = `${height}px`;
  const ro = new ResizeObserver(() => {
    const next = inner.offsetHeight;
    if (next === height) return;
    height = next;
    node.style.height = `${next}px`;
  });
  ro.observe(inner);
  return {
    destroy() {
      ro.disconnect();
    }
  };
}
