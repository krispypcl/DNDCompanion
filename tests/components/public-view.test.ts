/** A visitor reads a sheet. They cannot rest it, spend from it or undo it. */
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import HitPoints from '$lib/components/HitPoints.svelte';
import RestButtons from '$lib/components/RestButtons.svelte';
import { blankDefinition } from '$lib/sample';
import { emptyState } from '$lib/types';

const def = { ...blankDefinition('Visitor'), combat: { ac: 10, speed: 30, hpMax: 20, hitDice: '3d8' } };
const sheet = readFileSync('src/lib/components/SheetView.svelte', 'utf8');

describe('public view', () => {
  it('has no rest buttons at all', () => {
    const { container } = render(RestButtons, {
      props: { definition: def, state: emptyState(), editable: false, onchange: () => {}, onrest: () => {} }
    });
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('has no damage, heal or rest controls, and no empty bar where they were', () => {
    const { container } = render(HitPoints, {
      props: {
        definition: def,
        state: { ...emptyState(), hpCurrent: 12 },
        editable: false,
        onchange: () => {}
      }
    });
    expect(container.querySelector('.hprow')).toBeNull();
    expect(container.querySelector('.restrow')).toBeNull();
    expect(screen.queryByText('Short Rest')).toBeNull();
  });

  it('still shows a downed character’s death saves, read-only', () => {
    const { container } = render(HitPoints, {
      props: {
        definition: def,
        state: { ...emptyState(), hpCurrent: 0, deathSaves: { successes: 1, failures: 2 } },
        editable: false,
        onchange: () => {}
      }
    });
    const pips = [...container.querySelectorAll<HTMLButtonElement>('.pip')];
    expect(pips).toHaveLength(6);
    expect(pips.every((p) => p.disabled)).toBe(true);
    expect(pips.filter((p) => p.getAttribute('aria-pressed') === 'true')).toHaveLength(3);
  });

  it('keeps the rests for the owner', () => {
    const { container } = render(HitPoints, {
      props: { definition: def, state: { ...emptyState(), hpCurrent: 12 }, editable: true, onchange: () => {} }
    });
    expect(container.querySelector('.hprow')).not.toBeNull();
    expect(container.querySelector('.restrow')).not.toBeNull();
  });

  it('only offers Undo to the owner', () => {
    const undo = sheet.slice(sheet.indexOf('class="undo"') - 120, sheet.indexOf('class="undo"'));
    expect(undo).toMatch(/\{#if isOwner\}/);
  });
});
