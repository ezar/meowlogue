import type { DetectedEvent } from '@/engine';
import {
  contourDirection,
  formatConfidence,
  formatDbfs,
  formatDuration,
  formatHz,
} from '@/lib/format';
import { MelThumbnailCanvas } from './MelThumbnailCanvas';

interface Props {
  readonly event: DetectedEvent;
}

function Field({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="text-sm tabular-nums text-stone-800">{value}</dd>
    </div>
  );
}

/** One detection, with the features the thresholds are tuned against. */
export function EventRow({ event }: Props) {
  const { features } = event;
  const { pitch } = features;

  return (
    <li className="rounded-xl bg-white p-4 ring-1 ring-stone-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-stone-900 px-2.5 py-1 text-xs font-semibold text-white">
            {event.type}
          </span>
          <span className="text-sm text-stone-600 tabular-nums">
            {formatConfidence(event.typeConfidence)}
          </span>
          {event.possibleHuman && (
            <span
              className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900"
              title="Speech scored above the guard threshold in the same window"
            >
              possible human
            </span>
          )}
        </div>
        <time
          className="text-xs text-stone-500 tabular-nums"
          dateTime={new Date(event.startedAt).toISOString()}
        >
          {new Date(event.startedAt).toLocaleTimeString()}
        </time>
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <MelThumbnailCanvas thumbnail={features.melThumbnail} />
        <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <Field label="Duration" value={formatDuration(event.durationMs)} />
          <Field label="Syllables" value={String(features.syllableCount)} />
          <Field label="Peak" value={formatDbfs(features.peakRmsDbfs)} />
          <Field label="Centroid" value={formatHz(features.spectralCentroidMedianHz)} />
          <Field label="f0 median" value={formatHz(pitch.f0MedianHz)} />
          <Field
            label="f0 range"
            value={`${formatHz(pitch.f0P5Hz)} – ${formatHz(pitch.f0P95Hz)}`}
          />
          <Field
            label="Contour"
            value={`${contourDirection(pitch.contourSlopeHzPerSec)} (${pitch.contourSlopeHzPerSec.toFixed(0)} Hz/s)`}
          />
          <Field label="Voiced" value={formatConfidence(pitch.voicedRatio)} />
        </dl>
      </div>

      {event.topClasses.length > 0 && (
        <p className="mt-3 truncate text-xs text-stone-500">
          {event.topClasses
            .map((entry) => `${entry.label} ${entry.score.toFixed(2)}`)
            .join('  ·  ')}
        </p>
      )}
    </li>
  );
}
