import type { StoredEvent } from '@/db/schema';

/**
 * The timeline's filtering and grouping (spec 5.1).
 *
 * Pure functions over stored events, with no Dexie and no DOM, because this is
 * where the questions a person actually asks are answered — "what did Luna say
 * yesterday", "what have I not confirmed yet" — and those deserve tests rather
 * than a component that happens to look right.
 */

/** Which events the timeline is showing. */
export interface TimelineFilters {
  /** Cat id, or 'any'. */
  readonly catId: string;
  /** Vocalization type, or 'any'. */
  readonly type: string;
  /** Context label id, or 'any'. */
  readonly labelId: string;
  /** Whether the user has answered who called. */
  readonly state: 'any' | 'confirmed' | 'unconfirmed' | 'not-a-cat';
  /** A local day as `YYYY-MM-DD`, or '' for every day. */
  readonly day: string;
}

/** Nothing filtered: the timeline's starting point. */
export const NO_FILTERS: TimelineFilters = {
  catId: 'any',
  type: 'any',
  labelId: 'any',
  state: 'any',
  day: '',
};

/** True when any filter is narrowing the list. */
export function hasFilters(filters: TimelineFilters): boolean {
  return (
    filters.catId !== 'any' ||
    filters.type !== 'any' ||
    filters.labelId !== 'any' ||
    filters.state !== 'any' ||
    filters.day !== ''
  );
}

/**
 * The local day an event belongs to, as `YYYY-MM-DD`.
 *
 * Local, not UTC, and that is the whole point of the function. A cat calling
 * at 00:30 in Madrid is calling on the 13th; `toISOString().slice(0, 10)`
 * would file it under the 12th, and the night-calling counts of spec 6.6 —
 * which are exactly the ones that happen either side of midnight — would be
 * attributed to the wrong day.
 *
 * @param startedAt Event start as epoch milliseconds.
 */
export function dayKey(startedAt: number): string {
  const date = new Date(startedAt);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Whether an event's state matches the filter's. */
function matchesState(event: StoredEvent, state: TimelineFilters['state']): boolean {
  const notACat = event.notACat === true;
  switch (state) {
    case 'any':
      return true;
    case 'not-a-cat':
      return notACat;
    case 'confirmed':
      return !notACat && event.confirmedAt !== undefined;
    case 'unconfirmed':
      // A false positive is not "waiting to be confirmed": it has been
      // answered, and the answer was no. Leaving it in this bucket would mean
      // the list of things still to do never emptied.
      return !notACat && event.confirmedAt === undefined;
  }
}

/** True when one event passes every filter. */
export function matchesFilters(event: StoredEvent, filters: TimelineFilters): boolean {
  if (filters.catId !== 'any' && event.catId !== filters.catId) return false;
  if (filters.type !== 'any' && event.type !== filters.type) return false;
  if (filters.labelId !== 'any' && event.labelId !== filters.labelId) return false;
  if (filters.day !== '' && dayKey(event.startedAt) !== filters.day) return false;
  return matchesState(event, filters.state);
}

/** Applies the filters, keeping the order it was given. */
export function filterEvents(
  events: readonly StoredEvent[],
  filters: TimelineFilters,
): StoredEvent[] {
  return events.filter((event) => matchesFilters(event, filters));
}

/** One day's events, newest first. */
export interface DaySection {
  /** The local day, `YYYY-MM-DD`. */
  readonly day: string;
  readonly events: readonly StoredEvent[];
}

/**
 * Groups events into days, newest day first and newest event first inside it.
 *
 * The input does not have to be sorted: the timeline reads from an index that
 * happens to be ordered, and a grouping that quietly depended on that would
 * break the first time something else called it.
 */
export function groupByDay(events: readonly StoredEvent[]): DaySection[] {
  const byDay = new Map<string, StoredEvent[]>();
  for (const event of events) {
    const key = dayKey(event.startedAt);
    const bucket = byDay.get(key);
    if (bucket === undefined) byDay.set(key, [event]);
    else bucket.push(event);
  }

  return Array.from(byDay, ([day, bucket]) => ({
    day,
    events: [...bucket].sort((a, b) => b.startedAt - a.startedAt),
  })).sort((a, b) => (a.day < b.day ? 1 : -1));
}

/** The vocalization types present in a set, in the order spec 6.1 lists them. */
const TYPE_ORDER: readonly string[] = ['meow', 'purr', 'chirp', 'yowl', 'growl', 'hiss'];

/**
 * Which types the filter should offer.
 *
 * Only the types actually heard in this house: offering `growl` to a household
 * that has never recorded one is an empty promise, and the list is shorter for
 * it.
 */
export function typesPresent(events: readonly StoredEvent[]): string[] {
  const seen = new Set(events.map((event) => event.type));
  const known = TYPE_ORDER.filter((type) => seen.has(type));
  const rest = [...seen].filter((type) => !TYPE_ORDER.includes(type)).sort();
  return [...known, ...rest];
}
