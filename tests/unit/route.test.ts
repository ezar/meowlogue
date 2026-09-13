import { describe, expect, it } from 'vitest';
import { hashFor, parseHash, sameRoute, type Route } from '@/lib/route';

/**
 * Hash routing. The hook itself is exercised end to end; these cover the part
 * that decides where a URL lands, which is the part a stale bookmark hits.
 */

describe('parseHash', () => {
  it('reads the routes the app has', () => {
    expect(parseHash('#/household')).toEqual({ kind: 'household' });
    expect(parseHash('#/timeline')).toEqual({ kind: 'timeline' });
    expect(parseHash('#/help')).toEqual({ kind: 'help' });
    expect(parseHash('#/')).toEqual({ kind: 'home' });
  });

  it('accepts a hash with or without its punctuation', () => {
    expect(parseHash('household')).toEqual({ kind: 'household' });
    expect(parseHash('#household')).toEqual({ kind: 'household' });
    expect(parseHash('#/household')).toEqual({ kind: 'household' });
  });

  it('carries an event id', () => {
    expect(parseHash('#/event/evt-1')).toEqual({ kind: 'event', id: 'evt-1' });
    // Ids are generated, but a URL is typed by anyone: a percent-encoded id
    // comes back as itself rather than as an extra path segment.
    expect(parseHash('#/event/a%2Fb')).toEqual({ kind: 'event', id: 'a/b' });
  });

  it('sends anything unrecognised home rather than nowhere', () => {
    // A hash from an older build, or one typed by hand, should land on a
    // screen instead of rendering blank.
    expect(parseHash('#/event/')).toEqual({ kind: 'home' });
    expect(parseHash('#/insights')).toEqual({ kind: 'home' });
    expect(parseHash('#/HOUSEHOLD')).toEqual({ kind: 'home' });
    expect(parseHash('')).toEqual({ kind: 'home' });
    expect(parseHash('#')).toEqual({ kind: 'home' });
  });

  it('round-trips every route through its hash', () => {
    const routes: readonly Route[] = [
      { kind: 'home' },
      { kind: 'timeline' },
      { kind: 'household' },
      { kind: 'help' },
      { kind: 'debug' },
      { kind: 'event', id: 'evt-1' },
      { kind: 'event', id: 'a/b c' },
    ];
    for (const route of routes) expect(parseHash(hashFor(route))).toEqual(route);
  });
});

describe('sameRoute', () => {
  it('tells two events apart', () => {
    expect(sameRoute({ kind: 'event', id: 'a' }, { kind: 'event', id: 'a' })).toBe(true);
    expect(sameRoute({ kind: 'event', id: 'a' }, { kind: 'event', id: 'b' })).toBe(false);
    expect(sameRoute({ kind: 'home' }, { kind: 'timeline' })).toBe(false);
  });
});
