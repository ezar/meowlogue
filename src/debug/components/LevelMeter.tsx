import type { LevelUpdate } from '@/engine';
import { formatDbfs } from '@/lib/format';
import { METER_FLOOR_DBFS, levelToFraction } from '@/lib/level';

interface Props {
  readonly level: LevelUpdate;
  readonly active: boolean;
}

/** Input level against the segmenter's tracked noise floor (spec 6.2). */
export function LevelMeter({ level, active }: Props) {
  const fraction = active ? levelToFraction(level.rmsDbfs) : 0;
  const noiseFraction = active ? levelToFraction(level.noiseFloorDbfs) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs text-stone-500">
        <span>Input level</span>
        <span className="tabular-nums">{active ? formatDbfs(level.rmsDbfs) : '—'}</span>
      </div>
      <div
        className="relative h-3 overflow-hidden rounded-full bg-stone-200"
        role="meter"
        aria-label="Input level"
        aria-valuemin={METER_FLOOR_DBFS}
        aria-valuemax={0}
        aria-valuenow={active && Number.isFinite(level.rmsDbfs) ? level.rmsDbfs : METER_FLOOR_DBFS}
        aria-valuetext={active ? formatDbfs(level.rmsDbfs) : 'not listening'}
      >
        <div
          className="h-full bg-amber-500 transition-[width] duration-75"
          style={{ width: `${fraction * 100}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-stone-700"
          style={{ left: `${noiseFraction * 100}%` }}
          title={`Noise floor ${formatDbfs(level.noiseFloorDbfs)}`}
        />
      </div>
      <p className="text-xs text-stone-500 tabular-nums">
        Noise floor {active ? formatDbfs(level.noiseFloorDbfs) : '—'}
      </p>
    </div>
  );
}
