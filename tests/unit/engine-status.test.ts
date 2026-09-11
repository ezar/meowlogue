import { describe, expect, it } from 'vitest';
import { MODEL_BASE_URL } from '@/engine';
import { describeStatus } from '@/lib/engine-status';
import { levelToFraction } from '@/lib/level';

describe('describeStatus', () => {
  it('surfaces an engine error message verbatim', () => {
    const message = describeStatus({
      kind: 'error',
      error: { code: 'microphone-denied', message: 'no mic' },
    });
    expect(message.tone).toBe('warn');
    expect(message.detail).toBe('no mic');
  });

  it('is plain about idle rather than implying a failure', () => {
    expect(describeStatus({ kind: 'idle' }).title).toBe('Idle');
    expect(describeStatus({ kind: 'idle' }).tone).toBe('neutral');
  });

  it('explains the iOS microphone lifecycle when the page is hidden', () => {
    const message = describeStatus({ kind: 'suspended', reason: 'page-hidden' });
    expect(message.title).toBe('Not listening');
    expect(message.detail).toMatch(/iOS/);
  });

  it('names the real model path rather than a hardcoded root', () => {
    const message = describeStatus({ kind: 'loading-models' });
    expect(message.detail).toContain(MODEL_BASE_URL);
  });

  it('describes every engine status', () => {
    const kinds = ['idle', 'loading-models', 'listening'] as const;
    for (const kind of kinds) {
      expect(describeStatus({ kind }).title).not.toBe('');
    }
  });
});

describe('levelToFraction', () => {
  it('maps the -80 dBFS floor to 0 and full scale to 1', () => {
    expect(levelToFraction(-80)).toBe(0);
    expect(levelToFraction(0)).toBe(1);
  });

  it('clamps beyond the displayed range', () => {
    expect(levelToFraction(-120)).toBe(0);
    expect(levelToFraction(6)).toBe(1);
    expect(levelToFraction(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('is monotonic', () => {
    expect(levelToFraction(-40)).toBeGreaterThan(levelToFraction(-60));
  });
});
