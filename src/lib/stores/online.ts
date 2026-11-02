/** Whether the browser thinks it has a connection, kept up to date. */
import { readable } from 'svelte/store';

export const online = readable(typeof navigator === 'undefined' ? true : navigator.onLine !== false, (set) => {
  if (typeof window === 'undefined') return;
  const up = () => set(true);
  const down = () => set(false);
  window.addEventListener('online', up);
  window.addEventListener('offline', down);
  return () => {
    window.removeEventListener('online', up);
    window.removeEventListener('offline', down);
  };
});
