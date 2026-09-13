import { useI18n, type MessageKey } from '@/i18n';
import type { IdentityGuess } from '@/engine';
import { formatDuration } from '@/lib/format';
import { deleteEvent } from '@/db/events';
import { WhatChips, WhoChips } from '@/components/AnswerChips';
import { GuessLine } from '@/identity/GuessLine';
import type { Cat, Label, StoredEvent } from '@/db/schema';

interface Props {
  readonly event: StoredEvent;
  readonly cats: readonly Cat[];
  /** Labels of the confirmed cat; empty until a cat is chosen. */
  readonly labels: readonly Label[];
  /** False when the household has one cat and identity is pointless. */
  readonly askWho: boolean;
  /**
   * What identity thinks, or null when it has nothing to say — no model yet,
   * no embedding on this event, or the gate of spec 6.4 still closed.
   */
  readonly guess: IdentityGuess | null;
}

/** Formats an epoch time as the clock time a person would say. */
function clock(startedAt: number, locale: string): string {
  return new Date(startedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/**
 * One detected vocalization, and the chips that teach the app about it
 * (spec 5.1).
 *
 * The guess, when there is one, is never shown as a fact. Above the "not
 * sure" threshold it reads "I think that was Luna" with the number beside it;
 * below it, the card says outright that it is not sure. Inside the
 * active-learning band of spec 6.4 it highlights itself and says why, because
 * those are the answers that teach the classifier the most.
 *
 * Whether a guess arrives at all is not this component's decision: the gate
 * lives in `identityReadiness`, and the screen passes null until it opens.
 * Every answer, guessed or not, is still a training example.
 */
export function EventCard({ event, cats, labels, askWho, guess }: Props) {
  const { t, locale } = useI18n();
  const confirmedCat = cats.find((cat) => cat.id === event.catId);

  return (
    <li
      className={`rounded-xl bg-white p-3 ring-1 ${
        guess?.askAgain === true ? 'ring-2 ring-amber-400' : 'ring-stone-200'
      }`}
    >
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

      <div className="mt-1">
        <GuessLine guess={guess} cats={cats} answered={event.catId !== undefined} />
      </div>

      {event.notACat !== true && (
        <>
          {askWho && (
            <div className="mt-2">
              <WhoChips event={event} cats={cats} suggestedCatId={guess?.catId} />
            </div>
          )}

          {/* Context is per cat (spec 5.1), so it only appears once there is a
              cat to attach it to — or immediately in a one-cat household,
              where the single cat is implied. */}
          {labels.length > 0 && (
            <div className="mt-2">
              <WhatChips event={event} labels={labels} />
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
