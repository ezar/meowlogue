import { MODEL_BASE_URL, type EngineStatus } from '@/engine';

/** How prominently a status message should read. */
export type StatusTone = 'neutral' | 'busy' | 'good' | 'warn';

/** A status rendered as plain language. */
export interface StatusMessage {
  readonly tone: StatusTone;
  readonly title: string;
  readonly detail: string;
}

/**
 * Turns engine state into plain language.
 *
 * Honesty is a product principle (spec section 2), so the missing-engine case
 * says exactly what is missing rather than looking like a transient error, and
 * the suspended case explains the iOS microphone lifecycle instead of calling
 * itself a failure.
 *
 * @param status Current engine state.
 */
export function describeStatus(status: EngineStatus): StatusMessage {
  switch (status.kind) {
    case 'idle':
      return { tone: 'neutral', title: 'Idle', detail: 'Not listening. Press Start to begin.' };
    case 'loading-models':
      return {
        tone: 'busy',
        title: 'Loading models',
        detail: `Fetching the YAMNet classifier and embedder from ${MODEL_BASE_URL}.`,
      };
    case 'listening':
      return {
        tone: 'good',
        title: 'Listening',
        detail: 'Capturing at 16 kHz in 0.975 s windows with a 0.4875 s hop.',
      };
    case 'suspended':
      return {
        tone: 'busy',
        title: 'Not listening',
        detail:
          status.reason === 'page-hidden'
            ? 'The page is hidden, so the microphone is released. On iOS this happens whenever the screen locks.'
            : 'Paused.',
      };
    case 'error':
      return { tone: 'warn', title: 'Engine error', detail: status.error.message };
  }
}
