/** Notes and backstory: who may read them, and whether the screen shows them. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import TextPanel from '$lib/components/TextPanel.svelte';

const mount = (over: Record<string, unknown> = {}) => {
  const props = {
    label: 'Backstory', value: 'The long story', editable: false, owner: true,
    isPublic: true, hover: false, onbody: vi.fn(), onpublic: vi.fn(), onhover: vi.fn(), ...over
  };
  const view = render(TextPanel, { props });
  return { props, ...view };
};

describe('TextPanel', () => {
  describe('for a visitor', () => {
    it('shows the text and none of the controls', () => {
      mount({ owner: false });
      expect(screen.getByText('The long story')).toBeTruthy();
      expect(screen.queryByRole('group', { name: /options/i })).toBeNull();
      expect(screen.queryByText('Private')).toBeNull();
    });

    it('shows a private writing as unwritten: the database sends nothing, so there is nothing', () => {
      mount({ owner: false, value: '', isPublic: true });
      expect(screen.getByText('Nothing written yet.')).toBeTruthy();
    });
  });

  describe('for the owner', () => {
    it('can make it private, and says who can read it', async () => {
      const { props } = mount();
      const priv = screen.getByRole('button', { name: /private/i });
      expect(priv.getAttribute('aria-pressed')).toBe('false');
      expect(screen.getByRole('status').textContent).toMatch(/anyone with the link/i);
      await fireEvent.click(priv);
      expect(props.onpublic).toHaveBeenCalledWith(false);
    });

    it('shows a private writing as private and can make it public again', async () => {
      const { props } = mount({ isPublic: false });
      const priv = screen.getByRole('button', { name: /private/i });
      expect(priv.getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('status').textContent).toMatch(/only you/i);
      await fireEvent.click(priv);
      expect(props.onpublic).toHaveBeenCalledWith(true);
    });

    it('offers no private switch when the database cannot keep one', () => {
      mount({ isPublic: null });
      expect(screen.queryByRole('button', { name: /private/i })).toBeNull();
      expect(screen.getByRole('button', { name: /reveal on hover/i })).toBeTruthy();
    });

    it('can turn reveal-on-hover on', async () => {
      const { props } = mount();
      await fireEvent.click(screen.getByRole('button', { name: /reveal on hover/i }));
      expect(props.onhover).toHaveBeenCalledWith(true);
    });

    it('has both switches in edit mode as well, so nothing moves when editing starts', () => {
      const { container } = mount({ editable: true });
      expect(container.querySelectorAll('.opt')).toHaveLength(2);
      expect(container.querySelector('textarea')).not.toBeNull();
    });
  });

  describe('reveal on hover', () => {
    it('veils the text, and lets a tap hold it open', async () => {
      const { container } = mount({ hover: true, owner: false });
      const reveal = container.querySelector('.reveal') as HTMLElement;
      expect(reveal.classList.contains('veiled')).toBe(true);
      await fireEvent.click(reveal);
      expect(reveal.classList.contains('veiled')).toBe(false);
      await fireEvent.click(reveal);
      expect(reveal.classList.contains('veiled')).toBe(true);
    });

    it('can be opened from the keyboard', async () => {
      const { container } = mount({ hover: true, owner: false });
      const reveal = container.querySelector('.reveal') as HTMLElement;
      expect(reveal.tabIndex).toBe(0);
      await fireEvent.keyDown(reveal, { key: 'Enter' });
      expect(reveal.getAttribute('aria-pressed')).toBe('true');
      await fireEvent.keyDown(reveal, { key: 'Escape' });
      expect(reveal.getAttribute('aria-pressed')).toBe('false');
    });

    it('never veils the editor: you cannot write what you cannot see', () => {
      const { container } = mount({ hover: true, editable: true });
      expect(container.querySelector('.reveal')).toBeNull();
      expect(container.querySelector('textarea')).not.toBeNull();
    });

    it('is not there at all when off', () => {
      const { container } = mount({ hover: false });
      expect(container.querySelector('.reveal')).toBeNull();
    });
  });
});
