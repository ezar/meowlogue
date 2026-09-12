import { describe, expect, it } from 'vitest';
import { PHOTO_MAX_EDGE_PX, fitWithin } from '@/lib/image';

/**
 * Avatar sizing. The encoding half of `downscalePhoto` needs a real canvas and
 * is exercised end to end in `tests/e2e/onboarding.spec.ts`, which measures the
 * blob that actually lands in IndexedDB.
 */

describe('fitWithin', () => {
  it('scales a landscape photo by its longest edge', () => {
    // 4032x3024 is a common phone sensor size.
    expect(fitWithin(4032, 3024, 512)).toEqual({ width: 512, height: 384 });
  });

  it('scales a portrait photo by its longest edge', () => {
    expect(fitWithin(3024, 4032, 512)).toEqual({ width: 384, height: 512 });
  });

  it('leaves a photo already inside the box alone', () => {
    // Never scale up: re-encoding a small photo larger helps nobody and the
    // result would be bigger than what the user picked.
    expect(fitWithin(200, 120, 512)).toEqual({ width: 200, height: 120 });
    expect(fitWithin(512, 512, 512)).toEqual({ width: 512, height: 512 });
  });

  it('keeps a very wide panorama at least one pixel tall', () => {
    const fitted = fitWithin(8000, 40, 512);
    expect(fitted.width).toBe(512);
    expect(fitted.height).toBeGreaterThanOrEqual(1);
  });

  it('returns whole pixels', () => {
    const fitted = fitWithin(1000, 333, 512);
    expect(Number.isInteger(fitted.width)).toBe(true);
    expect(Number.isInteger(fitted.height)).toBe(true);
  });

  it('survives a zero-sized source', () => {
    expect(fitWithin(0, 0, PHOTO_MAX_EDGE_PX)).toEqual({ width: 1, height: 1 });
  });
});
