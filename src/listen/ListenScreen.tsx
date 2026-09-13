import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { identityIsMeaningful } from '@/db/household';
import { db } from '@/db/schema';
import { useI18n } from '@/i18n';
import { navigate } from '@/lib/route';
import { formatDbfs } from '@/lib/format';
import { PrimaryButton } from '@/components/PrimaryButton';
import { IdentityStatus } from '@/identity/IdentityStatus';
import { useIdentityStore } from '@/identity/state/useIdentityStore';
import { useIdentityTraining } from '@/identity/useIdentityTraining';
import { useListenStore } from './state/useListenStore';
import { EventCard } from './components/EventCard';

/** How many recent events the screen keeps on display. */
const RECENT_LIMIT = 30;

/**
 * The main screen (spec section 5.1).
 *
 * It listens, writes what it hears, asks who it was — and, once it has earned
 * the right to, says who it thinks it was.
 *
 * Earning it is the whole point. Spec 6.4 holds identity back until each cat
 * has ten confirmed examples and the self-test reaches 80% (`IDENTITY_GATE`); until then the screen says what is still missing and collects
 * confirmations. Saying "probably Luna" before that is the exact dishonesty
 * spec section 2 rules out, so the gate is enforced here by passing no guess
 * at all rather than by a card choosing not to render one.
 */
export function ListenScreen() {
  const { t } = useI18n();
  const status = useListenStore((state) => state.status);
  const level = useListenStore((state) => state.level);
  const start = useListenStore((state) => state.start);
  const stop = useListenStore((state) => state.stop);

  const cats = useLiveQuery(() => db.cats.orderBy('createdAt').toArray(), [], []);
  const labels = useLiveQuery(() => db.labels.orderBy('order').toArray(), [], []);
  const events = useLiveQuery(
    () => db.events.orderBy('startedAt').reverse().limit(RECENT_LIMIT).toArray(),
    [],
    [],
  );

  const summary = useIdentityStore((state) => state.summary);
  const guesses = useIdentityStore((state) => state.guesses);
  const requestGuesses = useIdentityStore((state) => state.requestGuesses);
  useIdentityTraining();

  const identityActive = summary?.readiness.kind === 'active';
  useEffect(() => {
    // Only once the gate is open: a guess computed now and shown later is
    // still a guess the app was not allowed to make.
    if (identityActive) requestGuesses(events);
  }, [identityActive, events, requestGuesses]);

  const askWho = identityIsMeaningful(cats.length);
  const listening = status.kind === 'listening';
  const busy = status.kind === 'loading-models';

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-6">
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-2xl font-semibold text-stone-900">{t('listen.title')}</h1>
        <nav className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              navigate({ kind: 'timeline' });
            }}
            className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-medium text-stone-800"
          >
            {t('nav.timeline')}
          </button>
          <button
            type="button"
            onClick={() => {
              navigate({ kind: 'household' });
            }}
            className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-medium text-stone-800"
          >
            {t('nav.household')}
          </button>
          <button
            type="button"
            onClick={() => {
              navigate({ kind: 'help' });
            }}
            className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-medium text-stone-800"
          >
            {t('nav.help')}
          </button>
        </nav>
      </header>

      <section className="mt-6 flex flex-col items-center">
        <Ear listening={listening} rmsDbfs={level.rmsDbfs} />
        <p role="status" className="mt-4 text-center text-sm text-stone-600">
          {busy
            ? t('listen.loading')
            : listening
              ? `${t('listen.listening')} · ${formatDbfs(level.rmsDbfs)}`
              : t('listen.idle')}
        </p>
        <PrimaryButton
          className="mt-4 w-full"
          disabled={busy}
          onClick={() => void (listening ? stop() : start({ identity: askWho }))}
        >
          {listening ? t('listen.stop') : t('listen.start')}
        </PrimaryButton>
        {listening && (
          // Spec 5.1 says this out loud rather than letting someone discover
          // it by locking the phone and losing an hour of listening.
          <p className="mt-2 text-center text-xs text-stone-500">{t('listen.screenOpen')}</p>
        )}
      </section>

      <div className="mt-5">
        <IdentityStatus cats={cats} />
      </div>

      <section className="mt-5 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
          {t('listen.recent')}
        </p>
        {events.length === 0 ? (
          <div className="mt-2">
            <p className="text-sm text-stone-500">{t('listen.empty')}</p>
            <p className="mt-1 text-sm text-stone-500">{t('listen.emptyHint')}</p>
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                cats={cats}
                // One cat means the context chips belong to it without asking;
                // with two, they wait until the user says whose call it was.
                labels={labels.filter(
                  (label) => label.catId === (askWho ? event.catId : cats[0]?.id),
                )}
                askWho={askWho}
                guess={identityActive ? (guesses[event.id] ?? null) : null}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

interface EarProps {
  readonly listening: boolean;
  readonly rmsDbfs: number;
}

/**
 * The ear that reacts to sound (spec 5.1).
 *
 * Scaled by level rather than animated on a timer, so what it shows is true:
 * a still ear means the microphone is hearing nothing, which is a fault worth
 * seeing rather than hiding behind a decorative pulse. -60 dBFS reads as
 * silence and -10 as loud, which is the range a room actually spans.
 */
function Ear({ listening, rmsDbfs }: EarProps) {
  const loudness = Number.isFinite(rmsDbfs) ? Math.min(1, Math.max(0, (rmsDbfs + 60) / 50)) : 0;
  const scale = listening ? 1 + loudness * 0.35 : 1;

  return (
    <div className="relative flex size-32 items-center justify-center" aria-hidden="true">
      <span
        className={`absolute size-24 rounded-full transition-transform duration-100 ${
          listening ? 'bg-amber-200' : 'bg-stone-200'
        }`}
        style={{ transform: `scale(${scale.toFixed(3)})` }}
      />
      <svg viewBox="0 0 96 96" className="relative size-16 text-stone-800">
        {/* The app's mark, reduced: ears, head, and the call leaving it. */}
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M26 44 L28 20 L37 34" />
          <path d="M37 34 A18 18 0 0 1 59 34" />
          <path d="M59 34 L68 20 L70 44" />
          <path d="M70 44 A18 18 0 1 1 26 44" />
          <path d="M36 48 H44" />
          <path d="M52 48 H60" />
        </g>
      </svg>
    </div>
  );
}
