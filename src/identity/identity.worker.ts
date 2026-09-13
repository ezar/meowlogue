/// <reference lib="webworker" />
import { identityReadiness, predictIdentity, trainIdentity, type IdentityModel } from '@/engine';
import { readTrainingSet } from '@/db/identity';
import type { IdentityRequest, IdentityResponse, IdentitySummary } from './protocol';

/**
 * Identity training and prediction, off the main thread (spec 6.4).
 *
 * Spec 6.4 asks for the self-test to "run in the worker whenever the set
 * changes", and the measurement says why: cross-validating a cosine kNN is
 * quadratic in the example count, and a household with a few hundred confirmed
 * calls would otherwise freeze the screen for seconds on every confirmation.
 *
 * It reads IndexedDB itself instead of being handed the examples. The
 * alternative is posting every confirmed event's two 1024-value embeddings
 * across on every retrain, which is megabytes of structured clone for data the
 * worker can read directly from the same database.
 *
 * Unlike earshot's inference worker this one loads no model and touches no
 * WASM, so it runs under `pnpm dev` as happily as in a build.
 */

const scope = self as unknown as DedicatedWorkerGlobalScope;

/** The trained model, or null before the first run. */
let model: IdentityModel | null = null;

function post(response: IdentityResponse): void {
  scope.postMessage(response);
}

async function train(): Promise<void> {
  const startedAt = performance.now();
  const { examples, catIds } = await readTrainingSet();
  const trained = trainIdentity(examples);
  model = trained;

  const summary: IdentitySummary = {
    readiness: identityReadiness(trained, catIds),
    accuracy: trained.report.accuracy,
    perCat: trained.report.labels,
    countsByCat: trained.countsByCat,
    examples: examples.length,
    trainedAt: Date.now(),
    trainingMs: performance.now() - startedAt,
  };
  post({ type: 'trained', summary });
}

scope.onmessage = (message: MessageEvent<IdentityRequest>) => {
  const request = message.data;
  if (request.type === 'train') {
    train().catch((error: unknown) => {
      post({ type: 'failed', message: error instanceof Error ? error.message : String(error) });
    });
    return;
  }

  // A prediction before the first training run is not an error: the screen
  // asks for guesses as soon as it has events, and the honest answer until
  // there is a model is "nothing yet".
  const guess = model === null ? null : predictIdentity(model, request.features);
  post({ type: 'guess', requestId: request.requestId, eventId: request.eventId, guess });
};
