import { create } from 'zustand';
import {
  AudioEngineError,
  createAudioEngine,
  isEarshotAvailable,
  type AudioEngine,
  type DetectedEvent,
  type EngineStatus,
  type LevelUpdate,
  type Unsubscribe,
} from '@/engine';
import { toExportPayload, type ExportOptions } from '@/lib/debug-session';

/** Maximum detections kept in memory for one debug session. */
const MAX_EVENTS = 500;

const IDLE_LEVEL: LevelUpdate = { rmsDbfs: Number.NEGATIVE_INFINITY, noiseFloorDbfs: -90 };

interface DebugState {
  readonly status: EngineStatus;
  readonly level: LevelUpdate;
  readonly events: readonly DetectedEvent[];
  /** null until the availability probe has run. */
  readonly earshotAvailable: boolean | null;
  readonly probeEarshot: () => Promise<void>;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
  readonly clear: () => void;
  readonly exportSession: (options?: ExportOptions) => string;
}

/** Live engine handle, kept outside the store so React never diffs it. */
let engine: AudioEngine | null = null;
let subscriptions: Unsubscribe[] = [];

function unsubscribeAll(): void {
  for (const unsubscribe of subscriptions) unsubscribe();
  subscriptions = [];
}

export const useDebugStore = create<DebugState>((set, get) => ({
  status: { kind: 'idle' },
  level: IDLE_LEVEL,
  events: [],
  earshotAvailable: null,

  probeEarshot: async () => {
    set({ earshotAvailable: await isEarshotAvailable() });
  },

  start: async () => {
    if (get().status.kind === 'listening') return;
    set({ status: { kind: 'loading-models' } });

    try {
      const created = await createAudioEngine();
      engine = created;
      subscriptions = [
        created.on('status', (status) => {
          set({ status });
        }),
        created.on('level', (level) => {
          set({ level });
        }),
        created.on('detection', (event) => {
          const next = [event, ...get().events];
          set({ events: next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next });
        }),
      ];
      await created.start();
    } catch (error) {
      unsubscribeAll();
      engine = null;
      set({
        status: {
          kind: 'error',
          error:
            error instanceof AudioEngineError
              ? error.toEngineError()
              : {
                  code: 'internal',
                  message: error instanceof Error ? error.message : String(error),
                  cause: error,
                },
        },
      });
    }
  },

  stop: async () => {
    const current = engine;
    unsubscribeAll();
    engine = null;
    set({ status: { kind: 'idle' }, level: IDLE_LEVEL });
    if (current !== null) await current.dispose();
  },

  clear: () => {
    set({ events: [] });
  },

  exportSession: (options) =>
    JSON.stringify(
      toExportPayload(
        get().events,
        typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
        options,
      ),
      null,
      2,
    ),
}));
