/**
 * Photo downscaling for cat avatars.
 *
 * A phone camera writes 3 to 8 MB per shot, and the household list renders it
 * in a 56 px circle. Storing the original puts megabytes per cat into
 * IndexedDB — on a local-first app with no server to fall back on, that is the
 * user's own storage quota being spent on pixels nothing will ever read.
 */

/** Longest edge kept when a photo is stored, in pixels. */
export const PHOTO_MAX_EDGE_PX = 512;

/** JPEG quality used for the stored copy, in the range 0..1. */
export const PHOTO_QUALITY = 0.82;

/**
 * Scales a size down to fit inside a square, preserving aspect ratio.
 *
 * Never scales up: a photo already smaller than the box is left alone rather
 * than re-encoded into something larger than the original.
 *
 * @param width Source width in pixels.
 * @param height Source height in pixels.
 * @param maxEdgePx Longest edge allowed, in pixels.
 * @returns Integer dimensions, each at least 1 px.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdgePx: number,
): { readonly width: number; readonly height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdgePx || longest <= 0) {
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  }
  const scale = maxEdgePx / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Re-encodes a photo at avatar size.
 *
 * Returns the **original blob** when the browser lacks `createImageBitmap` or
 * `OffscreenCanvas`, when the image cannot be decoded, or when the result
 * would be no smaller than the source. Silently storing nothing would lose the
 * user's photo, and storing something larger than what they picked would be a
 * worse outcome than doing nothing.
 *
 * @param source The photo as picked from the camera or library.
 * @param maxEdgePx Longest edge to keep, in pixels.
 * @param quality JPEG quality in the range 0..1.
 * @returns The downscaled JPEG, or `source` when downscaling is not possible.
 */
export async function downscalePhoto(
  source: Blob,
  maxEdgePx: number = PHOTO_MAX_EDGE_PX,
  quality: number = PHOTO_QUALITY,
): Promise<Blob> {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
    return source;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(source);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdgePx);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (context === null) return source;
    context.drawImage(bitmap, 0, 0, width, height);
    const encoded = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    return encoded.size < source.size ? encoded : source;
  } catch {
    return source;
  } finally {
    bitmap?.close();
  }
}
