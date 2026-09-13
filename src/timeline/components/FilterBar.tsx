import type { ReactNode } from 'react';
import type { Cat, Label } from '@/db/schema';
import { useI18n, type MessageKey } from '@/i18n';
import { labelText } from '@/lib/labels';
import { hasFilters, type TimelineFilters } from '@/lib/timeline';

interface Props {
  readonly filters: TimelineFilters;
  readonly onChange: (filters: TimelineFilters) => void;
  readonly onClear: () => void;
  readonly cats: readonly Cat[];
  /** Labels of the selected cat; empty when no cat is selected. */
  readonly labels: readonly Label[];
  /** Types this household has actually recorded. */
  readonly types: readonly string[];
}

interface FieldProps {
  /** Id of the control this labels; the two are associated explicitly. */
  readonly htmlFor: string;
  readonly label: string;
  readonly children: ReactNode;
}

/**
 * One labelled control, so every filter lines up the same way.
 *
 * The label points at its control by id rather than wrapping it. Wrapping
 * reads the same on screen but makes the control's accessible name the whole
 * label's text — which, for a `select`, includes every option — so "Estado"
 * answered to the name "Gato" through its own "No era un gato" option.
 */
function Field({ htmlFor, label, children }: FieldProps) {
  return (
    <div className="flex flex-1 basis-36 flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-medium text-stone-600">
        {label}
      </label>
      {children}
    </div>
  );
}

const SELECT =
  'rounded-lg border-0 bg-white px-2 py-2 text-sm text-stone-900 ring-1 ring-stone-300';

/**
 * The timeline's filters (spec 5.1): cat, type, context, state and a day.
 *
 * Native `select` and `date` controls rather than custom widgets. On a phone
 * they open the platform's own pickers, they are keyboard and screen-reader
 * accessible without any work, and a date wheel written by hand would be
 * worse in every way that matters.
 */
export function FilterBar({ filters, onChange, onClear, cats, labels, types }: Props) {
  const { t } = useI18n();

  return (
    <section className="rounded-xl bg-stone-100 p-3">
      <div className="flex flex-wrap gap-2">
        {cats.length > 1 && (
          <Field htmlFor="filter-cat" label={t('timeline.filterCat')}>
            <select
              id="filter-cat"
              className={SELECT}
              value={filters.catId}
              onChange={(changed) => {
                // Changing the cat clears the context: labels belong to one
                // cat, so the previous label id means nothing here.
                onChange({ ...filters, catId: changed.target.value, labelId: 'any' });
              }}
            >
              <option value="any">{t('timeline.any')}</option>
              {cats.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {types.length > 1 && (
          <Field htmlFor="filter-type" label={t('timeline.filterType')}>
            <select
              id="filter-type"
              className={SELECT}
              value={filters.type}
              onChange={(changed) => {
                onChange({ ...filters, type: changed.target.value });
              }}
            >
              <option value="any">{t('timeline.any')}</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {t(`type.${type}` as MessageKey)}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field htmlFor="filter-state" label={t('timeline.filterState')}>
          <select
            id="filter-state"
            className={SELECT}
            value={filters.state}
            onChange={(changed) => {
              onChange({ ...filters, state: changed.target.value as TimelineFilters['state'] });
            }}
          >
            <option value="any">{t('timeline.any')}</option>
            <option value="confirmed">{t('timeline.stateConfirmed')}</option>
            <option value="unconfirmed">{t('timeline.stateUnconfirmed')}</option>
            <option value="not-a-cat">{t('timeline.stateNotACat')}</option>
          </select>
        </Field>

        <Field htmlFor="filter-day" label={t('timeline.filterDay')}>
          <input
            id="filter-day"
            type="date"
            className={SELECT}
            value={filters.day}
            onChange={(changed) => {
              onChange({ ...filters, day: changed.target.value });
            }}
          />
        </Field>

        {labels.length > 0 && (
          <Field htmlFor="filter-context" label={t('timeline.filterContext')}>
            <select
              id="filter-context"
              className={SELECT}
              value={filters.labelId}
              onChange={(changed) => {
                onChange({ ...filters, labelId: changed.target.value });
              }}
            >
              <option value="any">{t('timeline.any')}</option>
              {labels.map((label) => (
                <option key={label.id} value={label.id}>
                  {labelText(label, t)}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {/* Context is per cat (spec 5.1). Saying so beats a control that is
          there but empty, or one that mixes two cats' "food" into one. */}
      {cats.length > 1 && filters.catId === 'any' && (
        <p className="mt-2 text-xs text-stone-500">{t('timeline.contextNeedsCat')}</p>
      )}

      {hasFilters(filters) && (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-stone-800 ring-1 ring-stone-300"
        >
          {t('timeline.clearFilters')}
        </button>
      )}
    </section>
  );
}
