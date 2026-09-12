import { createCapture, createEventDetector, createEngine } from 'earshot';
import workletUrl from 'earshot/capture-worklet?url';
import workerUrl from 'earshot/worker?worker&url';
import {
  MODEL_URLS,
  SEGMENTATION,
  THRESHOLDS,
  THUMBNAIL_WINDOW_HISTORY,
  type DetectionThresholds,
  type SegmentationOptions,
} from './config';
import { stackLogMel } from './mel';
import { passesClassPolicy, toDetectorConfig, toMeowEvent } from './vocalization';
import { poolEmbedding } from './windows';
import type {
  Capture,
  Engine,
  EngineError,
  EngineStatus,
  ListenerEventMap,
  ListenerListener,
  Listener,
  MeowEvent,
  Unsubscribe,
  WindowResult,
} from './types';

/**
 * Composes a listening session out of earshot's three pieces.
 *
 * earshot deliberately does not ship a single "listen for cats" object. It
 * gives a microphone (`createCapture`), a window producer (`createEngine`,
 * backed by a worker) and a vocalization detector (`createEventDetector`), and
 * leaves the wiring to the app — which is right, because the wiring is where
 * the product decisions live. This module is that wiring for Meowlogue:
 *
 *   capture.onChunk  ->  engine.push  ->  detector.push  ->  MeowEvent
 *
 * On top of the plumbing it does three things earshot cannot do for us:
 *
 * 1. applies the per-class thresholds from spec 6.2, which earshot's single
 *    `triggerScore` cannot express;
 * 2. converts event times from seconds-since-capture into epoch milliseconds,
 *    because insights are bucketed by hour of day (spec 6.6);
 * 3. keeps a short history of analysis windows so each event gets a log-mel
 *    thumbnail with a time axis — a window's own `logMel` is a single
 *    64-value average, which would render as one column — and a mean and max
 *    pooled embedding over the same windows (spec 6.3).
 */

/** Options for {@link createListener}. */
export interface ListenerOptions {
  readonly thresholds?: DetectionThresholds;
  readonly segmentation?: SegmentationOptions;
}

/** How many windows of level history the noise-floor estimate looks at. */
const NOISE_FLOOR_HISTORY = 40;

/** Percentile of recent window levels treated as the noise floor, in 0..1. */
const NOISE_FLOOR_PERCENTILE = 0.2;

function toEngineError(error: unknown): EngineError {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return {
        code: 'microphone-denied',
        message: 'Microphone access was denied. Meowlogue cannot listen without it.',
        cause: error,
      };
    }
    if (error.name === 'NotFoundError' || error.name === 'NotReadableError') {
      return {
        code: 'microphone-unavailable',
        message: 'No usable microphone was found.',
        cause: error,
      };
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/tflite|wasm|model|fetch|404/i.test(message)) {
    return {
      code: 'models-missing',
      message: `Models could not be loaded from ${MODEL_URLS.wasmBaseUrl}. Run \`pnpm models:fetch\`. (${message})`,
      cause: error,
    };
  }
  return { code: 'internal', message, cause: error };
}

/**
 * Estimates the noise floor as a low percentile of recent window levels.
 *
 * A percentile rather than a minimum, so one unusually quiet window does not
 * drag the floor down and make everything look like an onset.
 *
 * @param levelsDbfs Recent window levels in dBFS, oldest first.
 * @returns The estimated floor in dBFS, or -90 when there is no history.
 */
export function estimateNoiseFloorDbfs(levelsDbfs: readonly number[]): number {
  const finite = levelsDbfs.filter((level) => Number.isFinite(level));
  if (finite.length === 0) return -90;
  const sorted = [...finite].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * NOISE_FLOOR_PERCENTILE));
  return sorted[index] ?? -90;
}

/**
 * Builds a listening session.
 *
 * Nothing is started until {@link Listener.start} is called, so constructing a
 * listener never prompts for the microphone.
 */
export function createListener(options: ListenerOptions = {}): Listener {
  const thresholds = options.thresholds ?? THRESHOLDS;
  const segmentation = options.segmentation ?? SEGMENTATION;

  const listeners: { [K in keyof ListenerEventMap]: Set<ListenerListener<K>> } = {
    status: new Set(),
    level: new Set(),
    detection: new Set(),
  };

  let status: EngineStatus = { kind: 'idle' };
  let capture: Capture | null = null;
  let engine: Engine | null = null;
  let hasEmbedder = false;
  let captureStartedAtEpochMs = 0;

  /** Recent windows, oldest first, for thumbnail stacking. */
  let windowHistory: WindowResult[] = [];
  /** Recent window levels in dBFS, oldest first, for the noise floor. */
  let levelHistory: number[] = [];

  function emit<K extends keyof ListenerEventMap>(event: K, payload: ListenerEventMap[K]): void {
    for (const listener of listeners[event]) listener(payload);
  }

  function setStatus(next: EngineStatus): void {
    status = next;
    emit('status', next);
  }

  function onWindow(window: WindowResult): void {
    windowHistory.push(window);
    if (windowHistory.length > THUMBNAIL_WINDOW_HISTORY) windowHistory.shift();
    levelHistory.push(window.rmsDbfs);
    if (levelHistory.length > NOISE_FLOOR_HISTORY) levelHistory.shift();

    emit('level', {
      rmsDbfs: window.rmsDbfs,
      noiseFloorDbfs: estimateNoiseFloorDbfs(levelHistory),
    });
  }

  return {
    get status() {
      return status;
    },
    get hasEmbedder() {
      return hasEmbedder;
    },

    on<K extends keyof ListenerEventMap>(event: K, listener: ListenerListener<K>): Unsubscribe {
      listeners[event].add(listener);
      return () => {
        listeners[event].delete(listener);
      };
    },

    async start(): Promise<void> {
      if (status.kind === 'listening' || status.kind === 'loading-models') return;
      setStatus({ kind: 'loading-models' });

      try {
        const startedEngine = await createEngine({ workerUrl, models: MODEL_URLS });
        engine = startedEngine;
        hasEmbedder = startedEngine.hasEmbedder;

        const detector = createEventDetector(toDetectorConfig(segmentation, thresholds));
        startedEngine.onWindow(onWindow);

        const startedCapture = await createCapture({ workletUrl });
        capture = startedCapture;
        captureStartedAtEpochMs = Date.now();

        startedCapture.onChunk((samples) => {
          // Keep a copy: `engine.push` transfers the buffer to the worker, and
          // the detector needs the same audio to cut the event out of.
          const forDetector = samples.slice();
          void startedEngine
            .push(samples)
            .then((windows) => {
              for (const window of windows) {
                for (const event of detector.push(window, forDetector)) {
                  if (!passesClassPolicy(event, thresholds)) continue;
                  // The window that triggered this event has reached the
                  // detector, but `onWindow` may not have filed it yet. Both
                  // summaries below would otherwise be computed without the
                  // one window an event is guaranteed to overlap.
                  const covered = windowHistory.includes(window)
                    ? windowHistory
                    : [...windowHistory, window];
                  const meowEvent: MeowEvent = toMeowEvent(
                    event,
                    captureStartedAtEpochMs,
                    stackLogMel(covered, event.start, event.end),
                    poolEmbedding(covered, event.start, event.end),
                  );
                  emit('detection', meowEvent);
                }
              }
            })
            .catch((error: unknown) => {
              setStatus({ kind: 'error', error: toEngineError(error) });
            });
        });

        setStatus({ kind: 'listening' });
      } catch (error) {
        await this.stop();
        setStatus({ kind: 'error', error: toEngineError(error) });
      }
    },

    async stop(): Promise<void> {
      const runningCapture = capture;
      const runningEngine = engine;
      capture = null;
      engine = null;
      windowHistory = [];
      levelHistory = [];
      if (status.kind !== 'error') setStatus({ kind: 'idle' });
      if (runningCapture !== null) await runningCapture.stop();
      if (runningEngine !== null) await runningEngine.close();
    },
  };
}
