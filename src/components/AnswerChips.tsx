import { confirmCat, confirmLabel, markNotACat } from '@/db/events';
import type { Cat, Label, StoredEvent } from '@/db/schema';
import { useI18n } from '@/i18n';
import { catColorById } from '@/lib/cat-colors';
import { labelText } from '@/lib/labels';

/**
 * The chips that teach the app about one event (spec 5.1).
 *
 * Shared by the Listen card and the timeline's event detail, because they are
 * the same question — who called, and what about — and two implementations
 * would be two chances to disagree about what a tap means.
 */

interface WhoProps {
  readonly event: StoredEvent;
  readonly cats: readonly Cat[];
  /** Cat the classifier suggests, if any; outlined, never pre-pressed. */
  readonly suggestedCatId?: string | undefined;
}

/** "Who was that?", one chip per cat plus a way to say it was nobody. */
export function WhoChips({ event, cats, suggestedCatId }: WhoProps) {
  const { t } = useI18n();

  return (
    <div>
      <p className="text-xs font-medium text-stone-600">{t('event.who')}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {cats.map((cat) => {
          const chosen = cat.id === event.catId;
          return (
            <button
              key={cat.id}
              type="button"
              aria-pressed={chosen}
              onClick={() => void confirmCat(event.id, cat.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 ${
                chosen
                  ? 'bg-stone-900 text-white ring-stone-900'
                  : cat.id === suggestedCatId
                    ? 'bg-stone-50 text-stone-900 ring-stone-500'
                    : 'bg-stone-50 text-stone-800 ring-stone-300'
              }`}
            >
              <span
                aria-hidden="true"
                className="size-3 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: catColorById(cat.color).hex }}
              />
              {cat.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => void markNotACat(event.id)}
          className="rounded-full bg-stone-50 px-3 py-1.5 text-sm text-stone-600 ring-1 ring-stone-300"
        >
          {t('event.notACat')}
        </button>
      </div>
    </div>
  );
}

interface WhatProps {
  readonly event: StoredEvent;
  /** Labels of the cat this event belongs to; empty hides the question. */
  readonly labels: readonly Label[];
}

/** "What was it about?", the context labels of one cat (spec 5.1). */
export function WhatChips({ event, labels }: WhatProps) {
  const { t } = useI18n();
  if (labels.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium text-stone-600">{t('event.what')}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {labels.map((label) => {
          const chosen = label.id === event.labelId;
          return (
            <button
              key={label.id}
              type="button"
              aria-pressed={chosen}
              onClick={() => void confirmLabel(event.id, label.id)}
              className={`rounded-full px-3 py-1.5 text-sm ring-1 ${
                chosen
                  ? 'bg-stone-900 text-white ring-stone-900'
                  : 'bg-stone-50 text-stone-800 ring-stone-300'
              }`}
            >
              {labelText(label, t)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
