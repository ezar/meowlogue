import { MEL_BANDS, WINDOW_SECONDS } from 'earshot';
import type { MelThumbnail, WindowResult } from './types';

/**
 * Builds an event's log-mel thumbnail out of the windows that covered it.
 *
 * A single `WindowResult` carries `features.logMel`: 64 band values averaged
 * over the whole 0.975 s window. One of those rendered alone is a single
 * column — no time axis, useless on an event card. Stacking the windows that
 * overlap the event gives back the time dimension at the 0.4875 s hop, which
 * is coarse but honest: it is the resolution the pipeline actually has.
 *
 * @param windows Recent windows, oldest first, each timed in seconds since
 *   capture started.
 * @param startSeconds Event start, in seconds since capture started.
 * @param endSeconds Event end, in seconds since capture started.
 * @returns A band-major thumbnail, or null when no window overlaps the event.
 */
export function stackLogMel(
  windows: readonly WindowResult[],
  startSeconds: number,
  endSeconds: number,
): MelThumbnail | null {
  const covering = windows.filter((window) => {
    const windowEnd = window.t + WINDOW_SECONDS;
    // Overlap, not containment: an event shorter than a window would match
    // nothing under a containment test.
    return windowEnd > startSeconds && window.t < endSeconds;
  });
  if (covering.length === 0) return null;

  const bands = covering[0]?.features.logMel.length ?? MEL_BANDS;
  if (bands === 0) return null;

  const frames = covering.length;
  const data = new Float32Array(new ArrayBuffer(bands * frames * 4));

  for (let frame = 0; frame < frames; frame += 1) {
    const logMel = covering[frame]?.features.logMel;
    if (logMel === undefined) continue;
    for (let band = 0; band < bands; band += 1) {
      // Band-major so the renderer can walk one band's history contiguously.
      data[band * frames + frame] = logMel[band] ?? 0;
    }
  }

  return { bands, frames, data };
}
