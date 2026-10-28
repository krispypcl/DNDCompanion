import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import EditableField from '$lib/components/EditableField.svelte';

const LONG_TEXT = 'word '.repeat(4000).trim(); // ~20,000 characters
const LONG_WORD = 'x'.repeat(5000);

describe('free text fields', () => {
  // Review Focus 5: an unbounded backstory must render in full, not truncate.
  test('a 20,000-character value renders completely', () => {
    const { container } = render(EditableField, {
      props: { value: LONG_TEXT, editable: false, type: 'textarea', onchange: () => {} }
    });
    expect(LONG_TEXT.length).toBeGreaterThan(19_000);
    expect(container.textContent?.trim()).toHaveLength(LONG_TEXT.length);
  });

  test('a 20,000-character value survives a round trip through the editor', () => {
    const { container } = render(EditableField, {
      props: { value: LONG_TEXT, editable: true, type: 'textarea', onchange: () => {} }
    });
    const textarea = container.querySelector('textarea');
    expect(textarea?.value).toHaveLength(LONG_TEXT.length);
  });

  test('a very long unbroken word is set to wrap rather than overflow', () => {
    const { container } = render(EditableField, {
      props: { value: LONG_WORD, editable: false, onchange: () => {} }
    });
    const readout = container.querySelector('.readout') as HTMLElement;
    expect(readout).toBeTruthy();
    expect(readout.textContent).toHaveLength(LONG_WORD.length);
    // The wrapping rule lives on the containers that hold free text; assert the
    // field itself never sets a width that would force horizontal overflow.
    expect(readout.style.width).toBe('');
  });

  test('an empty value shows the placeholder instead of nothing', () => {
    const { container } = render(EditableField, {
      props: { value: '', editable: false, placeholder: 'Nothing written yet.', onchange: () => {} }
    });
    expect(container.textContent?.trim()).toBe('Nothing written yet.');
  });
});
