import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { useI18n } from '@/i18n';
import { ScreenShell } from '@/components/ScreenShell';
import {
  NO_FILTERS,
  dayKey,
  filterEvents,
  groupByDay,
  hasFilters,
  typesPresent,
  type TimelineFilters,
} from '@/lib/timeline';
import { FilterBar } from './components/FilterBar';
import { EventRow } from './components/EventRow';

/**
 * How many events are read at once.
 *
 * The timeline is reverse chronological, so the cap falls on the oldest
 * events rather than on the ones anybody is looking at, and the day filter
 * reaches past it. A household that talks a lot would otherwise hold
 * thousands of rows — each with two 1024-value embeddings — in memory to
 * render thirty of them.
 */
const LIMIT = 200;

/** Formats a `YYYY-MM-DD` key as the heading a person would write. */
function dayHeading(day: string, locale: string, t: ReturnType<typeof useI18n>['t']): string {
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 24 * 60 * 60 * 1000);
  if (day === today) return t('timeline.today');
  if (day === yesterday) return t('timeline.yesterday');

  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * The timeline (spec 5.1): every vocalization, newest first, with filters.
 *
 * Filtering happens in memory over the most recent {@link LIMIT} events rather
 * than in Dexie. With five filters that can combine freely, a query per
 * combination would need an index per combination; reading one indexed range
 * and filtering it is both simpler and, at this size, faster than the
 * round-trips it replaces. The day filter is the escape hatch for a set that
 * has outgrown the cap.
 */
export function TimelineScreen() {
  const { t, locale } = useI18n();
  const [filters, setFilters] = useState<TimelineFilters>(NO_FILTERS);

  const cats = useLiveQuery(() => db.cats.orderBy('createdAt').toArray(), [], []);
  const allLabels = useLiveQuery(() => db.labels.orderBy('order').toArray(), [], []);
  const events = useLiveQuery(
    () => db.events.orderBy('startedAt').reverse().limit(LIMIT).toArray(),
    [],
    [],
  );

  const types = useMemo(() => typesPresent(events), [events]);
  const labels = useMemo(
    // Context is per cat, so the control only means something once a cat is
    // chosen — or when there is only one cat to mean.
    () =>
      allLabels.filter(
        (label) => label.catId === (filters.catId === 'any' ? cats[0]?.id : filters.catId),
      ),
    [allLabels, cats, filters.catId],
  );
  const shown = useMemo(() => filterEvents(events, filters), [events, filters]);
  const sections = useMemo(() => groupByDay(shown), [shown]);

  const contextLabels = cats.length > 1 && filters.catId === 'any' ? [] : labels;

  return (
    <ScreenShell title={t('timeline.title')}>
      <p className="text-sm leading-relaxed text-stone-600">{t('timeline.subtitle')}</p>

      <div className="mt-4">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          onClear={() => {
            setFilters(NO_FILTERS);
          }}
          cats={cats}
          labels={contextLabels}
          types={types}
        />
      </div>

      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-stone-500 tabular-nums">
        {shown.length === 1 ? t('timeline.countOne') : t('timeline.count', { count: shown.length })}
      </p>

      {events.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">{t('timeline.empty')}</p>
      ) : shown.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">{t('timeline.noMatches')}</p>
      ) : (
        <div className="mt-2 space-y-5">
          {sections.map((section) => (
            <section key={section.day}>
              {/* `first-letter:uppercase`, not `capitalize`: Spanish writes
                  "jueves, 15 de enero", and capitalize would give "15 De
                  Enero". */}
              <h2 className="text-sm font-semibold text-stone-700 first-letter:uppercase">
                {dayHeading(section.day, locale, t)}
              </h2>
              <ul className="mt-2 space-y-2">
                {section.events.map((event) => (
                  <EventRow key={event.id} event={event} cats={cats} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Said out loud rather than left to be discovered: a list that silently
          stops at 200 looks like a household that stopped talking. */}
      {events.length === LIMIT && !hasFilters(filters) && (
        <p className="mt-4 text-xs text-stone-500">{t('timeline.truncated', { count: LIMIT })}</p>
      )}
    </ScreenShell>
  );
}
