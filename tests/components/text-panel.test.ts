/** Notes and backstory: who may read them, and their pages. */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import TextPanel from '$lib/components/TextPanel.svelte';

const mount = (over: Record<string, unknown> = {}) => {
  const props = {
    label: 'Backstory', value: 'The long story', editable: false, owner: true,
    isPublic: true, onbody: vi.fn(), onpublic: vi.fn(), ...over
  };
  const view = render(TextPanel, { props });
  return { props, ...view };
};

describe('TextPanel', () => {
  describe('for a visitor', () => {
    it('shows the text and none of the controls', () => {
      mount({ owner: false });
      expect(screen.getByText('The long story')).toBeTruthy();
      expect(screen.queryByRole('switch')).toBeNull();
    });

    it('shows a private writing as unwritten: the database sends nothing, so there is nothing', () => {
      mount({ owner: false, value: '' });
      expect(screen.getByText('Nothing written yet.')).toBeTruthy();
    });

    it('has no page controls for a one-page book', () => {
      mount({ owner: false });
      expect(screen.queryByText(/page 1 of/i)).toBeNull();
    });

    it('can turn the pages of a longer one', async () => {
      mount({ owner: false, value: 'First\fSecond' });
      expect(screen.getByText('Page 1 of 2')).toBeTruthy();
      expect(screen.getByText('First')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Previous page' })).toHaveProperty('disabled', true);
      await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
      expect(screen.getByText('Second')).toBeTruthy();
      expect(screen.getByText('Page 2 of 2')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Next page' })).toHaveProperty('disabled', true);
    });
  });

  describe('for the owner', () => {
    it('has one switch, private, and nothing else', async () => {
      const { props } = mount();
      const priv = screen.getByRole('switch', { name: /private/i });
      expect(priv.getAttribute('aria-checked')).toBe('false');
      expect(screen.queryByText(/reveal on hover/i)).toBeNull();
      await fireEvent.click(priv);
      expect(props.onpublic).toHaveBeenCalledWith(false);
    });

    it('shows a private writing as private and can make it public again', async () => {
      const { props } = mount({ isPublic: false });
      const priv = screen.getByRole('switch', { name: /private/i });
      expect(priv.getAttribute('aria-checked')).toBe('true');
      await fireEvent.click(priv);
      expect(props.onpublic).toHaveBeenCalledWith(true);
    });

    it('offers no private switch when the database cannot keep one', () => {
      mount({ isPublic: null });
      expect(screen.queryByRole('switch')).toBeNull();
    });

    it('adds a page after the current one', async () => {
      const { props } = mount({ editable: true, value: 'A\fB' });
      await fireEvent.click(screen.getByRole('button', { name: 'Add page' }));
      expect(props.onbody).toHaveBeenCalledWith('A\f\fB');
    });

    it('writes into the page being shown', async () => {
      const { props, container } = mount({ editable: true, value: 'A\fB' });
      await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
      const area = container.querySelector('textarea')!;
      area.value = 'Changed';
      await fireEvent.change(area);
      expect(props.onbody).toHaveBeenCalledWith('A\fChanged');
    });

    it('asks once before removing a page with writing on it', async () => {
      const { props } = mount({ editable: true, value: 'A\fB' });
      const remove = screen.getByRole('button', { name: 'Remove page' });
      await fireEvent.click(remove);
      expect(props.onbody).not.toHaveBeenCalled();
      expect(remove.textContent).toMatch(/remove this page\?/i);
      await fireEvent.click(remove);
      expect(props.onbody).toHaveBeenCalledWith('B');
    });

    it('removes a blank page straight away', async () => {
      const { props } = mount({ editable: true, value: '\fB' });
      await fireEvent.click(screen.getByRole('button', { name: 'Remove page' }));
      expect(props.onbody).toHaveBeenCalledWith('B');
    });
  });
});
