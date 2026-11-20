/**
 * Waits for things to go quiet: called again and again (each key typed), it
 * runs once, `ms` after the last call, with that call's arguments. `flush()`
 * runs what is waiting now (Enter pressed, the page left); `cancel()` drops it.
 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let waiting: A | null = null;
  const run = () => {
    clearTimeout(timer);
    timer = undefined;
    const args = waiting;
    waiting = null;
    if (args) fn(...args);
  };
  const call = (...args: A) => {
    waiting = args;
    clearTimeout(timer);
    timer = setTimeout(run, ms);
  };
  call.flush = run;
  call.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    waiting = null;
  };
  return call;
}
