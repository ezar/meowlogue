import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { deleteEvent } from '@/db/events';
import { db, type StoredEvent } from '@/db/schema';
import { useI18n, type MessageKey, type Translator } from '@/i18n';
import { ScreenShell } from '@/components/ScreenShell';
import { DangerButton } from '@/components/DangerButton';
import { WhatChips, WhoChips } from '@/components/AnswerChips';
import { MelThumbnailCanvas } from '@/debug/components/MelThumbnailCanvas';
import { contourDirection, formatDbfs, formatDuration, formatHz, percent } from '@/lib/format';
import { identityIsMeaningful } from '@/db/household';
import { navigate } from '@/lib/route';
import { GuessLine } from '@/identity/GuessLine';
import { useIdentityStore } from '@/identity/state/useIdentityStore';
import { useIdentityTraining } from '@/identity/useIdentityTraining';

interface Props {
  readonly eventId: string;
}

/** One measurement, as a label and a value. */
function Measurement({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-stone-100 py-1.5 last:border-0">
      <span className="text-sm text-stone-600">{label}</span>
      <span className="text-sm tabular-nums text-stone-900">{value}</span>
    </div>
  );
}

/**
 * One vocalization in full (spec 5.1's event detail).
 *
 * What is **not** here is playback, and the screen says so rather than showing
 * a dead button: spec 6.3 stores an Opus clip of each event and Meowlogue does
 * not record one yet. A missing capability that names itself is the rule in
 * spec section 2; a play button that does nothing is the opposite.
 *
 * What is here is everything that was kept: the log-mel thumbnail, the four
 * pitch descriptors, the level, whether a voice print was stored — and the
 * same chips as the Listen card, so an answer given here trains identity
 * exactly as one given there.
 */
export function EventScreen({ eventId }: Props) {
  const { t, locale } = useI18n();
  const event = useLiveQuery(() => db.events.get(eventId), [eventId], undefined);
  const cats = useLiveQuery(() => db.cats.orderBy('createdAt').toArray(), [], []);
  const labels = useLiveQuery(() => db.labels.orderBy('order').toArray(), [], []);

  const summary = useIdentityStore((state) => state.summary);
  const guesses = useIdentityStore((state) => state.guesses);
  const requestGuesses = useIdentityStore((state) => state.requestGuesses);
  useIdentityTraining();

  // Only once the gate of spec 6.4 is open. Asking for a guess the screen
  // would not be allowed to show is work done to throw away.
  const identityActive = summary?.readiness.kind === 'active';
  useEffect(() => {
    if (identityActive && event !== undefined) requestGuesses([event]);
  }, [identityActive, event, requestGuesses]);

  // `undefined` is "Dexie has not answered yet", `null` would be "no such
  // row" — Dexie returns undefined for both, so the missing case is only
  // certain once the cats query has resolved alongside it.
  if (event === undefined) {
    return (
      <ScreenShell title={t('event.title')}>
        <p className="text-sm text-stone-500">{t('event.notFound')}</p>
      </ScreenShell>
    );
  }

  const askWho = identityIsMeaningful(cats.length);
  const catId = askWho ? event.catId : cats[0]?.id;
  const ownLabels = labels.filter((label) => label.catId === catId);

  return (
    <ScreenShell title={t('event.title')}>
      <p className="text-sm text-stone-600">
        {t(`type.${event.type}` as MessageKey)} ·{' '}
        {new Date(event.startedAt).toLocaleString(locale, {
          dateStyle: 'full',
          timeStyle: 'short',
        })}
      </p>

      {event.possibleHuman && (
        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
          {t('event.possibleHuman')}
        </p>
      )}

      <section className="mt-4">
        <h2 className="text-sm font-semibold text-stone-800">{t('event.spectrogram')}</h2>
        <div className="mt-2">
          {event.melData !== undefined &&
          event.melBands !== undefined &&
          event.melFrames !== undefined ? (
            <MelThumbnailCanvas
              thumbnail={{ bands: event.melBands, frames: event.melFrames, data: event.melData }}
              width={320}
              height={96}
            />
          ) : (
            <p className="text-sm text-stone-500">{t('event.noSpectrogram')}</p>
          )}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-stone-500">{t('event.noAudio')}</p>
      </section>

      {event.notACat === true ? (
        <p className="mt-4 text-sm text-stone-600">{t('event.wasNotACat')}</p>
      ) : (
        <section className="mt-4 space-y-3">
          <GuessLine
            guess={identityActive ? (guesses[event.id] ?? null) : null}
            cats={cats}
            answered={event.catId !== undefined}
          />
          {askWho && (
            <WhoChips event={event} cats={cats} suggestedCatId={guesses[event.id]?.catId} />
          )}
          <WhatChips event={event} labels={ownLabels} />
        </section>
      )}

      <section className="mt-5">
        <h2 className="text-sm font-semibold text-stone-800">{t('event.measurements')}</h2>
        <div className="mt-1 rounded-xl bg-white p-3 ring-1 ring-stone-200">
          <Measurement label={t('event.duration')} value={formatDuration(event.durationMs)} />
          <Measurement label={t('event.syllablesLabel')} value={String(event.syllables)} />
          <Measurement label={t('event.pitch')} value={formatHz(event.medianF0Hz)} />
          <Measurement
            label={t('event.contour')}
            value={t(
              `contour.${contourDirection(event.contourSlopeSemitonesPerSecond)}` as MessageKey,
            )}
          />
          <Measurement label={t('event.voiced')} value={`${percent(event.voicedFraction)}%`} />
          <Measurement label={t('event.centroid')} value={formatHz(event.spectralCentroidHz)} />
          <Measurement label={t('event.peak')} value={formatDbfs(event.peakDbfs)} />
          <Measurement
            label={t('event.trigger')}
            value={`${event.triggerLabel} · ${percent(event.confidence)}%`}
          />
          <Measurement label={t('event.embedding')} value={embeddingText(event, t)} />
        </div>
      </section>

      <section className="mt-6">
        <DangerButton
          onClick={() => {
            void deleteEvent(event.id).then(() => {
              // Back to the list: staying here would leave the screen showing
              // "that vocalization is gone", which is true and useless.
              navigate({ kind: 'timeline' });
            });
          }}
        >
          {t('event.delete')}
        </DangerButton>
      </section>
    </ScreenShell>
  );
}

/** Whether this event carries a voice print, and how much of one. */
function embeddingText(event: StoredEvent, t: Translator): string {
  if (event.embeddingMean === undefined) return t('event.embeddingNo');
  return t('event.embeddingYes', { windows: event.embeddingWindows ?? 1 });
}
