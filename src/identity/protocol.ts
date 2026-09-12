import type { IdentityFeatures, IdentityGuess, IdentityReadiness, LabelReport } from '@/engine';

/**
 * What the main thread and the identity worker say to each other.
 *
 * The worker owns the model. That is the whole design: training is quadratic
 * in the number of confirmed examples, and the vectors are 2053 numbers each,
 * so shipping the model back to the main thread to predict with would move
 * megabytes and then block the frame anyway. Queries go in, guesses come out.
 */

/** Asked of the worker. */
export type IdentityRequest =
  /** Re-read the confirmed set from IndexedDB and retrain (spec 6.4). */
  | { readonly type: 'train' }
  /** Identify one event; answered with a matching `guess` response. */
  | {
      readonly type: 'predict';
      readonly requestId: number;
      readonly eventId: string;
      readonly features: IdentityFeatures;
    };

/** Sent back by the worker. */
export type IdentityResponse =
  | { readonly type: 'trained'; readonly summary: IdentitySummary }
  | {
      readonly type: 'guess';
      readonly requestId: number;
      readonly eventId: string;
      readonly guess: IdentityGuess | null;
    }
  | { readonly type: 'failed'; readonly message: string };

/**
 * What a training run produced.
 *
 * `readiness` is the answer to the only question the UI may ask before showing
 * a name, and it is computed here rather than in the component so there is one
 * implementation of spec 6.4's gate.
 */
export interface IdentitySummary {
  readonly readiness: IdentityReadiness;
  /** Overall self-test accuracy, 0..1, whatever the gate decided. */
  readonly accuracy: number;
  /** Per-cat recall and precision from the same run. */
  readonly perCat: readonly LabelReport[];
  /** Confirmed examples per cat id. */
  readonly countsByCat: Readonly<Record<string, number>>;
  /** Confirmed examples in total. */
  readonly examples: number;
  /** When the run finished, epoch milliseconds. */
  readonly trainedAt: number;
  /**
   * How long it took, in milliseconds.
   *
   * Surfaced rather than swallowed because it is the number that decides
   * whether this can stay a single worker: measured on a development machine
   * it is about 17 ms for 20 examples, 177 ms for 100 and 6 s for 600, since
   * cross-validating kNN is quadratic in the example count. A phone is several
   * times slower again. When households start reaching four figures this is
   * where it will show.
   */
  readonly trainingMs: number;
}
