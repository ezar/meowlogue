import type { DetectedEvent, VocalizationType } from '@/engine';

/**
 * Session bookkeeping for the M0 debug page.
 *
 * The debug page exists to tune the thresholds in `src/engine/config.ts`
 * against real rooms and real cats, so everything here is about counting what
 * fired and getting it out of the browser as JSON.
 */

/** Aggregate view of one debug listening session. */
export interface SessionSummary {
  readonly total: number;
  /** Count per vocalization type; every type is present, possibly as 0. */
  readonly byType: Readonly<Record<VocalizationType, number>>;
  /** Events flagged by the human-voice guard (spec 6.2). */
  readonly possibleHuman: number;
  /** Sum of all event durations, in milliseconds. */
  readonly totalDurationMs: number;
  /** Median event duration, in milliseconds; 0 when there are no events. */
  readonly medianDurationMs: number;
  /** Wall-clock span from the first to the last event, in milliseconds. */
  readonly spanMs: number;
  /** Detections per minute over {@link SessionSummary.spanMs}; 0 when undefined. */
  readonly eventsPerMinute: number;
}

const ALL_TYPES: readonly VocalizationType[] = ['meow', 'purr', 'hiss', 'yowl', 'chirp', 'growl'];

function emptyTypeCounts(): Record<VocalizationType, number> {
  return { meow: 0, purr: 0, hiss: 0, yowl: 0, chirp: 0, growl: 0 };
}

/**
 * Median of a numeric sample.
 *
 * @param values Sample; not mutated.
 * @returns The median, or 0 for an empty sample.
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** Builds a {@link SessionSummary} over the detections of one session. */
export function summarizeSession(events: readonly DetectedEvent[]): SessionSummary {
  const byType = emptyTypeCounts();
  let possibleHuman = 0;
  let totalDurationMs = 0;
  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;
  const durations: number[] = [];

  for (const event of events) {
    byType[event.type] += 1;
    if (event.possibleHuman) possibleHuman += 1;
    totalDurationMs += event.durationMs;
    durations.push(event.durationMs);
    if (event.startedAt < earliest) earliest = event.startedAt;
    const end = event.startedAt + event.durationMs;
    if (end > latest) latest = end;
  }

  const spanMs = events.length === 0 ? 0 : Math.max(0, latest - earliest);
  const eventsPerMinute = spanMs > 0 ? (events.length / spanMs) * 60_000 : 0;

  return {
    total: events.length,
    byType,
    possibleHuman,
    totalDurationMs,
    medianDurationMs: median(durations),
    spanMs,
    eventsPerMinute,
  };
}

/** Options for {@link toExportPayload}. */
export interface ExportOptions {
  /**
   * Include the two 1024-dimensional embeddings per event. Off by default: a
   * ten minute session runs to megabytes and the embeddings are only useful
   * when re-running the classifiers offline.
   */
  readonly includeEmbeddings?: boolean;
  /** Include the log-mel thumbnail magnitudes. Off by default, same reason. */
  readonly includeThumbnails?: boolean;
}

/** A JSON-serializable event record. */
export interface ExportedEvent {
  readonly id: string;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly type: VocalizationType;
  readonly typeConfidence: number;
  readonly possibleHuman: boolean;
  readonly topClasses: readonly { readonly label: string; readonly score: number }[];
  readonly features: {
    readonly pitch: DetectedEvent['features']['pitch'];
    readonly syllableCount: number;
    readonly peakRmsDbfs: number;
    readonly spectralCentroidMedianHz: number;
    readonly embeddingMean?: readonly number[];
    readonly embeddingMax?: readonly number[];
    readonly melThumbnail?: {
      readonly bands: number;
      readonly frames: number;
      readonly data: readonly number[];
    };
  };
}

/** The document written by the debug page's "export session" action. */
export interface ExportPayload {
  readonly schema: 'meowlogue.debug-session/1';
  readonly exportedAt: string;
  readonly userAgent: string;
  readonly summary: SessionSummary;
  readonly events: readonly ExportedEvent[];
}

/**
 * Converts a session into a JSON-serializable document for offline tuning.
 *
 * @param events Detections in the order they fired.
 * @param userAgent Reported so a capture can be traced back to a device.
 * @param options See {@link ExportOptions}.
 */
export function toExportPayload(
  events: readonly DetectedEvent[],
  userAgent: string,
  options: ExportOptions = {},
): ExportPayload {
  const { includeEmbeddings = false, includeThumbnails = false } = options;

  return {
    schema: 'meowlogue.debug-session/1',
    exportedAt: new Date().toISOString(),
    userAgent,
    summary: summarizeSession(events),
    events: events.map((event): ExportedEvent => {
      const { features } = event;
      return {
        id: event.id,
        startedAt: new Date(event.startedAt).toISOString(),
        durationMs: event.durationMs,
        type: event.type,
        typeConfidence: event.typeConfidence,
        possibleHuman: event.possibleHuman,
        topClasses: event.topClasses.map((entry) => ({
          label: entry.label,
          score: entry.score,
        })),
        features: {
          pitch: features.pitch,
          syllableCount: features.syllableCount,
          peakRmsDbfs: features.peakRmsDbfs,
          spectralCentroidMedianHz: features.spectralCentroidMedianHz,
          ...(includeEmbeddings
            ? {
                embeddingMean: Array.from(features.embeddingMean),
                embeddingMax: Array.from(features.embeddingMax),
              }
            : {}),
          ...(includeThumbnails
            ? {
                melThumbnail: {
                  bands: features.melThumbnail.bands,
                  frames: features.melThumbnail.frames,
                  data: Array.from(features.melThumbnail.data),
                },
              }
            : {}),
        },
      };
    }),
  };
}

/** The vocalization types the debug page renders filters for. */
export { ALL_TYPES as VOCALIZATION_TYPES };
