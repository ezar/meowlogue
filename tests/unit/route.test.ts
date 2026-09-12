import { describe, expect, it } from 'vitest';
import { hashFor, parseHash } from '@/lib/route';

/**
 * Hash routing. The hook itself is exercised end to end; these cover the part
 * that decides where a URL lands, which is the part a stale bookmark hits.
 */

describe('parseHash', () => {
  it('reads the routes the app has', () => {
    expect(parseHash('#/household')).toBe('household');
    expect(parseHash('#/help')).toBe('help');
    expect(parseHash('#/')).toBe('home');
  });

  it('accepts a hash with or without its punctuation', () => {
    expect(parseHash('household')).toBe('household');
    expect(parseHash('#household')).toBe('household');
    expect(parseHash('#/household')).toBe('household');
  });

  it('sends anything unrecognised home rather than nowhere', () => {
    // A hash from an older build, or one typed by hand, should land on a
    // screen instead of rendering blank.
    expect(parseHash('#/timeline')).toBe('home');
    expect(parseHash('#/HOUSEHOLD')).toBe('home');
    expect(parseHash('')).toBe('home');
    expect(parseHash('#')).toBe('home');
  });

  it('round-trips every route through its hash', () => {
    for (const route of ['home', 'household', 'help'] as const) {
      expect(parseHash(hashFor(route))).toBe(route);
    }
  });
});
