import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import ThemePicker from '$lib/components/ThemePicker.svelte';

describe('ThemePicker', () => {
  it('keeps a hex typed into the box, with or without the #', async () => {
    const onchange = vi.fn();
    render(ThemePicker, { props: { value: 'slate', onchange } });
    const box = screen.getByLabelText('Accent colour as hex');
    await fireEvent.input(box, { target: { value: '3A7BD5' } });
    await fireEvent.keyDown(box, { key: 'Enter' });
    expect(onchange).toHaveBeenCalledWith('#3a7bd5');
  });

  it('says so when the hex is not a colour, and keeps nothing', async () => {
    const onchange = vi.fn();
    render(ThemePicker, { props: { value: 'slate', onchange } });
    const box = screen.getByLabelText('Accent colour as hex');
    await fireEvent.input(box, { target: { value: '#12zz' } });
    await fireEvent.blur(box);
    expect(screen.getByRole('alert').textContent).toMatch(/not a colour/);
    expect(onchange).not.toHaveBeenCalled();
  });

  it('only previews while the colour input is dragged, and keeps it when it settles', async () => {
    const onchange = vi.fn();
    const onpreview = vi.fn();
    render(ThemePicker, { props: { value: 'slate', onchange, onpreview } });
    const input = screen.getByLabelText('Pick your own accent colour');
    await fireEvent.input(input, { target: { value: '#aa3355' } });
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(onpreview).toHaveBeenCalledWith('#aa3355');
    expect(onchange).not.toHaveBeenCalled();
    await fireEvent.change(input, { target: { value: '#aa3355' } });
    expect(onchange).toHaveBeenCalledWith('#aa3355');
    expect(onpreview).toHaveBeenLastCalledWith(null);
  });
});
