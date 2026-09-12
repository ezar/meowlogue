import { create } from 'zustand';
import type { IdentityGuess } from '@/engine';
import { identityFeaturesOf } from '@/db/identity';
import type { StoredEvent } from '@/db/schema';
import IdentityWorker from '../identity.worker?worker';
import type { IdentityRequest, IdentityResponse, IdentitySummary } from '../protocol';

/**
 * The app's side of the identity worker (spec 6.4).
 *
 * One worker for the whole app, started on first use and never torn down: it
 * holds the trained model, and throwing that away to rebuild it on the next
 * screen would cost seconds for nothing.
 *
 * Retraining is debounced. Confirming who called is one tap, and a person
 * labelling a backlog of cards taps six times in four seconds; each tap
 * changes the confirmed set, and retraining on each one would queue six runs
 * to produce the same model as the last of them.
 */

/** How long to wait for more confirmations before retraining, in ms. */
const RETRAIN_DEBOUNCE_MS = 750;

interface IdentityState {
  /** The last training run, or null before the first one finishes. */
  readonly summary: IdentitySummary | null;
  /** True while a run is in flight. */
  readonly training: boolean;
  /** What the worker could not do, in its own words. */
  readonly error: string | null;
  /** Guesses by event id; null means "asked, and there is no answer". */
  readonly guesses: Readonly<Record<string, IdentityGuess | null>>;
  /** Retrains from what is on disk, debounced. */
  readonly retrain: () => void;
  /** Asks for a guess for each event that could have one. */
  readonly requestGuesses: (events: readonly StoredEvent[]) => void;
}

/** Worker handle, kept outside the store so React never diffs it. */
let worker: Worker | null = null;
let retrainTimer: ReturnType<typeof setTimeout> | null = null;
let nextRequestId = 0;
/** Event ids already asked about since the last training run. */
let asked = new Set<string>();

export const useIdentityStore = create<IdentityState>((set, get) => {
  function ensureWorker(): Worker {
    if (worker !== null) return worker;
    const started = new IdentityWorker();
    started.onmessage = (message: MessageEvent<IdentityResponse>) => {
      const response = message.data;
      if (response.type === 'trained') {
        // A new model invalidates every guess made against the old one, and
        // a stale guess is worse than no guess: it is a name the app no
        // longer believes.
        asked = new Set();
        set({ summary: response.summary, training: false, error: null, guesses: {} });
        return;
      }
      if (response.type === 'guess') {
        set({ guesses: { ...get().guesses, [response.eventId]: response.guess } });
        return;
      }
      set({ training: false, error: response.message });
    };
    started.onerror = (event: ErrorEvent) => {
      set({ training: false, error: event.message });
    };
    worker = started;
    return started;
  }

  function send(request: IdentityRequest): void {
    ensureWorker().postMessage(request);
  }

  return {
    summary: null,
    training: false,
    error: null,
    guesses: {},

    retrain: () => {
      if (retrainTimer !== null) clearTimeout(retrainTimer);
      retrainTimer = setTimeout(() => {
        retrainTimer = null;
        set({ training: true });
        send({ type: 'train' });
      }, RETRAIN_DEBOUNCE_MS);
    },

    requestGuesses: (events) => {
      for (const event of events) {
        // Only what a guess would be useful for: an event the user has
        // already named needs no opinion, and one they said was not a cat
        // needs one even less.
        if (event.catId !== undefined || event.notACat === true) continue;
        if (asked.has(event.id)) continue;
        const features = identityFeaturesOf(event);
        if (features === null) continue;
        asked.add(event.id);
        send({ type: 'predict', requestId: nextRequestId++, eventId: event.id, features });
      }
    },
  };
});
