import { describe, expect, it } from 'vitest';
import { AudioEngineError, createAudioEngine, isEarshotAvailable } from '@/engine';
import {
  CAPTURE,
  DEFAULT_ENGINE_OPTIONS,
  MODEL_BASE_URL,
  SEGMENTATION,
  THRESHOLDS,
} from '@/engine';

/**
 * The seam's job is to fail in exactly one recognisable way while earshot is
 * absent, so the debug page can say so plainly instead of showing a stack
 * trace. See docs/decisions/0001-earshot-integration-seam.md.
 */
describe('earshot adapter', () => {
  it('reports earshot as unavailable while the package is not installed', async () => {
    await expect(isEarshotAvailable()).resolves.toBe(false);
  });

  it('throws a typed earshot-unavailable error rather than a module error', async () => {
    await expect(createAudioEngine()).rejects.toThrow(AudioEngineError);
    await expect(createAudioEngine()).rejects.toMatchObject({ code: 'earshot-unavailable' });
  });

  it('explains what is missing in the error message', async () => {
    await expect(createAudioEngine()).rejects.toThrow(/github:ezar\/earshot/);
  });
});

describe('detection policy', () => {
  it('matches the capture framing YAMNet expects (spec 6.1)', () => {
    expect(CAPTURE.sampleRateHz).toBe(16_000);
    expect(CAPTURE.windowMs).toBe(975);
    expect(CAPTURE.hopMs).toBe(487.5);
  });

  it('keeps the per-class thresholds from spec 6.2', () => {
    expect(THRESHOLDS).toMatchObject({
      meow: 0.3,
      cat: 0.3,
      purr: 0.25,
      hiss: 0.4,
      caterwaul: 0.4,
      speechGuard: 0.4,
    });
  });

  it('keeps purrs on a longer leash than other events', () => {
    expect(SEGMENTATION.maxPurrDurationMs).toBeGreaterThan(SEGMENTATION.maxDurationMs);
    expect(SEGMENTATION.maxDurationMs).toBe(4_000);
    expect(SEGMENTATION.maxPurrDurationMs).toBe(60_000);
  });

  it('debounces at least as long as it merges', () => {
    expect(SEGMENTATION.debounceMs).toBeGreaterThanOrEqual(SEGMENTATION.mergeGapMs);
  });

  it("serves models from the app's own origin, never a hub", () => {
    expect(DEFAULT_ENGINE_OPTIONS.modelBaseUrl).toBe(MODEL_BASE_URL);
    expect(DEFAULT_ENGINE_OPTIONS.clipPaddingMs).toBe(300);
  });

  /**
   * A GitHub Pages project site is served from `/<repo>/`, so a model URL
   * hardcoded to `/models/` 404s there. Deriving it from Vite's `BASE_URL`
   * keeps the app deployable at any path; these assertions stop it regressing
   * back to a root-relative literal.
   */
  it('derives the model path from the deployment base', () => {
    expect(MODEL_BASE_URL.startsWith(import.meta.env.BASE_URL)).toBe(true);
    expect(MODEL_BASE_URL.endsWith('models/')).toBe(true);
  });

  it('keeps the model path relative to the base, not the origin root', () => {
    // Under the test/dev base of '/' the two coincide; the guard is that the
    // literal is gone, so a subpath build cannot silently break.
    const withoutBase = MODEL_BASE_URL.slice(import.meta.env.BASE_URL.length);
    expect(withoutBase).toBe('models/');
    expect(withoutBase.startsWith('/')).toBe(false);
  });
});
