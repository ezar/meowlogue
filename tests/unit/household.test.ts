import { describe, expect, it } from 'vitest';
import {
  MAX_NAME_LENGTH,
  buildDefaultLabels,
  identityIsMeaningful,
  nextCatColorId,
  validateCatName,
} from '@/db/household';
import { CAT_COLORS } from '@/lib/cat-colors';
import { DEFAULT_LABEL_KEYS } from '@/db/schema';

describe('validateCatName', () => {
  it('accepts an ordinary name', () => {
    expect(validateCatName('Luna', [])).toBeNull();
  });

  it('rejects blank and whitespace-only names', () => {
    expect(validateCatName('', [])).toBe('empty');
    expect(validateCatName('   ', [])).toBe('empty');
    expect(validateCatName('\n\t', [])).toBe('empty');
  });

  it('accepts exactly the maximum length and rejects one more', () => {
    expect(validateCatName('a'.repeat(MAX_NAME_LENGTH), [])).toBeNull();
    expect(validateCatName('a'.repeat(MAX_NAME_LENGTH + 1), [])).toBe('too-long');
  });

  it('measures length after trimming, so padding is not an error', () => {
    expect(validateCatName(`  ${'a'.repeat(MAX_NAME_LENGTH)}  `, [])).toBeNull();
  });

  it('rejects a duplicate regardless of case or padding', () => {
    // Two cats called Luna and luna would be indistinguishable on a card.
    expect(validateCatName('Luna', ['Luna'])).toBe('duplicate');
    expect(validateCatName('luna', ['Luna'])).toBe('duplicate');
    expect(validateCatName('LUNA', ['  luna '])).toBe('duplicate');
    expect(validateCatName('  Luna  ', ['Luna'])).toBe('duplicate');
  });

  it('allows a different name in a household that already has cats', () => {
    expect(validateCatName('Mia', ['Luna'])).toBeNull();
  });

  it('reports emptiness before duplication', () => {
    expect(validateCatName('', [''])).toBe('empty');
  });
});

describe('nextCatColorId', () => {
  it('starts at the first accent for an empty household', () => {
    expect(nextCatColorId([])).toBe(CAT_COLORS[0]?.id);
  });

  it('skips colours already in use, so two cats never clash by accident', () => {
    const first = CAT_COLORS[0]?.id ?? '';
    expect(nextCatColorId([first])).toBe(CAT_COLORS[1]?.id);
    expect(nextCatColorId([first, CAT_COLORS[1]?.id ?? ''])).toBe(CAT_COLORS[2]?.id);
  });

  it('wraps once the palette is exhausted rather than failing', () => {
    // The palette is a convenience, not a cap on how many cats someone has.
    const all = CAT_COLORS.map((color) => color.id);
    expect(nextCatColorId(all)).toBe(CAT_COLORS[0]?.id);
  });

  it('ignores ids that are not in the palette', () => {
    expect(nextCatColorId(['chartreuse'])).toBe(CAT_COLORS[0]?.id);
  });
});

describe('buildDefaultLabels', () => {
  it('gives a cat the nine defaults from the spec, in order', () => {
    let counter = 0;
    const labels = buildDefaultLabels('cat-1', () => `id-${counter++}`);

    expect(labels).toHaveLength(DEFAULT_LABEL_KEYS.length);
    expect(labels.map((label) => label.name)).toEqual(DEFAULT_LABEL_KEYS);
    expect(labels.map((label) => label.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('marks the defaults as not custom, so they translate', () => {
    const labels = buildDefaultLabels('cat-1', () => 'id');
    expect(labels.every((label) => !label.isCustom)).toBe(true);
  });

  it('ties every label to the cat it was built for', () => {
    const labels = buildDefaultLabels('cat-7', () => 'id');
    expect(labels.every((label) => label.catId === 'cat-7')).toBe(true);
  });

  it('names defaults by dictionary key, never by literal text', () => {
    const labels = buildDefaultLabels('cat-1', () => 'id');
    expect(labels.every((label) => label.name.startsWith('label.'))).toBe(true);
  });
});

describe('identityIsMeaningful', () => {
  it('is off for a household of one', () => {
    // Nobody to confuse them with, so asking "who was that?" is theatre.
    expect(identityIsMeaningful(0)).toBe(false);
    expect(identityIsMeaningful(1)).toBe(false);
  });

  it('is on from two cats up (spec 5.1)', () => {
    expect(identityIsMeaningful(2)).toBe(true);
    expect(identityIsMeaningful(5)).toBe(true);
  });
});
