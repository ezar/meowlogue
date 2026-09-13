import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { identityIsMeaningful } from '@/db/household';
import { db } from '@/db/schema';
import { useI18n } from '@/i18n';
import { navigate } from '@/lib/route';
import { useDebugStore } from './state/useDebugStore';
import { EngineStatusBanner } from './components/EngineStatusBanner';
import { EventRow } from './components/EventRow';
import { LevelMeter } from './components/LevelMeter';
import { SessionSummaryPanel } from './components/SessionSummaryPanel';
import { ThresholdPanel } from './components/ThresholdPanel';
import { summarizeSession } from '@/lib/debug-session';

/**
 * The M0 debug page: the only surface the first milestone ships.
 *
 * It exists to prove the earshot pipeline end to end and to tune the
 * thresholds in `src/engine/config.ts` against real rooms. The product UI
 * (Listen, Timeline, Insights) arrives in M1.
 */
export function DebugPage() {
  const { t } = useI18n();
  const status = useDebugStore((state) => state.status);
  const level = useDebugStore((state) => state.level);
  const events = useDebugStore((state) => state.events);
  const hasEmbedder = useDebugStore((state) => state.hasEmbedder);
  const identityRequested = useDebugStore((state) => state.identityRequested);
  const start = useDebugStore((state) => state.start);
  const stop = useDebugStore((state) => state.stop);
  const clear = useDebugStore((state) => state.clear);
  const exportSession = useDebugStore((state) => state.exportSession);

  const [includeEmbeddings, setIncludeEmbeddings] = useState(false);

  // One cat means there is nobody to tell apart, so the embedder stays
  // undownloaded (spec 6.4). Counted rather than assumed: the household can
  // gain a second cat between sessions.
  const catCount = useLiveQuery(() => db.cats.count(), [], 0);
  const identity = identityIsMeaningful(catCount);

  const summary = useMemo(() => summarizeSession(events), [events]);
  const listening = status.kind === 'listening' || status.kind === 'loading-models';
  const busy = status.kind === 'loading-models';

  function handleExport(): void {
    const json = exportSession({ includeEmbeddings });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `meowlogue-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900">Meowlogue debug</h1>
        <p className="mt-1 text-sm text-stone-600">
          M0 pipeline check. Audio never leaves this device.
        </p>
        {/* The only way back into the household or the explanation: this page
            is the app's home until M1's Listen screen exists. */}
        <nav className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              navigate({ kind: 'home' });
            }}
            className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-medium text-stone-800"
          >
            {t('nav.listen')}
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

      <EngineStatusBanner status={status} />

      <section className="space-y-4 rounded-xl bg-white p-4 ring-1 ring-stone-200">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void (listening ? stop() : start({ identity }))}
            disabled={busy}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Loading…' : listening ? 'Stop' : 'Start listening'}
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={events.length === 0}
            className="rounded-lg bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-800 disabled:opacity-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={events.length === 0}
            className="rounded-lg bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-800 disabled:opacity-50"
          >
            Export JSON
          </button>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input
              type="checkbox"
              checked={includeEmbeddings}
              onChange={(changeEvent) => {
                setIncludeEmbeddings(changeEvent.target.checked);
              }}
            />
            include embeddings
          </label>
        </div>

        <LevelMeter level={level} active={status.kind === 'listening'} />

        {status.kind === 'listening' && !identityRequested && (
          <p className="rounded-lg bg-stone-50 p-3 text-xs text-stone-700 ring-1 ring-stone-200">
            Classifier-only by choice: {catCount === 1 ? 'one cat' : 'no cats'} in the household, so
            there is nobody to tell apart and the 13 MB embedder was not downloaded (spec 6.4 needs
            two). Add a second cat and start again to train identity.
          </p>
        )}

        {status.kind === 'listening' && identityRequested && !hasEmbedder && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
            The embedder was requested but did not load, so there are no embeddings and cat identity
            (spec 6.4) cannot be trained. MediaPipe dropped
            <code className="mx-1 font-mono">AudioEmbedder</code> after 0.10.21 — check that version
            is the one installed.
          </p>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-stone-200">
        <h2 className="mb-3 text-sm font-semibold text-stone-800">Session</h2>
        <SessionSummaryPanel summary={summary} />
      </section>

      <ThresholdPanel />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-stone-800">
          Detections{' '}
          <span className="font-normal text-stone-500 tabular-nums">({events.length})</span>
        </h2>
        {events.length === 0 ? (
          <p className="rounded-xl bg-white p-6 text-center text-sm text-stone-500 ring-1 ring-stone-200">
            Nothing detected yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
