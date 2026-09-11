/**
 * The cat accent palette.
 *
 * Spec section 10 asks for eight colours a cat can be given at setup, all of
 * which must pass contrast on the warm neutral base. Each cat carries its
 * colour through the whole app — timeline, insights, vocabulary card — so the
 * set has to stay distinguishable at a glance and never rely on colour alone
 * (every use is paired with the cat's name).
 */

/** One choosable accent. */
export interface CatColor {
  /** Stable id persisted with the cat; never shown to the user. */
  readonly id: string;
  /** Hex value used for swatches, charts and the vocabulary card. */
  readonly hex: string;
  /** Key into the i18n dictionaries for this colour's name. */
  readonly nameKey: string;
}

/** The warm neutral base the palette is judged against (spec section 10). */
export const BASE_HEX = '#faf7f2';

/**
 * Eight accents, chosen to stay apart for the common forms of colour vision
 * deficiency: the set spans warm and cool rather than relying on a red/green
 * split, and no two neighbours share both hue family and lightness.
 */
export const CAT_COLORS: readonly CatColor[] = [
  // Darkened from a brighter amber: at #b4740e it measured 3.61:1 on the
  // base, below AA. Yellow-oranges are the hard case for contrast, and the
  // test in tests/unit/cat-colors.test.ts is what caught it.
  { id: 'honey', hex: '#96600b', nameKey: 'color.honey' },
  { id: 'rust', hex: '#a8452a', nameKey: 'color.rust' },
  { id: 'plum', hex: '#7b3b62', nameKey: 'color.plum' },
  { id: 'indigo', hex: '#3f4a8f', nameKey: 'color.indigo' },
  { id: 'teal', hex: '#156a68', nameKey: 'color.teal' },
  { id: 'moss', hex: '#4a6b23', nameKey: 'color.moss' },
  { id: 'slate', hex: '#4a5560', nameKey: 'color.slate' },
  { id: 'cocoa', hex: '#6b4636', nameKey: 'color.cocoa' },
];

/** The colour a new cat gets when the user does not pick one. */
export const DEFAULT_CAT_COLOR_ID = CAT_COLORS[0]?.id ?? 'honey';

/**
 * Parses a `#rrggbb` string into channel values.
 *
 * @returns Channels in the range 0..255, or null when the input is malformed.
 */
export function parseHex(hex: string): readonly [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (match === null) return null;
  const value = Number.parseInt(match[1] ?? '', 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/**
 * Relative luminance per WCAG 2.
 *
 * @param hex Colour as `#rrggbb`.
 * @returns Luminance in the range 0..1, or null when the input is malformed.
 */
export function relativeLuminance(hex: string): number | null {
  const channels = parseHex(hex);
  if (channels === null) return null;
  const linear = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = linear as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2 contrast ratio between two colours.
 *
 * @returns A ratio from 1 (identical) to 21 (black on white), or null when
 *   either input is malformed.
 */
export function contrastRatio(foreground: string, background: string): number | null {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  if (a === null || b === null) return null;
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Looks a colour up by id, falling back to the default. */
export function catColorById(id: string): CatColor {
  return CAT_COLORS.find((color) => color.id === id) ?? (CAT_COLORS[0] as CatColor);
}
