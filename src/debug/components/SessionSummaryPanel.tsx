import { formatDuration } from '@/lib/format';
import { VOCALIZATION_TYPES, type SessionSummary } from '@/lib/debug-session';

interface Props {
  readonly summary: SessionSummary;
}

/** Counts and rates for the current debug session. */
export function SessionSummaryPanel({ summary }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Stat label="Detections" value={String(summary.total)} />
      <Stat label="Possible human" value={String(summary.possibleHuman)} />
      <Stat label="Median duration" value={formatDuration(summary.medianDurationMs)} />
      <Stat label="Per minute" value={summary.eventsPerMinute.toFixed(1)} />
      <div className="col-span-2 sm:col-span-4">
        <p className="text-[11px] uppercase tracking-wide text-stone-500">By type</p>
        <ul className="mt-1 flex flex-wrap gap-2">
          {VOCALIZATION_TYPES.map((type) => (
            <li
              key={type}
              className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700 tabular-nums"
            >
              {type} <span className="font-semibold">{summary.byType[type]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-stone-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-stone-900">{value}</p>
    </div>
  );
}
