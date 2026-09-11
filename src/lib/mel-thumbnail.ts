import type { MelThumbnail } from '@/engine';
import { clamp } from './format';

/**
 * Rendering for the 64-band log-mel thumbnails earshot attaches to each event
 * (spec 6.3). earshot produces the magnitudes; drawing them is the app's job.
 */

/** Dynamic range shown by the default palette, in dB below the frame maximum. */
export const DEFAULT_DYNAMIC_RANGE_DB = 60;

/**
 * The warm palette from the design brief (section 10): a soft neutral base
 * rising through honey into a deep plum, so a spectrogram reads as cosy rather
 * than clinical. Stops are RGB triples at evenly spaced positions in 0..1.
 */
const PALETTE: readonly (readonly [number, number, number])[] = [
  [250, 247, 242],
  [244, 228, 201],
  [232, 185, 124],
  [206, 129, 90],
  [150, 79, 84],
  [77, 44, 67],
  [33, 24, 38],
];

/**
 * Samples the palette with linear interpolation between stops.
 *
 * @param t Position in the range 0..1; 0 is quietest, 1 is loudest.
 */
export function samplePalette(t: number): readonly [number, number, number] {
  const clamped = clamp(t, 0, 1);
  const scaled = clamped * (PALETTE.length - 1);
  const lowIndex = Math.floor(scaled);
  const highIndex = Math.min(lowIndex + 1, PALETTE.length - 1);
  const low = PALETTE[lowIndex];
  const high = PALETTE[highIndex];
  /* istanbul ignore next -- indices are clamped into range above */
  if (low === undefined || high === undefined) return [0, 0, 0];
  const mix = scaled - lowIndex;
  return [
    Math.round(low[0] + (high[0] - low[0]) * mix),
    Math.round(low[1] + (high[1] - low[1]) * mix),
    Math.round(low[2] + (high[2] - low[2]) * mix),
  ];
}

/** Raw RGBA pixels plus the shape they describe. */
export interface ThumbnailPixels {
  /** Width in pixels; one per time frame. */
  readonly width: number;
  /** Height in pixels; one per mel band. */
  readonly height: number;
  /**
   * `width * height * 4` RGBA bytes, row-major from the top row down.
   *
   * Pinned to a plain `ArrayBuffer` rather than `ArrayBufferLike` so the buffer
   * can be handed straight to `ImageData`, which rejects shared buffers.
   */
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;
}

/**
 * Rasterises a log-mel thumbnail into RGBA pixels, one pixel per bin.
 *
 * Time runs along the x axis and frequency along the y axis with low bands at
 * the bottom, which is how the thumbnail reads on an event card. Magnitudes are
 * normalised against the thumbnail's own maximum so that a quiet purr and a
 * loud yowl are both legible.
 *
 * This is deliberately free of DOM types so it can be unit-tested and, later,
 * run inside the aggregation worker.
 *
 * @param thumbnail Log-mel magnitudes in dB.
 * @param dynamicRangeDb Range shown below the maximum, in dB.
 */
export function melThumbnailToPixels(
  thumbnail: MelThumbnail,
  dynamicRangeDb = DEFAULT_DYNAMIC_RANGE_DB,
): ThumbnailPixels {
  const { bands, frames, data } = thumbnail;
  if (bands <= 0 || frames <= 0) {
    throw new RangeError(`mel thumbnail must be non-empty, got ${bands}x${frames}`);
  }
  if (data.length !== bands * frames) {
    throw new RangeError(
      `mel thumbnail data length ${data.length} does not match ${bands}x${frames}`,
    );
  }
  if (dynamicRangeDb <= 0) {
    throw new RangeError(`dynamic range must be positive, got ${dynamicRangeDb}`);
  }

  let maxDb = Number.NEGATIVE_INFINITY;
  for (const value of data) {
    if (Number.isFinite(value) && value > maxDb) maxDb = value;
  }
  if (!Number.isFinite(maxDb)) maxDb = 0;
  const floorDb = maxDb - dynamicRangeDb;

  const pixels = new Uint8ClampedArray(new ArrayBuffer(bands * frames * 4));
  for (let band = 0; band < bands; band += 1) {
    // Flip vertically so band 0 (lowest frequency) lands on the bottom row.
    const row = bands - 1 - band;
    for (let frame = 0; frame < frames; frame += 1) {
      const value = data[band * frames + frame] ?? floorDb;
      const normalized = (value - floorDb) / dynamicRangeDb;
      const [r, g, b] = samplePalette(normalized);
      const offset = (row * frames + frame) * 4;
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = 255;
    }
  }
  return { width: frames, height: bands, pixels };
}

/**
 * Converts a log-mel thumbnail into `ImageData` for drawing.
 *
 * @param thumbnail Log-mel magnitudes in dB.
 * @param dynamicRangeDb Range shown below the maximum, in dB.
 */
export function melThumbnailToImageData(
  thumbnail: MelThumbnail,
  dynamicRangeDb = DEFAULT_DYNAMIC_RANGE_DB,
): ImageData {
  const { width, height, pixels } = melThumbnailToPixels(thumbnail, dynamicRangeDb);
  return new ImageData(pixels, width, height);
}

/**
 * Draws a thumbnail into a canvas, scaled to fill it.
 *
 * @param canvas Destination canvas; its current size is used as the target.
 * @param thumbnail Log-mel magnitudes in dB.
 */
export function drawMelThumbnail(canvas: HTMLCanvasElement, thumbnail: MelThumbnail): void {
  const context = canvas.getContext('2d');
  if (context === null) return;
  const image = melThumbnailToImageData(thumbnail);

  const source = document.createElement('canvas');
  source.width = image.width;
  source.height = image.height;
  const sourceContext = source.getContext('2d');
  if (sourceContext === null) return;
  sourceContext.putImageData(image, 0, 0);

  context.imageSmoothingEnabled = true;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
}
