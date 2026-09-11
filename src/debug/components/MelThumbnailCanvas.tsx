import { useEffect, useRef } from 'react';
import type { MelThumbnail } from '@/engine';
import { drawMelThumbnail } from '@/lib/mel-thumbnail';

interface Props {
  readonly thumbnail: MelThumbnail;
  /** Rendered width in CSS pixels. */
  readonly width?: number;
  /** Rendered height in CSS pixels. */
  readonly height?: number;
}

/** Draws the 64-band log-mel thumbnail attached to an event (spec 6.3). */
export function MelThumbnailCanvas({ thumbnail, width = 160, height = 48 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    drawMelThumbnail(canvas, thumbnail);
  }, [thumbnail, width, height]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Log-mel spectrogram, ${thumbnail.bands} bands by ${thumbnail.frames} frames`}
      style={{ width, height }}
      className="rounded-md ring-1 ring-black/10"
    />
  );
}
