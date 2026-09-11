import { describe, expect, it } from 'vitest';
import {
  BASE_HEX,
  CAT_COLORS,
  catColorById,
  contrastRatio,
  parseHex,
  relativeLuminance,
} from '@/lib/cat-colors';

describe('CAT_COLORS', () => {
  it('offers the eight the design brief asks for', () => {
    expect(CAT_COLORS).toHaveLength(8);
  });

  it('has unique ids and unique hex values', () => {
    expect(new Set(CAT_COLORS.map((c) => c.id)).size).toBe(8);
    expect(new Set(CAT_COLORS.map((c) => c.hex)).size).toBe(8);
  });

  /**
   * Spec section 10: every accent must pass contrast on the warm neutral base.
   * 4.5:1 is WCAG AA for normal text, which is the strictest way these are
   * used — a cat's name rendered in its own colour.
   */
  it('passes WCAG AA against the base for every colour', () => {
    for (const color of CAT_COLORS) {
      const ratio = contrastRatio(color.hex, BASE_HEX);
      expect(ratio, `${color.id} (${color.hex})`).not.toBeNull();
      expect(ratio ?? 0, `${color.id} (${color.hex})`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('names every colour through a dictionary key, never a literal', () => {
    for (const color of CAT_COLORS) {
      expect(color.nameKey.startsWith('color.')).toBe(true);
    }
  });
});

describe('contrast maths', () => {
  it('parses well-formed hex and rejects the rest', () => {
    expect(parseHex('#ffffff')).toEqual([255, 255, 255]);
    expect(parseHex('#000000')).toEqual([0, 0, 0]);
    expect(parseHex('  #A8452A ')).toEqual([168, 69, 42]);
    expect(parseHex('#fff')).toBeNull();
    expect(parseHex('a8452a')).toBeNull();
    expect(parseHex('')).toBeNull();
  });

  it('puts luminance at the documented extremes', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 6);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 6);
  });

  it('gives 21:1 for black on white and 1:1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#a8452a', '#a8452a')).toBeCloseTo(1, 6);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#156a68', BASE_HEX)).toBeCloseTo(
      contrastRatio(BASE_HEX, '#156a68') ?? 0,
      6,
    );
  });

  it('returns null rather than a wrong number for malformed input', () => {
    expect(contrastRatio('nope', BASE_HEX)).toBeNull();
  });
});

describe('catColorById', () => {
  it('finds a known colour', () => {
    expect(catColorById('plum').hex).toBe('#7b3b62');
  });

  it('falls back rather than returning undefined for a stale id', () => {
    // A colour id could survive in the database after a palette change.
    expect(catColorById('chartreuse').id).toBe(CAT_COLORS[0]?.id);
  });
});
