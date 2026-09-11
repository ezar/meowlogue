import { describe, expect, it } from 'vitest';
import { MODEL_BASE_URL } from '@/engine';
import { describeStatus } from '@/lib/engine-status';
import { levelToFraction } from '@/lib/level';

describe('describeStatus', () => {
  it('leads with the missing engine over any non-error status', () => {
    const message = describeStatus({ kind: 'idle' }, false);
    expect(message.title).toMatch(/earshot/);
  });

  it('reads the missing engine as pending work, not as an alarm', () => {
    expect(describeStatus({ kind: 'idle' }, false).tone).toBe('busy');
    expect(describeStatus({ kind: 'listening' }, false).tone).toBe('busy');
  });

  it('says nothing about earshot once it is available', () => {
    expect(describeStatus({ kind: 'idle' }, true).title).toBe('Idle');
  });

  it('stays quiet while the availability probe is still pending', () => {
    expect(describeStatus({ kind: 'idle' }, null).title).toBe('Idle');
  });

  it('lets a real engine error through even when earshot is missing', () => {
    const message = describeStatus(
      { kind: 'error', error: { code: 'microphone-denied', message: 'no mic' } },
      false,
    );
    expect(message.detail).toBe('no mic');
  });

  it('explains the iOS microphone lifecycle when the page is hidden', () => {
    const message = describeStatus({ kind: 'suspended', reason: 'page-hidden' }, true);
    expect(message.title).toBe('Not listening');
    expect(message.detail).toMatch(/iOS/);
  });

  it('names the real model path rather than a hardcoded root', () => {
    const message = describeStatus({ kind: 'loading-models' }, true);
    expect(message.detail).toContain(MODEL_BASE_URL);
  });

  it('describes every engine status', () => {
    const kinds = ['idle', 'loading-models', 'listening'] as const;
    for (const kind of kinds) {
      expect(describeStatus({ kind }, true).title).not.toBe('');
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
