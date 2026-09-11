import { CAPTURE, SEGMENTATION, THRESHOLDS } from '@/engine';

/**
 * The policy the engine is running under, shown read-only.
 *
 * The point of the debug page is tuning these against real rooms, so they are
 * on screen next to the detections they produced.
 */
export function ThresholdPanel() {
  const rows: readonly (readonly [string, string])[] = [
    ['Sample rate', `${CAPTURE.sampleRateHz} Hz`],
    ['Window / hop', `${CAPTURE.windowMs} ms / ${CAPTURE.hopMs} ms`],
    ['Meow / Cat', `${THRESHOLDS.meow} / ${THRESHOLDS.cat}`],
    ['Purr', String(THRESHOLDS.purr)],
    ['Hiss / Caterwaul', `${THRESHOLDS.hiss} / ${THRESHOLDS.caterwaul}`],
    ['Speech guard', String(THRESHOLDS.speechGuard)],
    ['Onset', `noise floor + ${SEGMENTATION.onsetAboveNoiseFloorDb} dB`],
    ['Release', `${SEGMENTATION.releaseMs} ms`],
    ['Duration', `${SEGMENTATION.minDurationMs}–${SEGMENTATION.maxDurationMs} ms`],
    ['Merge gap', `${SEGMENTATION.mergeGapMs} ms`],
    ['Debounce', `${SEGMENTATION.debounceMs} ms`],
  ];

  return (
    <details className="rounded-xl bg-white p-4 ring-1 ring-stone-200">
      <summary className="cursor-pointer text-sm font-semibold text-stone-800">
        Detection policy
      </summary>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b border-stone-100 py-1">
            <dt className="text-sm text-stone-600">{label}</dt>
            <dd className="text-sm tabular-nums text-stone-900">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-stone-500">
        Edit these in <code className="font-mono">src/engine/config.ts</code>. They are starting
        points from the spec, to be tuned on the CatMeows evaluation set.
      </p>
    </details>
  );
}
