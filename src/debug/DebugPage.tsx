import { useEffect, useMemo, useState } from 'react';
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
  const status = useDebugStore((state) => state.status);
  const level = useDebugStore((state) => state.level);
  const events = useDebugStore((state) => state.events);
  const earshotAvailable = useDebugStore((state) => state.earshotAvailable);
  const probeEarshot = useDebugStore((state) => state.probeEarshot);
  const start = useDebugStore((state) => state.start);
  const stop = useDebugStore((state) => state.stop);
  const clear = useDebugStore((state) => state.clear);
  const exportSession = useDebugStore((state) => state.exportSession);

  const [includeEmbeddings, setIncludeEmbeddings] = useState(false);

  useEffect(() => {
    void probeEarshot();
  }, [probeEarshot]);

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
      </header>

      <EngineStatusBanner status={status} earshotAvailable={earshotAvailable} />

      <section className="space-y-4 rounded-xl bg-white p-4 ring-1 ring-stone-200">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void (listening ? stop() : start())}
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
