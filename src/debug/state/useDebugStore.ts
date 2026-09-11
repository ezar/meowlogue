import { create } from 'zustand';
import {
  createListener,
  type EngineStatus,
  type Listener,
  type LevelUpdate,
  type MeowEvent,
  type Unsubscribe,
} from '@/engine';
import { toExportPayload, type ExportOptions } from '@/lib/debug-session';

/** Maximum detections kept in memory for one debug session. */
const MAX_EVENTS = 500;

const IDLE_LEVEL: LevelUpdate = { rmsDbfs: Number.NEGATIVE_INFINITY, noiseFloorDbfs: -90 };

interface DebugState {
  readonly status: EngineStatus;
  readonly level: LevelUpdate;
  readonly events: readonly MeowEvent[];
  /** True once the YAMNet embedder loaded; identity needs it (spec 6.4). */
  readonly hasEmbedder: boolean;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
  readonly clear: () => void;
  readonly exportSession: (options?: ExportOptions) => string;
}

/** Live listener handle, kept outside the store so React never diffs it. */
let listener: Listener | null = null;
let subscriptions: Unsubscribe[] = [];

function unsubscribeAll(): void {
  for (const unsubscribe of subscriptions) unsubscribe();
  subscriptions = [];
}

export const useDebugStore = create<DebugState>((set, get) => ({
  status: { kind: 'idle' },
  level: IDLE_LEVEL,
  events: [],
  hasEmbedder: false,

  start: async () => {
    if (get().status.kind !== 'idle' && get().status.kind !== 'error') return;

    const session = createListener();
    listener = session;
    subscriptions = [
      session.on('status', (status) => {
        set({ status, hasEmbedder: session.hasEmbedder });
      }),
      session.on('level', (level) => {
        set({ level });
      }),
      session.on('detection', (event) => {
        const next = [event, ...get().events];
        set({ events: next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next });
      }),
    ];

    await session.start();
  },

  stop: async () => {
    const session = listener;
    unsubscribeAll();
    listener = null;
    set({ level: IDLE_LEVEL });
    if (session !== null) await session.stop();
    set({ status: { kind: 'idle' } });
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
