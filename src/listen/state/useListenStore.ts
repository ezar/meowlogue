import { create } from 'zustand';
import {
  createListener,
  modelUrlsFor,
  type EngineStatus,
  type Listener,
  type LevelUpdate,
  type Unsubscribe,
} from '@/engine';
import { recordEvent } from '@/db/events';

/**
 * The listening session behind the Listen screen.
 *
 * The difference from the debug store is where detections go: there they piled
 * up in memory and vanished on stop, here every one is written to IndexedDB as
 * it arrives. The screen then reads them back through a live query, so the
 * card you see and the row that will feed identity training are the same
 * thing, and a reload mid-session loses nothing.
 */

const IDLE_LEVEL: LevelUpdate = { rmsDbfs: Number.NEGATIVE_INFINITY, noiseFloorDbfs: -90 };

interface ListenState {
  readonly status: EngineStatus;
  readonly level: LevelUpdate;
  /** True once the YAMNet embedder loaded; identity needs it (spec 6.4). */
  readonly hasEmbedder: boolean;
  readonly start: (options?: { readonly identity?: boolean }) => Promise<void>;
  readonly stop: () => Promise<void>;
}

/** Live listener handle, kept outside the store so React never diffs it. */
let listener: Listener | null = null;
let subscriptions: Unsubscribe[] = [];

function unsubscribeAll(): void {
  for (const unsubscribe of subscriptions) unsubscribe();
  subscriptions = [];
}

export const useListenStore = create<ListenState>((set, get) => ({
  status: { kind: 'idle' },
  level: IDLE_LEVEL,
  hasEmbedder: false,

  start: async (options) => {
    if (get().status.kind !== 'idle' && get().status.kind !== 'error') return;

    const identity = options?.identity ?? true;
    const session = createListener({ models: modelUrlsFor({ embedder: identity }) });
    listener = session;
    subscriptions = [
      session.on('status', (status) => {
        set({ status, hasEmbedder: session.hasEmbedder });
      }),
      session.on('level', (level) => {
        set({ level });
      }),
      session.on('detection', (event) => {
        // Written, not queued: a detection the user never confirms is still
        // the app's record that something was said at that hour, which is
        // what the timeline and the insights in spec 6.6 are counting.
        void recordEvent(event);
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
}));
