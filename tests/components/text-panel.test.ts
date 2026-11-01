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

    it('is told a private writing is private, not shown it as empty', () => {
      mount({ owner: false, value: '', locked: true, label: 'Backstory' });
      expect(screen.getByRole('note').textContent).toMatch(/private/i);
      expect(screen.queryByText('Nothing written yet.')).toBeNull();
      expect(screen.queryByText(/page 1 of/i)).toBeNull();
    });

    it('shows the page controls even for a one-page book, so every writing looks the same', () => {
      mount({ owner: false });
      expect(screen.getByText('Page 1 of 1')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Previous page' })).toHaveProperty('disabled', true);
      expect(screen.getByRole('button', { name: 'Next page' })).toHaveProperty('disabled', true);
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
    it('shows no private switch while reading', () => {
      mount();
      expect(screen.queryByRole('switch')).toBeNull();
    });

    it('has the private switch beside Add page while editing', async () => {
      const { props, container } = mount({ editable: true });
      const priv = screen.getByRole('switch', { name: /private/i });
      expect(container.querySelector('.edits')!.contains(priv)).toBe(true);
      expect(priv.nextElementSibling?.textContent).toMatch(/add page/i);
      expect(priv.getAttribute('aria-checked')).toBe('false');
      expect(screen.queryByText(/reveal on hover/i)).toBeNull();
      await fireEvent.click(priv);
      expect(props.onpublic).toHaveBeenCalledWith(false);
    });

    it('shows a private writing as private and can make it public again', async () => {
      const { props } = mount({ isPublic: false, editable: true });
      const priv = screen.getByRole('switch', { name: /private/i });
      expect(priv.getAttribute('aria-checked')).toBe('true');
      await fireEvent.click(priv);
      expect(props.onpublic).toHaveBeenCalledWith(true);
    });

    it('offers no switch when the database cannot keep private text', () => {
      mount({ isPublic: null, editable: true });
      expect(screen.queryByRole('switch')).toBeNull();
      expect(screen.queryByText(/database update/i)).toBeNull();
    });

    it('adds a page after the current one', async () => {
      const { props } = mount({ editable: true, value: 'A\fB' });
      await fireEvent.click(screen.getByRole('button', { name: 'Add page' }));
      expect(props.onbody).toHaveBeenCalledWith('A\f\fB');
    });

    it('writes into the page being shown', async () => {
      const { props, container } = mount({ editable: true, value: 'A\fB' });
      await fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
      const page = container.querySelector('[contenteditable]') as HTMLElement;
      expect(page.textContent).toBe('B');
      page.innerHTML = '<div>Changed <b>boldly</b></div>';
      await fireEvent.input(page);
      await fireEvent.blur(page);
      expect(props.onbody).toHaveBeenCalledWith('A\fChanged **boldly**');
    });

    it('asks once before removing a page with writing on it', async () => {
      const { props } = mount({ editable: true, value: 'A\fB' });
      const remove = screen.getByRole('button', { name: 'Remove page' });
      await fireEvent.click(remove);
      expect(props.onbody).not.toHaveBeenCalled();
      expect(remove.textContent).toMatch(/remove it\?/i);
      await fireEvent.click(remove);
      expect(props.onbody).toHaveBeenCalledWith('B');
    });

    it('removes a blank page straight away', async () => {
      const { props } = mount({ editable: true, value: '\fB' });
      await fireEvent.click(screen.getByRole('button', { name: 'Remove page' }));
      expect(props.onbody).toHaveBeenCalledWith('B');
    });
  });

  describe('formatting', () => {
    it('shows the marks as formatting when reading, with nothing unsafe', () => {
      const { container } = mount({ owner: false, value: '**Bold** and <script>x</script>' });
      expect(container.querySelector('.rich strong')?.textContent).toBe('Bold');
      expect(container.querySelector('script')).toBeNull();
    });

    it('has a formatting bar beside the page arrows only while editing', () => {
      const { container } = mount({ editable: true });
      const bar = screen.getByRole('toolbar', { name: 'Formatting' });
      const pager = container.querySelector('.pager')!;
      expect(pager.firstElementChild).toBe(bar);
      expect(bar.nextElementSibling?.classList.contains('turns')).toBe(true);
      for (const name of [/bold/i, /italic/i, /underline/i, /strikethrough/i, /heading/i, /bulleted/i, /numbered/i]) {
        expect(screen.getByRole('button', { name })).toBeTruthy();
      }
    });

    it('has no formatting bar while reading', () => {
      mount();
      expect(screen.queryByRole('toolbar')).toBeNull();
    });
  });
});

describe('TextPanel editing again', () => {
  it('fills the page every time edit mode is entered, and never saves a blank over the writing', async () => {
    const onbody = vi.fn();
    const props = { label: 'Notes', value: 'Keep **this**', editable: true, owner: true, isPublic: true, onbody, onpublic: vi.fn() };
    const view = render(TextPanel, { props });
    const page = () => view.container.querySelector('[contenteditable]') as HTMLElement;
    expect(page().textContent).toBe('Keep this');
    await fireEvent.blur(page());
    await view.rerender({ ...props, editable: false });
    await view.rerender({ ...props, editable: true });
    expect(page().textContent).toBe('Keep this');
    await fireEvent.blur(page());
    await view.rerender({ ...props, editable: false });
    await view.rerender({ ...props, editable: true });
    expect(page().textContent).toBe('Keep this');
    await fireEvent.input(page());
    await fireEvent.blur(page());
    expect(onbody).not.toHaveBeenCalledWith('');
  });
});
