import { describe, expect, it } from 'vitest';
import {
  clamp,
  confidenceBand,
  contourDirection,
  formatConfidence,
  formatDbfs,
  formatDuration,
  formatHz,
  wantsConfirmation,
} from '@/lib/format';

describe('confidenceBand', () => {
  it('calls anything below the active-learning floor not-sure', () => {
    expect(confidenceBand(0.0)).toBe('not-sure');
    expect(confidenceBand(0.39)).toBe('not-sure');
  });

  it('calls the 0.4 to 0.55 window uncertain', () => {
    expect(confidenceBand(0.4)).toBe('uncertain');
    expect(confidenceBand(0.54)).toBe('uncertain');
  });

  it('shows a name from the not-sure threshold up (spec 6.4)', () => {
    expect(confidenceBand(0.55)).toBe('likely');
    expect(confidenceBand(0.84)).toBe('likely');
  });

  it('treats the auto-confirm threshold as confident', () => {
    expect(confidenceBand(0.85)).toBe('confident');
    expect(confidenceBand(1)).toBe('confident');
  });
});

describe('wantsConfirmation', () => {
  it('covers the inclusive 0.4 to 0.7 active-learning band', () => {
    expect(wantsConfirmation(0.39)).toBe(false);
    expect(wantsConfirmation(0.4)).toBe(true);
    expect(wantsConfirmation(0.7)).toBe(true);
    expect(wantsConfirmation(0.71)).toBe(false);
  });
});

describe('formatters', () => {
  it('formats confidence as a whole percentage', () => {
    expect(formatConfidence(0.726)).toBe('73%');
    expect(formatConfidence(1.4)).toBe('100%');
    expect(formatConfidence(-1)).toBe('0%');
  });

  it('formats levels in dBFS and survives silence', () => {
    expect(formatDbfs(-18.44)).toBe('-18.4 dBFS');
    expect(formatDbfs(Number.NEGATIVE_INFINITY)).toBe('-∞ dBFS');
  });

  it('switches to kHz above 1000 Hz', () => {
    expect(formatHz(520)).toBe('520 Hz');
    expect(formatHz(1850)).toBe('1.85 kHz');
    expect(formatHz(Number.NaN)).toBe('—');
  });

  it('formats durations across the ms, s and m ranges', () => {
    expect(formatDuration(640)).toBe('640 ms');
    expect(formatDuration(1500)).toBe('1.50 s');
    expect(formatDuration(125_000)).toBe('2m 05s');
    expect(formatDuration(-1)).toBe('—');
  });
});

describe('contourDirection', () => {
  // earshot reports the slope in semitones per second, not Hz per second, so
  // the numbers here are musical intervals: 4 st/s is a clear rise, 1 st/s is
  // room-level wobble.
  it('reads rising, falling and flat contours', () => {
    expect(contourDirection(4.2)).toBe('rising');
    expect(contourDirection(-4.2)).toBe('falling');
    expect(contourDirection(1)).toBe('flat');
    expect(contourDirection(0)).toBe('flat');
  });

  it('treats the tolerance as exclusive at the boundary', () => {
    expect(contourDirection(2)).toBe('flat');
    expect(contourDirection(2.01)).toBe('rising');
    expect(contourDirection(-2)).toBe('flat');
    expect(contourDirection(-2.01)).toBe('falling');
  });

  it('honours a custom flat tolerance', () => {
    expect(contourDirection(3, 5)).toBe('flat');
    expect(contourDirection(3, 1)).toBe('rising');
  });

  it('calls a non-finite slope flat rather than guessing', () => {
    expect(contourDirection(Number.NaN)).toBe('flat');
    expect(contourDirection(Number.POSITIVE_INFINITY)).toBe('flat');
  });
});

describe('clamp', () => {
  it('bounds values and maps NaN to the minimum', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(Number.NaN, 0, 1)).toBe(0);
  });
});
