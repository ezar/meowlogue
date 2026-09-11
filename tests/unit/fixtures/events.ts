import type {
  MelThumbnail,
  MeowEvent,
  PitchTrack,
  VocalEvent,
  WindowFeatures,
  WindowResult,
} from '@/engine';

/**
 * Synthetic fixtures for unit tests.
 *
 * These stand in for earshot's output so the app-side code can be tested
 * without a microphone or the models. The shapes are earshot's real ones, not
 * an approximation — the whole point of the seam is that this is the only
 * place a mismatch would show up. The acoustic fixtures that exercise
 * segmentation, pitch tracking and the human-voice guard live in earshot's own
 * `fixtures/synthetic/` (spec 6.7).
 */

export function makeMelThumbnail(bands = 64, frames = 24): MelThumbnail {
  const data = new Float32Array(new ArrayBuffer(bands * frames * 4));
  for (let band = 0; band < bands; band += 1) {
    for (let frame = 0; frame < frames; frame += 1) {
      // A rising diagonal ridge so flips and transposes are visible in tests.
      const distance = Math.abs(band / bands - frame / frames);
      data[band * frames + frame] = -60 + 60 * Math.max(0, 1 - distance * 4);
    }
  }
  return { bands, frames, data };
}

export function makePitchTrack(overrides: Partial<PitchTrack> = {}): PitchTrack {
  return {
    frames: [
      { t: 0.0, f0Hz: 480, confidence: 0.71, rmsDbfs: -22 },
      { t: 0.01, f0Hz: 520, confidence: 0.78, rmsDbfs: -19 },
      { t: 0.02, f0Hz: 610, confidence: 0.74, rmsDbfs: -18 },
    ],
    medianF0Hz: 520,
    voicedFraction: 0.82,
    minF0Hz: 430,
    maxF0Hz: 780,
    contourSlopeSemitonesPerSecond: 4.2,
    ...overrides,
  };
}

export function makeWindowFeatures(overrides: Partial<WindowFeatures> = {}): WindowFeatures {
  return {
    rmsDbfs: -21.5,
    logMel: Array.from({ length: 64 }, (_, band) => -60 + band * 0.5),
    bands: [{ lowHz: 500, highHz: 1000, levelDbfs: -24.1 }],
    peaks: [{ frequencyHz: 640, levelDbfs: -18.2, prominenceDb: 11.4 }],
    spectralFlatness: 0.18,
    spectralCentroidHz: 1850,
    spectralFlux: 0.42,
    onsets: [0.02],
    onsetPeriodicity: 0,
    onsetPeriodSeconds: 0,
    amplitudeModulationHz: 6.1,
    amplitudeModulationDepth: 0.35,
    ...overrides,
  };
}

/**
 * A window as earshot's engine emits it.
 *
 * @param t Window start, in seconds since capture started.
 */
export function makeWindow(t = 0, overrides: Partial<WindowResult> = {}): WindowResult {
  return {
    t,
    embedding: Array.from({ length: 1024 }, () => 0.01),
    classes: [
      { label: 'Meow', score: 0.72 },
      { label: 'Cat', score: 0.61 },
    ],
    rmsDbfs: -21.5,
    features: makeWindowFeatures(),
    ...overrides,
  };
}

/**
 * An event as earshot's detector emits it: times in seconds since capture
 * started, `type` a raw AudioSet label.
 */
export function makeVocalEvent(overrides: Partial<VocalEvent> = {}): VocalEvent {
  return {
    start: 1.5,
    end: 2.14,
    duration: 0.64,
    type: 'Meow',
    classes: [
      { label: 'Meow', score: 0.72 },
      { label: 'Cat', score: 0.61 },
    ],
    features: makeWindowFeatures(),
    pitch: makePitchTrack(),
    syllables: 2,
    peakDbfs: -18.4,
    possibleHuman: false,
    confidence: 0.72,
    ...overrides,
  };
}

/** An event in Meowlogue's own terms: epoch milliseconds, mapped type. */
export function makeMeowEvent(overrides: Partial<MeowEvent> = {}): MeowEvent {
  return {
    id: 'evt-1',
    startedAt: Date.UTC(2026, 8, 11, 7, 10, 0),
    durationMs: 640,
    type: 'meow',
    triggerLabel: 'Meow',
    confidence: 0.72,
    classes: [
      { label: 'Meow', score: 0.72 },
      { label: 'Cat', score: 0.61 },
    ],
    pitch: makePitchTrack(),
    features: makeWindowFeatures(),
    syllables: 2,
    peakDbfs: -18.4,
    possibleHuman: false,
    melThumbnail: makeMelThumbnail(),
    embedding: Array.from({ length: 1024 }, () => 0.01),
    ...overrides,
  };
}
