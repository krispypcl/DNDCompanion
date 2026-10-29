/**
 * The phone layout. jsdom does no layout, so the measurements that matter —
 * nothing wider than the viewport, nothing smaller than a fingertip — are
 * checked by driving the built app. These guard the pieces that make those
 * measurements possible, which is what would quietly go missing in an edit.
 */
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import EntryTable from '$lib/components/EntryTable.svelte';

const columns = [
  { key: 'name', label: 'Name', width: '60%' },
  { key: 'notes', label: 'Notes', width: '40%', muted: true }
];

const props = (editable: boolean) => ({
  items: [{ name: 'Revolver', notes: 'Slow mastery' }],
  columns,
  editable,
  category: 'items' as const,
  emptyText: 'Nothing here.',
  addLabel: 'Add',
  blank: () => ({ name: '' }),
  onchange: () => {}
});

const source = (f: string) => readFileSync(f, 'utf8');
const phoneBlock = (css: string) => {
  const at = css.indexOf('@media (max-width: 700px)');
  return at === -1 ? '' : css.slice(at);
};

describe('phone layout', () => {
  it('labels every cell, so a stacked row still says what each field is', () => {
    render(EntryTable, { props: props(true) });
    const cells = [...document.querySelectorAll('td:not(.rm)')];
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expect(cell.getAttribute('data-label')).toBeTruthy();
    expect(cells.map((c) => c.getAttribute('data-label'))).toEqual(['Name', 'Notes']);
  });

  it('drops the table layout while editing on a phone', () => {
    // A 34rem table in a 390px viewport is what made the browser shrink the
    // whole page to fit, which is the "everything zoomed out" bug.
    const phone = phoneBlock(source('src/lib/components/EntryTable.svelte'));
    expect(phone).toMatch(/table\.editing[\s\S]*display: block/);
    expect(phone).toMatch(/min-width: 0/);
    expect(phone).toMatch(/content: attr\(data-label\)/);
  });

  it('keeps every field at 16px or more, so no browser zooms on focus', () => {
    const files = [
      'src/lib/components/EditableField.svelte',
      'src/lib/components/EntryTable.svelte',
      'src/lib/components/Currency.svelte',
      'src/lib/components/AbilityBand.svelte'
    ];
    for (const f of files) {
      const phone = phoneBlock(source(f));
      expect(phone, f).toMatch(/font-size: (max\(1em, 16px\)|16px|1rem)/);
    }
  });

  it('gives the skill dot a hit area a finger can find', () => {
    const phone = phoneBlock(source('src/lib/components/SkillRail.svelte'));
    expect(phone).toMatch(/\.dot:not\(:disabled\)::after/);
    expect(phone).toMatch(/inset: -/);
  });
});

describe('splash', () => {
  it('is skipped for someone who is already signed in', () => {
    const shell = source('src/app.html');
    expect(shell).toMatch(/html\[data-known-user\] #splash \{ display: none; \}/);
    expect(shell).toMatch(/sb-\.\*-auth-token/);
    // The decision has to be made before the body paints.
    expect(shell.indexOf('data-known-user')).toBeLessThan(shell.indexOf('<body'));
  });

  it('shows the mark in white', () => {
    expect(source('src/app.html')).toMatch(/#splash svg \{ color: oklch\(99/);
  });
});

describe('the mark', () => {
  it('is the favicon as well', () => {
    const icon = source('static/favicon.svg');
    expect(icon).toMatch(/polygon/);
    expect(icon).toMatch(/#ffffff/);
  });

  it('sits above the title on the sign-in screen', () => {
    const form = source('src/lib/components/AuthForm.svelte');
    const brand = form.slice(form.indexOf('<div class="brand">'), form.indexOf('</div>', form.indexOf('<div class="brand">')));
    expect(brand.indexOf('<svg')).toBeLessThan(brand.indexOf('<p>'));
  });
});
