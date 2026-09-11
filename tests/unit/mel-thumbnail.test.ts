import { describe, expect, it } from 'vitest';
import { DEFAULT_DYNAMIC_RANGE_DB, melThumbnailToPixels, samplePalette } from '@/lib/mel-thumbnail';
import { makeMelThumbnail } from './fixtures/events';

const luminance = (channels: readonly (number | undefined)[]): number =>
  channels.reduce<number>((total, channel) => total + (channel ?? 0), 0);

describe('samplePalette', () => {
  it('clamps out-of-range positions to the palette ends', () => {
    expect(samplePalette(-1)).toEqual(samplePalette(0));
    expect(samplePalette(2)).toEqual(samplePalette(1));
  });

  it('runs light at the quiet end and dark at the loud end', () => {
    expect(luminance(samplePalette(0))).toBeGreaterThan(luminance(samplePalette(1)));
  });

  it('interpolates between stops and stays in gamut', () => {
    const mid = samplePalette(0.5);
    expect(
      mid.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255),
    ).toBe(true);
  });

  it('darkens monotonically across the ramp', () => {
    const steps = [0, 0.25, 0.5, 0.75, 1].map((t) => luminance(samplePalette(t)));
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeLessThan(steps[i - 1] ?? Number.POSITIVE_INFINITY);
    }
  });
});

describe('melThumbnailToPixels', () => {
  const pixelAt = (
    result: { readonly width: number; readonly pixels: Uint8ClampedArray },
    row: number,
    column: number,
  ): readonly (number | undefined)[] => {
    const offset = (row * result.width + column) * 4;
    return [result.pixels[offset], result.pixels[offset + 1], result.pixels[offset + 2]];
  };

  it('produces one opaque pixel per bin, time on x and frequency on y', () => {
    const result = melThumbnailToPixels(makeMelThumbnail(64, 24));

    expect(result.width).toBe(24);
    expect(result.height).toBe(64);
    expect(result.pixels.length).toBe(64 * 24 * 4);
    for (let i = 3; i < result.pixels.length; i += 4) {
      expect(result.pixels[i]).toBe(255);
    }
  });

  it('flips vertically so the lowest band lands on the bottom row', () => {
    // One loud cell in band 0, frame 0. It must render bottom-left.
    const bands = 4;
    const frames = 4;
    const data = new Float32Array(bands * frames).fill(-100);
    data[0] = 0;
    const result = melThumbnailToPixels({ bands, frames, data });

    // Loud takes the dark end of the palette, the quiet rest the light end.
    expect(luminance(pixelAt(result, bands - 1, 0))).toBeLessThan(luminance(pixelAt(result, 0, 0)));
  });

  it('keeps time ordering across the x axis', () => {
    const bands = 2;
    const frames = 3;
    // Band 0 goes quiet, mid, loud from left to right.
    const data = new Float32Array([-60, -30, 0, -60, -60, -60]);
    const result = melThumbnailToPixels({ bands, frames, data });

    const bottom = [0, 1, 2].map((column) => luminance(pixelAt(result, bands - 1, column)));
    expect(bottom[0]).toBeGreaterThan(bottom[1] ?? 0);
    expect(bottom[1]).toBeGreaterThan(bottom[2] ?? 0);
  });

  it('normalises against the thumbnail maximum so quiet events stay legible', () => {
    const bands = 2;
    const frames = 2;
    const quiet = new Float32Array([-90, -90 - DEFAULT_DYNAMIC_RANGE_DB, -90, -90]);
    const loud = new Float32Array([-10, -10 - DEFAULT_DYNAMIC_RANGE_DB, -10, -10]);

    expect(Array.from(melThumbnailToPixels({ bands, frames, data: quiet }).pixels)).toEqual(
      Array.from(melThumbnailToPixels({ bands, frames, data: loud }).pixels),
    );
  });

  it('survives an all-silent thumbnail without producing NaN channels', () => {
    const data = new Float32Array(4).fill(Number.NEGATIVE_INFINITY);
    const result = melThumbnailToPixels({ bands: 2, frames: 2, data });
    expect(Array.from(result.pixels).every((channel) => Number.isInteger(channel))).toBe(true);
  });

  it('rejects malformed thumbnails', () => {
    expect(() => melThumbnailToPixels({ bands: 0, frames: 4, data: new Float32Array() })).toThrow(
      RangeError,
    );
    expect(() => melThumbnailToPixels({ bands: 4, frames: 4, data: new Float32Array(3) })).toThrow(
      /does not match/,
    );
    expect(() => melThumbnailToPixels(makeMelThumbnail(4, 4), 0)).toThrow(/dynamic range/);
  });
});
