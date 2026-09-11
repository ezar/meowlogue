import { WINDOW_SECONDS } from 'earshot';
import { describe, expect, it } from 'vitest';
import { stackLogMel } from '@/engine';
import { makeWindow, makeWindowFeatures } from './fixtures/events';

/**
 * A window's `logMel` is 64 band values averaged over the whole window, so a
 * single one renders as one column. Stacking the windows that overlap an event
 * is what gives the thumbnail a time axis.
 */
describe('stackLogMel', () => {
  it('returns null when no window overlaps the event', () => {
    expect(stackLogMel([makeWindow(0)], 10, 11)).toBeNull();
    expect(stackLogMel([], 0, 1)).toBeNull();
  });

  it('uses one frame per overlapping window', () => {
    const windows = [makeWindow(0), makeWindow(0.4875), makeWindow(0.975)];
    const thumbnail = stackLogMel(windows, 0.5, 1.2);

    expect(thumbnail?.bands).toBe(64);
    // Windows at 0 (ends 0.975), 0.4875 and 0.975 all overlap [0.5, 1.2].
    expect(thumbnail?.frames).toBe(3);
    expect(thumbnail?.data.length).toBe(64 * 3);
  });

  it('counts overlap, not containment, so a short event still gets a frame', () => {
    // An event of 120 ms is far shorter than a 975 ms window; a containment
    // test would find nothing.
    const thumbnail = stackLogMel([makeWindow(0)], 0.4, 0.52);
    expect(thumbnail?.frames).toBe(1);
  });

  it('excludes a window that ends exactly at the event start', () => {
    const thumbnail = stackLogMel([makeWindow(0)], WINDOW_SECONDS, WINDOW_SECONDS + 0.2);
    expect(thumbnail).toBeNull();
  });

  it('lays the data out band-major so one band is contiguous', () => {
    const first = makeWindow(0, {
      features: makeWindowFeatures({ logMel: [1, 2, 3] }),
    });
    const second = makeWindow(0.4875, {
      features: makeWindowFeatures({ logMel: [10, 20, 30] }),
    });
    const thumbnail = stackLogMel([first, second], 0, 1);

    expect(thumbnail?.bands).toBe(3);
    expect(thumbnail?.frames).toBe(2);
    // Band 0 across both frames, then band 1, then band 2.
    expect(Array.from(thumbnail?.data ?? [])).toEqual([1, 10, 2, 20, 3, 30]);
  });

  it('keeps windows in time order', () => {
    const early = makeWindow(0, { features: makeWindowFeatures({ logMel: [1] }) });
    const late = makeWindow(0.4875, { features: makeWindowFeatures({ logMel: [9] }) });
    const thumbnail = stackLogMel([early, late], 0, 1);

    expect(Array.from(thumbnail?.data ?? [])).toEqual([1, 9]);
  });
});
