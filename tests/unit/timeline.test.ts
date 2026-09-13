import { describe, expect, it } from 'vitest';
import { toStoredEvent } from '@/db/events';
import type { StoredEvent } from '@/db/schema';
import {
  NO_FILTERS,
  dayKey,
  filterEvents,
  groupByDay,
  hasFilters,
  matchesFilters,
  typesPresent,
} from '@/lib/timeline';
import { makeMeowEvent } from './fixtures/events';

/**
 * The timeline (spec 5.1): what it shows, and which day it files it under.
 */

/** A stored event at a given local time, with overrides. */
function at(
  isoLocal: string,
  overrides: Partial<StoredEvent> = {},
  id = `evt-${isoLocal}`,
): StoredEvent {
  return {
    ...toStoredEvent(makeMeowEvent()),
    id,
    // Parsed as local time: no trailing Z, so the runtime's own zone applies,
    // which is what the timeline groups by.
    startedAt: new Date(isoLocal).getTime(),
    ...overrides,
  };
}

describe('dayKey', () => {
  it('files an event under its local day, not its UTC one', () => {
    // The case that matters: a call just after midnight. Under UTC in any
    // zone east of Greenwich this lands on the previous day, and spec 6.6's
    // night-calling counts are exactly the ones that straddle midnight.
    const justAfterMidnight = new Date(2026, 8, 13, 0, 30).getTime();
    const justBefore = new Date(2026, 8, 12, 23, 30).getTime();

    expect(dayKey(justAfterMidnight)).toBe('2026-09-13');
    expect(dayKey(justBefore)).toBe('2026-09-12');
  });

  it('pads months and days so the keys sort as text', () => {
    expect(dayKey(new Date(2026, 0, 5, 12).getTime())).toBe('2026-01-05');
  });
});

describe('matchesFilters', () => {
  const base = at('2026-09-12T10:00', { catId: 'luna', labelId: 'food', confirmedAt: 1 });

  it('passes everything when nothing is filtered', () => {
    expect(matchesFilters(base, NO_FILTERS)).toBe(true);
    expect(hasFilters(NO_FILTERS)).toBe(false);
  });

  it('filters by cat, type, context and day', () => {
    expect(matchesFilters(base, { ...NO_FILTERS, catId: 'luna' })).toBe(true);
    expect(matchesFilters(base, { ...NO_FILTERS, catId: 'mia' })).toBe(false);
    expect(matchesFilters(base, { ...NO_FILTERS, type: 'meow' })).toBe(true);
    expect(matchesFilters(base, { ...NO_FILTERS, type: 'purr' })).toBe(false);
    expect(matchesFilters(base, { ...NO_FILTERS, labelId: 'food' })).toBe(true);
    expect(matchesFilters(base, { ...NO_FILTERS, labelId: 'door' })).toBe(false);
    expect(matchesFilters(base, { ...NO_FILTERS, day: '2026-09-12' })).toBe(true);
    expect(matchesFilters(base, { ...NO_FILTERS, day: '2026-09-11' })).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, catId: 'luna' })).toBe(true);
  });

  it('separates confirmed, unconfirmed and "not a cat"', () => {
    const unconfirmed = at('2026-09-12T11:00');
    const notACat = at('2026-09-12T12:00', { notACat: true });

    expect(matchesFilters(base, { ...NO_FILTERS, state: 'confirmed' })).toBe(true);
    expect(matchesFilters(unconfirmed, { ...NO_FILTERS, state: 'unconfirmed' })).toBe(true);
    expect(matchesFilters(notACat, { ...NO_FILTERS, state: 'not-a-cat' })).toBe(true);

    // The one that is easy to get wrong: a false positive has been answered,
    // so it must not sit in the list of things still to answer.
    expect(matchesFilters(notACat, { ...NO_FILTERS, state: 'unconfirmed' })).toBe(false);
    expect(matchesFilters(notACat, { ...NO_FILTERS, state: 'confirmed' })).toBe(false);
  });

  it('combines filters rather than choosing one', () => {
    const filters = { ...NO_FILTERS, catId: 'luna', type: 'meow', day: '2026-09-12' };
    expect(filterEvents([base, at('2026-09-11T10:00', { catId: 'luna' })], filters)).toHaveLength(
      1,
    );
  });
});

describe('groupByDay', () => {
  it('groups into days, newest first, without needing sorted input', () => {
    const events = [
      at('2026-09-11T09:00', {}, 'a'),
      at('2026-09-12T22:00', {}, 'b'),
      at('2026-09-12T07:00', {}, 'c'),
    ];
    const sections = groupByDay(events);

    expect(sections.map((section) => section.day)).toEqual(['2026-09-12', '2026-09-11']);
    expect(sections[0]?.events.map((event) => event.id)).toEqual(['b', 'c']);
  });

  it('has nothing to say about an empty list', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('typesPresent', () => {
  it('offers only the types this house has actually heard', () => {
    const events = [
      at('2026-09-12T10:00', { type: 'purr' }, 'a'),
      at('2026-09-12T11:00', { type: 'meow' }, 'b'),
      at('2026-09-12T12:00', { type: 'meow' }, 'c'),
    ];
    // Spec 6.1's order, not the order they happened to arrive in.
    expect(typesPresent(events)).toEqual(['meow', 'purr']);
    expect(typesPresent([])).toEqual([]);
  });
});
