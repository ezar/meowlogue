import { useI18n, type MessageKey } from '@/i18n';
import { catColorById } from '@/lib/cat-colors';
import { formatDuration } from '@/lib/format';
import { confirmCat, confirmLabel, deleteEvent, markNotACat } from '@/db/events';
import type { Cat, Label, StoredEvent } from '@/db/schema';

interface Props {
  readonly event: StoredEvent;
  readonly cats: readonly Cat[];
  /** Labels of the confirmed cat; empty until a cat is chosen. */
  readonly labels: readonly Label[];
  /** False when the household has one cat and identity is pointless. */
  readonly askWho: boolean;
}

/** A label's display text: an i18n key for the defaults, verbatim if renamed. */
function labelText(label: Label, t: (key: MessageKey) => string): string {
  return label.isCustom ? label.name : t(label.name as MessageKey);
}

/** Formats an epoch time as the clock time a person would say. */
function clock(startedAt: number, locale: string): string {
  return new Date(startedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/**
 * One detected vocalization, and the chips that teach the app about it
 * (spec 5.1).
 *
 * There is no identity or context guess on this card yet, and that is not an
 * omission: spec 6.4 forbids showing a guess before each cat has ten confirmed
 * examples and the self-test reaches 80%, and nothing has been trained. So the
 * card asks instead of guessing. Every answer is a training example.
 */
export function EventCard({ event, cats, labels, askWho }: Props) {
  const { t, locale } = useI18n();
  const confirmedCat = cats.find((cat) => cat.id === event.catId);

  return (
    <li className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
      <div className="flex items-baseline gap-2">
        <span className="text-base font-medium text-stone-900">
          {t(`type.${event.type}` as MessageKey)}
        </span>
        <span className="text-sm text-stone-500 tabular-nums">
          {clock(event.startedAt, locale)}
        </span>
        <span className="text-sm text-stone-400 tabular-nums">
          {formatDuration(event.durationMs)}
        </span>
        {event.notACat === true ? (
          <span className="ml-auto text-xs text-stone-500">{t('event.wasNotACat')}</span>
        ) : (
          confirmedCat === undefined && (
            <span className="ml-auto text-xs text-stone-400" aria-hidden="true">
              ?
            </span>
          )
        )}
      </div>

      {event.possibleHuman && (
        // Spec 6.2: stored and flagged, never silently dropped, because
        // everyone imitates their cat.
        <p className="mt-1 text-xs text-amber-800">{t('event.possibleHuman')}</p>
      )}

      {event.notACat !== true && (
        <>
          {askWho && (
            <div className="mt-2">
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
          )}

          {/* Context is per cat (spec 5.1), so it only appears once there is a
              cat to attach it to — or immediately in a one-cat household,
              where the single cat is implied. */}
          {labels.length > 0 && (
            <div className="mt-2">
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
          )}
        </>
      )}

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => void deleteEvent(event.id)}
          className="rounded-lg px-2 py-1 text-xs text-stone-500"
        >
          {t('event.delete')}
        </button>
      </div>
    </li>
  );
}
