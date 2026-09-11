import { CONFIDENCE } from '@/engine';

/** How a confidence score should be presented (spec 6.4 and 6.5). */
export type ConfidenceBand = 'not-sure' | 'uncertain' | 'likely' | 'confident';

/**
 * Buckets a confidence score into the bands the spec defines.
 *
 * @param confidence Score in the range 0..1.
 */
export function confidenceBand(confidence: number): ConfidenceBand {
  const { notSureBelow, activeLearningRange, autoConfirmAtOrAbove } = CONFIDENCE;
  if (confidence < notSureBelow) {
    return confidence >= activeLearningRange.low ? 'uncertain' : 'not-sure';
  }
  if (confidence >= autoConfirmAtOrAbove) return 'confident';
  return 'likely';
}

/**
 * True when a guess sits in the active-learning band and its confirmation
 * chips should be emphasised (spec 6.4).
 *
 * @param confidence Score in the range 0..1.
 */
export function wantsConfirmation(confidence: number): boolean {
  const { low, high } = CONFIDENCE.activeLearningRange;
  return confidence >= low && confidence <= high;
}

/**
 * Formats a confidence score as a whole percentage.
 *
 * @param confidence Score in the range 0..1.
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(clamp(confidence, 0, 1) * 100)}%`;
}

/**
 * Formats a level for display.
 *
 * @param dbfs Level in dBFS (negative; 0 dBFS is full scale).
 */
export function formatDbfs(dbfs: number): string {
  if (!Number.isFinite(dbfs)) return '-∞ dBFS';
  return `${dbfs.toFixed(1)} dBFS`;
}

/**
 * Formats a frequency, switching to kHz above 1000 Hz.
 *
 * @param hz Frequency in Hz.
 */
export function formatHz(hz: number): string {
  if (!Number.isFinite(hz)) return '—';
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${Math.round(hz)} Hz`;
}

/**
 * Formats a duration compactly: milliseconds below a second, then seconds.
 *
 * @param ms Duration in milliseconds.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

/**
 * Describes the direction of a pitch contour (spec 6.5 cold-start hints).
 *
 * @param slopeHzPerSec Slope of the linear fit over the f0 contour, Hz/s.
 * @param flatToleranceHzPerSec Slope magnitude treated as flat, Hz/s.
 */
export function contourDirection(
  slopeHzPerSec: number,
  flatToleranceHzPerSec = 40,
): 'rising' | 'flat' | 'falling' {
  if (!Number.isFinite(slopeHzPerSec)) return 'flat';
  if (slopeHzPerSec > flatToleranceHzPerSec) return 'rising';
  if (slopeHzPerSec < -flatToleranceHzPerSec) return 'falling';
  return 'flat';
}

/** Clamps `value` into the inclusive range `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
