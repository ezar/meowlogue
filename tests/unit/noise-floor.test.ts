import { describe, expect, it } from 'vitest';
import { estimateNoiseFloorDbfs } from '@/engine';

/**
 * The segmenter opens a segment at the noise floor plus 6 dB, so the floor
 * estimate decides what counts as an onset. A low percentile rather than the
 * minimum, so one unusually quiet window cannot drag it down.
 */
describe('estimateNoiseFloorDbfs', () => {
  it('falls back to -90 dBFS with no history', () => {
    expect(estimateNoiseFloorDbfs([])).toBe(-90);
  });

  it('ignores non-finite levels, which digital silence produces', () => {
    expect(estimateNoiseFloorDbfs([Number.NEGATIVE_INFINITY, Number.NaN])).toBe(-90);
    expect(estimateNoiseFloorDbfs([Number.NEGATIVE_INFINITY, -50, -50])).toBe(-50);
  });

  it('sits near the quiet end without being the minimum', () => {
    const levels = [-70, -60, -55, -50, -45, -40, -30, -20, -10, -5];
    const floor = estimateNoiseFloorDbfs(levels);

    expect(floor).toBeGreaterThan(-70);
    expect(floor).toBeLessThan(-40);
  });

  it('is not dragged down by a single very quiet window', () => {
    const steady = Array.from({ length: 20 }, () => -45);
    const withOutlier = [...steady, -95];

    expect(estimateNoiseFloorDbfs(withOutlier)).toBe(estimateNoiseFloorDbfs(steady));
  });

  it('rises with the room', () => {
    const quiet = Array.from({ length: 10 }, (_, i) => -70 + i);
    const loud = quiet.map((level) => level + 20);

    expect(estimateNoiseFloorDbfs(loud)).toBeCloseTo(estimateNoiseFloorDbfs(quiet) + 20, 6);
  });

  it('does not mutate its input', () => {
    const levels = [-30, -70, -50];
    estimateNoiseFloorDbfs(levels);
    expect(levels).toEqual([-30, -70, -50]);
  });
});
