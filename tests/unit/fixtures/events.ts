import type { DetectedEvent, EventFeatures, MelThumbnail, PitchFeatures } from '@/engine';

/**
 * Synthetic detections for unit tests.
 *
 * These stand in for earshot's output so the app-side code can be tested
 * without the engine. They are deliberately plain: the acoustic fixtures that
 * exercise segmentation, pitch tracking and the human-voice guard live in
 * earshot's own `fixtures/synthetic/` (spec 6.7).
 */

export function makeMelThumbnail(bands = 64, frames = 24): MelThumbnail {
  const data = new Float32Array(bands * frames);
  for (let band = 0; band < bands; band += 1) {
    for (let frame = 0; frame < frames; frame += 1) {
      // A rising diagonal ridge so flips and transposes are visible in tests.
      const distance = Math.abs(band / bands - frame / frames);
      data[band * frames + frame] = -60 + 60 * Math.max(0, 1 - distance * 4);
    }
  }
  return { bands, frames, data };
}

export function makePitch(overrides: Partial<PitchFeatures> = {}): PitchFeatures {
  return {
    f0MedianHz: 520,
    f0P5Hz: 430,
    f0P95Hz: 780,
    contourSlopeHzPerSec: 120,
    voicedRatio: 0.82,
    harmonicity: 0.74,
    ...overrides,
  };
}

export function makeFeatures(overrides: Partial<EventFeatures> = {}): EventFeatures {
  return {
    embeddingMean: new Float32Array(1024).fill(0.01),
    embeddingMax: new Float32Array(1024).fill(0.05),
    pitch: makePitch(),
    durationMs: 640,
    syllableCount: 2,
    peakRmsDbfs: -18.4,
    spectralCentroidMedianHz: 1850,
    melThumbnail: makeMelThumbnail(),
    ...overrides,
  };
}

export function makeEvent(overrides: Partial<DetectedEvent> = {}): DetectedEvent {
  return {
    id: 'evt-1',
    startedAt: Date.UTC(2026, 8, 11, 7, 10, 0),
    durationMs: 640,
    type: 'meow',
    typeConfidence: 0.72,
    topClasses: [
      { label: 'Meow', score: 0.72 },
      { label: 'Cat', score: 0.61 },
    ],
    features: makeFeatures(),
    possibleHuman: false,
    clip: null,
    ...overrides,
  };
}
